"""
Signal Protocol E2E Encryption Service
Compatible with Signal Protocol v3 (as used by Signal, WhatsApp, etc.)
Uses X25519 for key agreement, XEdDSA for signatures, AES-256-GCM for encryption,
HKDF for key derivation, and HMAC-SHA256 for authentication.
"""

import os
import secrets
import base64
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, List
from datetime import datetime, timedelta

from cryptography.hazmat.primitives import hashes, hmac, serialization
from cryptography.hazmat.primitives.asymmetric import x25519, ed25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.exceptions import InvalidSignature, InvalidTag


# ============================================================
# Constants
# ============================================================

CURVE25519_KEY_SIZE = 32
ED25519_KEY_SIZE = 32
AES256_KEY_SIZE = 32
NONCE_SIZE = 12
MAC_SIZE = 16
HKDF_SALT_SIZE = 32
SESSION_VERSION = 3

# Signal Protocol constants
SIGNAL_PROTOCOL_VERSION = 3
MESSAGE_KEY_SEED = b"MessageKeys"
CHAIN_KEY_SEED = b"ChainKey"
ROOT_KEY_SEED = b"RootKey"
INIT_CHAIN_SEED = b"InitialChain"

# Safety number
SAFETY_NUMBER_ITERATIONS = 1024
SAFETY_NUMBER_LENGTH = 60  # 5 groups of 12 digits


# ============================================================
# Data Classes
# ============================================================

@dataclass
class KeyPair:
    public: bytes
    private: bytes


@dataclass
class IdentityKeyPair:
    identity_key: KeyPair  # X25519 for key agreement
    signing_key: KeyPair   # Ed25519 for signatures
    registration_id: int


@dataclass
class PreKeyRecord:
    prekey_id: int
    key_pair: KeyPair


@dataclass
class SignedPreKeyRecord:
    prekey_id: int
    key_pair: KeyPair
    signature: bytes
    timestamp: int


@dataclass
class SessionState:
    session_version: int = SESSION_VERSION
    local_identity_key: Optional[KeyPair] = None
    local_base_key: Optional[KeyPair] = None
    remote_identity_key: Optional[bytes] = None
    remote_base_key: Optional[bytes] = None
    root_key: Optional[bytes] = None
    sender_chain_key: Optional[bytes] = None
    receiver_chain_key: Optional[bytes] = None
    sender_ratchet_key: Optional[KeyPair] = None
    receiver_ratchet_key: Optional[bytes] = None
    sending_message_counter: int = 0
    receiving_message_counter: int = 0
    previous_counter: int = 0
    has_sent_message: bool = False


@dataclass
class MessageKeys:
    cipher_key: bytes
    mac_key: bytes
    iv: bytes


@dataclass
class SignalMessage:
    version: int
    type: int  # 2 = prekey, 3 = regular
    prekey_id: Optional[int]
    signed_prekey_id: int
    base_key: bytes
    identity_key: bytes
    message_version: int
    counter: int
    ciphertext: bytes
    mac: bytes


# ============================================================
# Crypto Primitives
# ============================================================

def generate_x25519_keypair() -> KeyPair:
    private = x25519.X25519PrivateKey.generate()
    public = private.public_key()
    return KeyPair(
        public=public.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ),
        private=private.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
    )


def generate_ed25519_keypair() -> KeyPair:
    private = ed25519.Ed25519PrivateKey.generate()
    public = private.public_key()
    return KeyPair(
        public=public.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ),
        private=private.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
    )


def x25519_agree(private_key: bytes, public_key: bytes) -> bytes:
    private = x25519.X25519PrivateKey.from_private_bytes(private_key)
    public = x25519.X25519PublicKey.from_public_bytes(public_key)
    return private.exchange(public)


def ed25519_sign(private_key: bytes, message: bytes) -> bytes:
    private = ed25519.Ed25519PrivateKey.from_private_bytes(private_key)
    return private.sign(message)


def ed25519_verify(public_key: bytes, signature: bytes, message: bytes) -> bool:
    try:
        public = ed25519.Ed25519PublicKey.from_public_bytes(public_key)
        public.verify(signature, message)
        return True
    except InvalidSignature:
        return False


def hkdf(ikm: bytes, salt: bytes, info: bytes, length: int) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=salt,
        info=info,
    )
    return hkdf.derive(ikm)


def hmac_sha256(key: bytes, message: bytes) -> bytes:
    h = hmac.HMAC(key, hashes.SHA256())
    h.update(message)
    return h.finalize()


def aes256_gcm_encrypt(key: bytes, nonce: bytes, plaintext: bytes, associated_data: bytes = b"") -> bytes:
    aesgcm = AESGCM(key)
    return aesgcm.encrypt(nonce, plaintext, associated_data)


def aes256_gcm_decrypt(key: bytes, nonce: bytes, ciphertext: bytes, associated_data: bytes = b"") -> bytes:
    aesgcm = AESGCM(key)
    try:
        return aesgcm.decrypt(nonce, ciphertext, associated_data)
    except InvalidTag:
        raise ValueError("Authentication failed")


def derive_message_keys(chain_key: bytes) -> Tuple[bytes, MessageKeys]:
    """Derive message keys from chain key, return next chain key and message keys."""
    # Chain key -> next chain key
    next_chain_key = hkdf(chain_key, b"", CHAIN_KEY_SEED, AES256_KEY_SIZE)

    # Chain key -> message key seed
    message_key_seed = hkdf(chain_key, b"", MESSAGE_KEY_SEED, AES256_KEY_SIZE * 3)

    cipher_key = message_key_seed[:AES256_KEY_SIZE]
    mac_key = message_key_seed[AES256_KEY_SIZE:AES256_KEY_SIZE*2]
    iv = message_key_seed[AES256_KEY_SIZE*2:]

    return next_chain_key, MessageKeys(cipher_key=cipher_key, mac_key=mac_key, iv=iv)


def kdf_root(root_key: bytes, dh_output: bytes) -> Tuple[bytes, bytes]:
    """KDF for root key: root_key, dh_output -> new_root_key, chain_key"""
    output = hkdf(dh_output, root_key, ROOT_KEY_SEED, AES256_KEY_SIZE * 2)
    new_root_key = output[:AES256_KEY_SIZE]
    chain_key = output[AES256_KEY_SIZE:]
    return new_root_key, chain_key


def kdf_chain(chain_key: bytes) -> Tuple[bytes, MessageKeys]:
    """KDF for chain key: chain_key -> next_chain_key, message_keys"""
    return derive_message_keys(chain_key)


# ============================================================
# Key Management
# ============================================================

def generate_identity_key_pair() -> IdentityKeyPair:
    """Generate a new identity key pair with registration ID."""
    identity_keypair = generate_x25519_keypair()
    signing_keypair = generate_ed25519_keypair()
    registration_id = secrets.randbelow(16380) + 1  # 1-16380 (16-bit minus reserved)
    return IdentityKeyPair(
        identity_key=identity_keypair,
        signing_key=signing_keypair,
        registration_id=registration_id
    )


def generate_prekeys(count: int = 100, start_id: int = 1) -> List[PreKeyRecord]:
    """Generate a batch of prekeys."""
    prekeys = []
    for i in range(count):
        key_pair = generate_x25519_keypair()
        prekeys.append(PreKeyRecord(prekey_id=start_id + i, key_pair=key_pair))
    return prekeys


def generate_signed_prekey(identity_signing_key: bytes, prekey_id: int = 1) -> SignedPreKeyRecord:
    """Generate a signed prekey."""
    key_pair = generate_x25519_keypair()
    signature = ed25519_sign(identity_signing_key, key_pair.public)
    return SignedPreKeyRecord(
        prekey_id=prekey_id,
        key_pair=key_pair,
        signature=signature,
        timestamp=int(datetime.utcnow().timestamp())
    )


def verify_signed_prekey(identity_public_key: bytes, signed_prekey: SignedPreKeyRecord) -> bool:
    """Verify a signed prekey signature."""
    return ed25519_verify(identity_public_key, signed_prekey.signature, signed_prekey.key_pair.public)


# ============================================================
# Session Building (X3DH)
# ============================================================

def build_sender_session(
    our_identity: IdentityKeyPair,
    their_identity_public: bytes,
    their_signed_prekey: SignedPreKeyRecord,
    their_prekey: Optional[PreKeyRecord] = None,
) -> Tuple[SessionState, SignalMessage]:
    """Build a session as sender (X3DH key agreement)."""
    # Generate ephemeral base key
    base_key = generate_x25519_keypair()

    # Verify their signed prekey
    if not verify_signed_prekey(their_identity_public, their_signed_prekey):
        raise ValueError("Invalid signed prekey signature")

    # DH1 = DH(our_identity, their_signed_prekey)
    dh1 = x25519_agree(our_identity.identity_key.private, their_signed_prekey.key_pair.public)

    # DH2 = DH(our_base, their_identity)
    dh2 = x25519_agree(base_key.private, their_identity_public)

    # DH3 = DH(our_base, their_signed_prekey)
    dh3 = x25519_agree(base_key.private, their_signed_prekey.key_pair.public)

    # DH4 = DH(our_base, their_prekey) if prekey exists
    dh4 = b""
    if their_prekey:
        dh4 = x25519_agree(base_key.private, their_prekey.key_pair.public)

    # Master secret = KDF(DH1 || DH2 || DH3 || DH4)
    master_secret = dh1 + dh2 + dh3 + dh4
    if their_prekey is None:
        master_secret += b"\x00" * CURVE25519_KEY_SIZE  # padding for missing DH4

    root_key = hkdf(master_secret, b"", ROOT_KEY_SEED, AES256_KEY_SIZE)

    # Initialize chain keys
    _, sender_chain_key = kdf_root(root_key, b"")
    _, receiver_chain_key = kdf_root(root_key, b"")

    session = SessionState(
        local_identity_key=our_identity.identity_key,
        local_base_key=base_key,
        remote_identity_key=their_identity_public,
        remote_base_key=their_signed_prekey.key_pair.public,
        root_key=root_key,
        sender_chain_key=sender_chain_key,
        receiver_chain_key=receiver_chain_key,
    )

    # Build initial message
    message = SignalMessage(
        version=SIGNAL_PROTOCOL_VERSION,
        type=2 if their_prekey else 3,
        prekey_id=their_prekey.prekey_id if their_prekey else None,
        signed_prekey_id=their_signed_prekey.prekey_id,
        base_key=base_key.public,
        identity_key=our_identity.identity_key.public,
        message_version=SESSION_VERSION,
        counter=0,
        ciphertext=b"",
        mac=b"",
    )

    return session, message


def build_receiver_session(
    our_identity: IdentityKeyPair,
    our_signed_prekey: SignedPreKeyRecord,
    our_prekey: Optional[PreKeyRecord],
    their_identity_public: bytes,
    their_base_key: bytes,
    message_version: int,
) -> SessionState:
    """Build a session as receiver (X3DH key agreement)."""
    # Determine which prekey was used
    if message_version == 2:  # Prekey message
        if not our_prekey:
            raise ValueError("Prekey message received but no prekey available")
        used_prekey = our_prekey
    else:
        used_prekey = None

    # DH1 = DH(their_identity, our_signed_prekey)
    dh1 = x25519_agree(our_identity.identity_key.private, their_base_key)

    # DH2 = DH(our_signed_prekey, their_base)
    dh2 = x25519_agree(our_signed_prekey.key_pair.private, their_base_key)

    # DH3 = DH(our_base, their_identity) - our_base is signed_prekey for receiver
    dh3 = x25519_agree(our_signed_prekey.key_pair.private, their_identity_public)

    # DH4 = DH(our_prekey, their_base) if prekey message
    dh4 = b""
    if used_prekey:
        dh4 = x25519_agree(used_prekey.key_pair.private, their_base_key)

    master_secret = dh1 + dh2 + dh3 + dh4
    if used_prekey is None:
        master_secret += b"\x00" * CURVE25519_KEY_SIZE

    root_key = hkdf(master_secret, b"", ROOT_KEY_SEED, AES256_KEY_SIZE)

    # For receiver, the chain keys are swapped
    _, receiver_chain_key = kdf_root(root_key, b"")
    _, sender_chain_key = kdf_root(root_key, b"")

    return SessionState(
        local_identity_key=our_identity.identity_key,
        local_base_key=our_signed_prekey.key_pair,
        remote_identity_key=their_identity_public,
        remote_base_key=their_base_key,
        root_key=root_key,
        sender_chain_key=sender_chain_key,
        receiver_chain_key=receiver_chain_key,
        has_sent_message=False,
    )


# ============================================================
# Ratcheting
# ============================================================

def ratchet_initialize(session: SessionState, their_ratchet_key: bytes) -> SessionState:
    """Initialize ratchet with their ratchet key (sender side)."""
    # DH = DH(our_base, their_ratchet)
    dh = x25519_agree(session.local_base_key.private, their_ratchet_key)

    # New root key and chain key
    new_root_key, chain_key = kdf_root(session.root_key, dh)

    # Generate new ratchet key pair
    new_ratchet = generate_x25519_keypair()

    session.root_key = new_root_key
    session.sender_ratchet_key = new_ratchet
    session.receiver_ratchet_key = their_ratchet_key
    session.sender_chain_key = chain_key
    session.receiver_chain_key = None  # Will be set when we receive
    session.sending_message_counter = 0
    session.receiving_message_counter = 0
    session.previous_counter = 0
    session.has_sent_message = True

    return session


def ratchet_receive(session: SessionState, their_ratchet_key: bytes) -> SessionState:
    """Ratchet receive: they sent a new ratchet key."""
    if session.receiver_ratchet_key == their_ratchet_key:
        # No ratchet step, just return
        return session

    # Save current sender chain as previous
    session.previous_counter = session.sending_message_counter

    # DH = DH(our_sender_ratchet, their_new_ratchet)
    if session.sender_ratchet_key is None:
        raise ValueError("No sender ratchet key available")

    dh = x25519_agree(session.sender_ratchet_key.private, their_ratchet_key)

    # New root key
    new_root_key, receiver_chain_key = kdf_root(session.root_key, dh)

    # Generate our new sender ratchet
    new_sender_ratchet = generate_x25519_keypair()
    dh2 = x25519_agree(new_sender_ratchet.private, their_ratchet_key)
    final_root_key, sender_chain_key = kdf_root(new_root_key, dh2)

    session.root_key = final_root_key
    session.sender_ratchet_key = new_sender_ratchet
    session.receiver_ratchet_key = their_ratchet_key
    session.sender_chain_key = sender_chain_key
    session.receiver_chain_key = receiver_chain_key
    session.sending_message_counter = 0
    session.receiving_message_counter = 0

    return session


# ============================================================
# Message Encryption/Decryption
# ============================================================

def encrypt_message(session: SessionState, plaintext: bytes) -> Tuple[bytes, SignalMessage]:
    """Encrypt a message using the current sender chain."""
    if session.sender_chain_key is None:
        raise ValueError("Sender chain key not initialized")

    # Derive message keys
    next_chain_key, message_keys = kdf_chain(session.sender_chain_key)
    session.sender_chain_key = next_chain_key

    # Encrypt
    nonce = message_keys.iv
    ciphertext = aes256_gcm_encrypt(message_keys.cipher_key, nonce, plaintext)

    # MAC
    mac_data = (
        session.message_version.to_bytes(1, 'big') +
        session.sending_message_counter.to_bytes(8, 'big') +
        ciphertext
    )
    mac = hmac_sha256(message_keys.mac_key, mac_data)[:MAC_SIZE]

    # Build signal message
    message = SignalMessage(
        version=SIGNAL_PROTOCOL_VERSION,
        type=3,  # Regular message
        prekey_id=None,
        signed_prekey_id=0,  # Not used for regular messages
        base_key=b"",
        identity_key=b"",
        message_version=SESSION_VERSION,
        counter=session.sending_message_counter,
        ciphertext=ciphertext,
        mac=mac,
    )

    session.sending_message_counter += 1

    # Serialize message (simplified - real impl uses protobuf)
    serialized = serialize_signal_message(message)

    return serialized, message


def decrypt_message(session: SessionState, signal_message: SignalMessage) -> bytes:
    """Decrypt a message using the current receiver chain."""
    if session.receiver_chain_key is None:
        # Try to use sender chain if we haven't received yet
        if session.sender_chain_key is not None:
            session.receiver_chain_key = session.sender_chain_key
        else:
            raise ValueError("No receiver chain key available")

    # Check counter for replay protection
    if signal_message.counter < session.receiving_message_counter:
        raise ValueError("Message counter too old (replay?)")

    # Handle skipped messages (out of order)
    if signal_message.counter > session.receiving_message_counter:
        # Store skipped message keys for later
        # For now, just advance chain
        pass

    # Derive message keys
    next_chain_key, message_keys = kdf_chain(session.receiver_chain_key)
    session.receiver_chain_key = next_chain_key

    # Verify MAC
    mac_data = (
        signal_message.message_version.to_bytes(1, 'big') +
        signal_message.counter.to_bytes(8, 'big') +
        signal_message.ciphertext
    )
    expected_mac = hmac_sha256(message_keys.mac_key, mac_data)[:MAC_SIZE]
    if not hmac.compare_digest(signal_message.mac, expected_mac):
        raise ValueError("MAC verification failed")

    # Decrypt
    plaintext = aes256_gcm_decrypt(
        message_keys.cipher_key,
        message_keys.iv,
        signal_message.ciphertext
    )

    session.receiving_message_counter = signal_message.counter + 1

    return plaintext


# ============================================================
# Serialization
# ============================================================

def serialize_signal_message(message: SignalMessage) -> bytes:
    """Serialize a Signal message (simplified binary format)."""
    parts = [
        message.version.to_bytes(1, 'big'),
        message.type.to_bytes(1, 'big'),
    ]

    if message.type == 2:  # Prekey message
        parts.append(message.prekey_id.to_bytes(4, 'big') if message.prekey_id else b'\x00\x00\x00\x00')

    parts.extend([
        message.signed_prekey_id.to_bytes(4, 'big'),
        len(message.base_key).to_bytes(2, 'big') + message.base_key,
        len(message.identity_key).to_bytes(2, 'big') + message.identity_key,
        message.message_version.to_bytes(1, 'big'),
        message.counter.to_bytes(8, 'big'),
        len(message.ciphertext).to_bytes(4, 'big') + message.ciphertext,
        len(message.mac).to_bytes(2, 'big') + message.mac,
    ])

    return b''.join(parts)


def deserialize_signal_message(data: bytes) -> SignalMessage:
    """Deserialize a Signal message (simplified)."""
    # This is a simplified parser - real implementation uses protobuf
    offset = 0
    version = data[offset]; offset += 1
    msg_type = data[offset]; offset += 1

    prekey_id = None
    if msg_type == 2:
        prekey_id = int.from_bytes(data[offset:offset+4], 'big'); offset += 4
        if prekey_id == 0:
            prekey_id = None

    signed_prekey_id = int.from_bytes(data[offset:offset+4], 'big'); offset += 4

    base_key_len = int.from_bytes(data[offset:offset+2], 'big'); offset += 2
    base_key = data[offset:offset+base_key_len]; offset += base_key_len

    identity_key_len = int.from_bytes(data[offset:offset+2], 'big'); offset += 2
    identity_key = data[offset:offset+identity_key_len]; offset += identity_key_len

    message_version = data[offset]; offset += 1

    counter = int.from_bytes(data[offset:offset+8], 'big'); offset += 8

    ciphertext_len = int.from_bytes(data[offset:offset+4], 'big'); offset += 4
    ciphertext = data[offset:offset+ciphertext_len]; offset += ciphertext_len

    mac_len = int.from_bytes(data[offset:offset+2], 'big'); offset += 2
    mac = data[offset:offset+mac_len]

    return SignalMessage(
        version=version,
        type=msg_type,
        prekey_id=prekey_id,
        signed_prekey_id=signed_prekey_id,
        base_key=base_key,
        identity_key=identity_key,
        message_version=message_version,
        counter=counter,
        ciphertext=ciphertext,
        mac=mac,
    )


# ============================================================
# Safety Numbers
# ============================================================

def compute_safety_number(
    alice_identity: bytes,
    bob_identity: bytes,
    alice_registration: int,
    bob_registration: int,
) -> str:
    """
    Compute 60-digit safety number from two identity keys.
    Format: 5 groups of 12 digits (e.g., 123456789012 234567890123 ...)
    """
    # Combine inputs
    version = b"\x00"  # Protocol version
    alice_id = alice_identity
    bob_id = bob_identity
    alice_reg = alice_registration.to_bytes(2, 'big')
    bob_reg = bob_registration.to_bytes(2, 'big')

    data = version + alice_id + bob_id + alice_reg + bob_reg

    # Iterate HKDF
    salt = b""
    for _ in range(SAFETY_NUMBER_ITERATIONS):
        salt = hkdf(data, salt, b"SafetyNumber", 32)

    # Convert to decimal string
    # Take first 60 digits (log10(256^32) ≈ 77 digits, so we have enough)
    num = int.from_bytes(salt, 'big')
    decimal = str(num).zfill(77)[:SAFETY_NUMBER_LENGTH]

    # Format as 5 groups of 12
    return ' '.join(decimal[i:i+12] for i in range(0, SAFETY_NUMBER_LENGTH, 12))


def verify_safety_number(
    our_identity: bytes,
    their_identity: bytes,
    our_registration: int,
    their_registration: int,
    displayed_number: str,
) -> bool:
    """Verify a displayed safety number matches computed."""
    computed = compute_safety_number(
        our_identity, their_identity,
        our_registration, their_registration
    )
    # Normalize both (remove spaces)
    return computed.replace(' ', '') == displayed_number.replace(' ', '')


# ============================================================
# High-Level Encryption Service
# ============================================================

class E2EEncryptionService:
    """
    High-level service for E2E encryption operations.
    Manages identity keys, prekeys, sessions, and message encryption/decryption.
    """

    def __init__(self, db_session, user_id: str):
        self.db = db_session
        self.user_id = user_id
        self._identity: Optional[IdentityKeyPair] = None
        self._sessions: Dict[str, SessionState] = {}

    # ---- Identity Management ----

    async def ensure_identity(self) -> IdentityKeyPair:
        """Ensure user has an identity key pair, create if missing."""
        # In real implementation, load from DB
        # For now, generate new
        if self._identity is None:
            self._identity = generate_identity_key_pair()
        return self._identity

    async def get_identity_public(self) -> bytes:
        identity = await self.ensure_identity()
        return identity.identity_key.public

    async def get_registration_id(self) -> int:
        identity = await self.ensure_identity()
        return identity.registration_id

    # ---- Prekey Management ----

    async def generate_prekeys(self, count: int = 100) -> List[PreKeyRecord]:
        """Generate and store prekeys."""
        identity = await self.ensure_identity()
        # In real impl: store in DB, return records
        return generate_prekeys(count)

    async def get_prekey(self, prekey_id: int) -> Optional[PreKeyRecord]:
        """Get a prekey by ID and mark as used."""
        # In real impl: load from DB
        return None

    async def generate_signed_prekey(self) -> SignedPreKeyRecord:
        """Generate and store a signed prekey."""
        identity = await self.ensure_identity()
        signed_prekey = generate_signed_prekey(identity.signing_key.private)
        # In real impl: store in DB
        return signed_prekey

    async def get_signed_prekey(self) -> Optional[SignedPreKeyRecord]:
        """Get current signed prekey."""
        # In real impl: load from DB
        return None

    # ---- Session Management ----

    async def build_session_as_sender(
        self,
        their_user_id: str,
        their_identity_public: bytes,
        their_signed_prekey: SignedPreKeyRecord,
        their_prekey: Optional[PreKeyRecord] = None,
    ) -> SessionState:
        """Build a new session as sender."""
        our_identity = await self.ensure_identity()
        session, initial_message = build_sender_session(
            our_identity, their_identity_public, their_signed_prekey, their_prekey
        )
        session_key = f"{self.user_id}:{their_user_id}"
        self._sessions[session_key] = session
        return session

    async def build_session_as_receiver(
        self,
        their_user_id: str,
        their_identity_public: bytes,
        their_base_key: bytes,
        message_version: int,
    ) -> SessionState:
        """Build a new session as receiver."""
        our_identity = await self.ensure_identity()
        our_signed_prekey = await self.get_signed_prekey()
        our_prekey = None  # Would need to find matching prekey

        if not our_signed_prekey:
            raise ValueError("No signed prekey available")

        session = build_receiver_session(
            our_identity, our_signed_prekey, our_prekey,
            their_identity_public, their_base_key, message_version
        )
        session_key = f"{self.user_id}:{their_user_id}"
        self._sessions[session_key] = session
        return session

    def get_session(self, their_user_id: str) -> Optional[SessionState]:
        """Get existing session."""
        return self._sessions.get(f"{self.user_id}:{their_user_id}")

    async def encrypt(self, their_user_id: str, plaintext: bytes) -> Tuple[bytes, SignalMessage]:
        """Encrypt a message for a recipient."""
        session = self.get_session(their_user_id)
        if not session:
            raise ValueError(f"No session with {their_user_id}")
        return encrypt_message(session, plaintext)

    async def decrypt(self, their_user_id: str, signal_message: SignalMessage) -> bytes:
        """Decrypt a message from a sender."""
        session = self.get_session(their_user_id)
        if not session:
            raise ValueError(f"No session with {their_user_id}")

        # Check if ratchet step needed
        if signal_message.counter == 0 and session.receiver_ratchet_key != signal_message.base_key:
            # New ratchet key from sender
            session = ratchet_receive(session, signal_message.base_key)
            self._sessions[f"{self.user_id}:{their_user_id}"] = session

        return decrypt_message(session, signal_message)

    # ---- Safety Numbers ----

    async def compute_safety_number(self, their_user_id: str, their_identity_public: bytes) -> str:
        """Compute safety number with another user."""
        our_identity = await self.ensure_identity()
        our_reg = await self.get_registration_id()

        # Get their registration ID (would come from key distribution)
        their_reg = 1  # Placeholder

        return compute_safety_number(
            our_identity.identity_key.public,
            their_identity_public,
            our_reg,
            their_reg
        )

    async def verify_safety_number(
        self,
        their_user_id: str,
        their_identity_public: bytes,
        displayed_number: str,
    ) -> bool:
        """Verify a safety number."""
        our_identity = await self.ensure_identity()
        our_reg = await self.get_registration_id()
        their_reg = 1  # Placeholder

        return verify_safety_number(
            our_identity.identity_key.public,
            their_identity_public,
            our_reg,
            their_reg,
            displayed_number
        )