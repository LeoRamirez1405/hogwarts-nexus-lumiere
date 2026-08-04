"""E2E Encryption API Router - Main entry point."""
from fastapi import APIRouter

from . import identity, prekeys, signed_prekey, sessions, encryption, safety_numbers, key_distribution

router = APIRouter(prefix="/e2e", tags=["E2E Encryption"])

router.include_router(identity.router)
router.include_router(prekeys.router)
router.include_router(signed_prekey.router)
router.include_router(sessions.router)
router.include_router(encryption.router)
router.include_router(safety_numbers.router)
router.include_router(key_distribution.router)