"""Receiver ratchet step."""
from ..crypto.primitives import generate_x25519_keypair, x25519_agree, kdf_root
from ..crypto.keys import SessionState, KeyPair


def ratchet_receive(session: SessionState, their_ratchet_key: bytes) -> SessionState:
    """Ratchet receive: they sent a new ratchet key."""
    if session.receiver_ratchet_key == their_ratchet_key:
        return session

    session.previous_counter = session.sending_message_counter

    if session.sender_ratchet_key is None:
        raise ValueError("No sender ratchet key available")

    dh = x25519_agree(session.sender_ratchet_key.private, their_ratchet_key)

    new_root_key, receiver_chain_key = kdf_root(session.root_key, dh)

    new_sender_ratchet = generate_x25519_keypair()
    dh2 = x25519_agree(new_sender_ratchet[1], their_ratchet_key)
    final_root_key, sender_chain_key = kdf_root(new_root_key, dh2)

    session.root_key = final_root_key
    session.sender_ratchet_key = KeyPair(public=new_sender_ratchet[0], private=new_sender_ratchet[1])
    session.receiver_ratchet_key = their_ratchet_key
    session.sender_chain_key = sender_chain_key
    session.receiver_chain_key = receiver_chain_key
    session.sending_message_counter = 0
    session.receiving_message_counter = 0

    return session