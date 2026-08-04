"""Sender ratchet initialization."""
from ..crypto.primitives import generate_x25519_keypair, x25519_agree, kdf_root
from ..crypto.keys import SessionState, KeyPair


def ratchet_initialize(session: SessionState, their_ratchet_key: bytes) -> SessionState:
    """Initialize ratchet with their ratchet key (sender side)."""
    dh = x25519_agree(session.local_base_key.private, their_ratchet_key)

    new_root_key, chain_key = kdf_root(session.root_key, dh)

    new_ratchet = generate_x25519_keypair()

    session.root_key = new_root_key
    session.sender_ratchet_key = KeyPair(public=new_ratchet[0], private=new_ratchet[1])
    session.receiver_ratchet_key = their_ratchet_key
    session.sender_chain_key = chain_key
    session.receiver_chain_key = None
    session.sending_message_counter = 0
    session.receiving_message_counter = 0
    session.previous_counter = 0
    session.has_sent_message = True

    return session