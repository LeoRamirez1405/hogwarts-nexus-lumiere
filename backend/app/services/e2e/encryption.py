"""Message encryption/decryption using double ratchet."""
from typing import Tuple
from .crypto.primitives import (
    aes256_gcm_encrypt,
    aes256_gcm_decrypt,
    hmac_sha256,
    kdf_chain,
    MAC_SIZE,
)
from .crypto.keys import SessionState, SignalMessage
from .session.serialization import serialize_signal_message


SESSION_VERSION = 3
SIGNAL_PROTOCOL_VERSION = 3


def encrypt_message(session: SessionState, plaintext: bytes) -> Tuple[bytes, SignalMessage]:
    """Encrypt a message using the current sender chain."""
    if session.sender_chain_key is None:
        raise ValueError("Sender chain key not initialized")

    next_chain_key, message_keys = kdf_chain(session.sender_chain_key)
    session.sender_chain_key = next_chain_key

    nonce = message_keys.iv
    ciphertext = aes256_gcm_encrypt(message_keys.cipher_key, nonce, plaintext)

    mac_data = (
        session.session_version.to_bytes(1, 'big') +
        session.sending_message_counter.to_bytes(8, 'big') +
        ciphertext
    )
    mac = hmac_sha256(message_keys.mac_key, mac_data)[:MAC_SIZE]

    message = SignalMessage(
        version=SIGNAL_PROTOCOL_VERSION,
        type=3,
        prekey_id=None,
        signed_prekey_id=0,
        base_key=b"",
        identity_key=b"",
        message_version=SESSION_VERSION,
        counter=session.sending_message_counter,
        ciphertext=ciphertext,
        mac=mac,
    )

    session.sending_message_counter += 1

    serialized = serialize_signal_message(message)

    return serialized, message


def decrypt_message(session: SessionState, signal_message: SignalMessage) -> bytes:
    """Decrypt a message using the current receiver chain."""
    if session.receiver_chain_key is None:
        if session.sender_chain_key is not None:
            session.receiver_chain_key = session.sender_chain_key
        else:
            raise ValueError("No receiver chain key available")

    if signal_message.counter < session.receiving_message_counter:
        raise ValueError("Message counter too old (replay?)")

    if signal_message.counter > session.receiving_message_counter:
        pass

    next_chain_key, message_keys = kdf_chain(session.receiver_chain_key)
    session.receiver_chain_key = next_chain_key

    mac_data = (
        signal_message.message_version.to_bytes(1, 'big') +
        signal_message.counter.to_bytes(8, 'big') +
        signal_message.ciphertext
    )
    if not hmac_sha256(message_keys.mac_key, mac_data)[:MAC_SIZE] == signal_message.mac:
        raise ValueError("MAC verification failed")

    plaintext = aes256_gcm_decrypt(
        message_keys.cipher_key,
        message_keys.iv,
        signal_message.ciphertext
    )

    session.receiving_message_counter = signal_message.counter + 1

    return plaintext