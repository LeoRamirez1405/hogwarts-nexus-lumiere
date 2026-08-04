"""Low-level crypto primitives."""
import os
import base64
from typing import Tuple

from cryptography.hazmat.primitives import hashes, hmac, serialization
from cryptography.hazmat.primitives.asymmetric import x25519, ed25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidSignature, InvalidTag

from ....config import settings
from .keys import MessageKeys


CURVE25519_KEY_SIZE = 32
ED25519_KEY_SIZE = 32
AES256_KEY_SIZE = 32
NONCE_SIZE = 12
MAC_SIZE = 16
HKDF_SALT_SIZE = 32

MESSAGE_KEY_SEED = b"MessageKeys"
CHAIN_KEY_SEED = b"ChainKey"
ROOT_KEY_SEED = b"RootKey"
INIT_CHAIN_SEED = b"InitialChain"


def _get_encryption_key() -> bytes:
    """Get the at-rest encryption key from settings."""
    if not settings.ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY must be set in environment for at-rest encryption")
    return bytes.fromhex(settings.ENCRYPTION_KEY)


def encrypt_at_rest(plaintext: bytes) -> str:
    """Encrypt data at rest using AES-256-GCM. Returns base64-encoded ciphertext with nonce."""
    key = _get_encryption_key()
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_at_rest(encrypted_b64: str) -> bytes:
    """Decrypt data at rest. Expects base64-encoded nonce + ciphertext."""
    key = _get_encryption_key()
    data = base64.b64decode(encrypted_b64)
    nonce = data[:NONCE_SIZE]
    ciphertext = data[NONCE_SIZE:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)


def generate_x25519_keypair() -> Tuple[bytes, bytes]:
    private = x25519.X25519PrivateKey.generate()
    public = private.public_key()
    return (
        public.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ),
        private.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
    )


def generate_ed25519_keypair() -> Tuple[bytes, bytes]:
    private = ed25519.Ed25519PrivateKey.generate()
    public = private.public_key()
    return (
        public.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ),
        private.private_bytes(
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
    hkdf_obj = HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=salt,
        info=info,
    )
    return hkdf_obj.derive(ikm)


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
    next_chain_key = hkdf(chain_key, b"", CHAIN_KEY_SEED, AES256_KEY_SIZE)
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