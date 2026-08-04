"""Signal message serialization."""
from ..crypto.keys import SignalMessage


SIGNAL_PROTOCOL_VERSION = 3


def serialize_signal_message(message: SignalMessage) -> bytes:
    """Serialize a Signal message (simplified binary format)."""
    parts = [
        message.version.to_bytes(1, 'big'),
        message.type.to_bytes(1, 'big'),
    ]

    if message.type == 2:
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
    offset = 0
    version = data[offset]
    offset += 1
    msg_type = data[offset]
    offset += 1

    prekey_id = None
    if msg_type == 2:
        prekey_id = int.from_bytes(data[offset:offset+4], 'big')
        offset += 4
        if prekey_id == 0:
            prekey_id = None

    signed_prekey_id = int.from_bytes(data[offset:offset+4], 'big')
    offset += 4

    base_key_len = int.from_bytes(data[offset:offset+2], 'big')
    offset += 2
    base_key = data[offset:offset+base_key_len]
    offset += base_key_len

    identity_key_len = int.from_bytes(data[offset:offset+2], 'big')
    offset += 2
    identity_key = data[offset:offset+identity_key_len]
    offset += identity_key_len

    message_version = data[offset]
    offset += 1

    counter = int.from_bytes(data[offset:offset+8], 'big')
    offset += 8

    ciphertext_len = int.from_bytes(data[offset:offset+4], 'big')
    offset += 4
    ciphertext = data[offset:offset+ciphertext_len]
    offset += ciphertext_len

    mac_len = int.from_bytes(data[offset:offset+2], 'big')
    offset += 2
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