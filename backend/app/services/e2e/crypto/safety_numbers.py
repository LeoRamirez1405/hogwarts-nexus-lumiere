"""Safety number computation and verification."""
from .primitives import hkdf


SAFETY_NUMBER_ITERATIONS = 1024
SAFETY_NUMBER_LENGTH = 60


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
    version = b"\x00"
    alice_id = alice_identity
    bob_id = bob_identity
    alice_reg = alice_registration.to_bytes(2, 'big')
    bob_reg = bob_registration.to_bytes(2, 'big')

    data = version + alice_id + bob_id + alice_reg + bob_reg

    salt = b""
    for _ in range(SAFETY_NUMBER_ITERATIONS):
        salt = hkdf(data, salt, b"SafetyNumber", 32)

    num = int.from_bytes(salt, 'big')
    decimal = str(num).zfill(77)[:SAFETY_NUMBER_LENGTH]

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
    return computed.replace(' ', '') == displayed_number.replace(' ', '')