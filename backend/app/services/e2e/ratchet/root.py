"""Root key derivation for double ratchet."""
from typing import Tuple
from ..crypto.primitives import kdf_root as _kdf_root


def kdf_root(root_key: bytes, dh_output: bytes) -> Tuple[bytes, bytes]:
    """KDF for root key: root_key, dh_output -> new_root_key, chain_key"""
    return _kdf_root(root_key, dh_output)