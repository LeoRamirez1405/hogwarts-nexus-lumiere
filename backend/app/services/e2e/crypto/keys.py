"""Key data classes for E2E encryption."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class KeyPair:
    public: bytes
    private: bytes


@dataclass
class IdentityKeyPair:
    identity_key: KeyPair
    signing_key: KeyPair
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
class MessageKeys:
    cipher_key: bytes
    mac_key: bytes
    iv: bytes


@dataclass
class SignalMessage:
    version: int
    type: int
    prekey_id: Optional[int]
    signed_prekey_id: int
    base_key: bytes
    identity_key: bytes
    message_version: int
    counter: int
    ciphertext: bytes
    mac: bytes


@dataclass
class SessionState:
    session_version: int = 3
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