"""Key management: identity, prekeys, signed prekeys."""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from .crypto.primitives import (
    generate_x25519_keypair,
    encrypt_at_rest,
    decrypt_at_rest,
    ed25519_sign,
)
from .crypto.keys import IdentityKeyPair, KeyPair, PreKeyRecord, SignedPreKeyRecord
from .crypto.keygen import generate_identity_key_pair
from ...models.e2e_encryption import (
    UserIdentityKey,
    UserPreKey,
    UserSignedPreKey,
    Session,
)


class KeyManager:
    """Manages identity keys, prekeys and signed prekeys."""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def load_or_create_identity(self) -> IdentityKeyPair:
        """Load identity from DB or create new."""
        identity_db = (
            await self.db.execute(
                select(UserIdentityKey).where(UserIdentityKey.user_id == self.user_id)
            )
        ).scalar_one_or_none()

        if identity_db:
            return IdentityKeyPair(
                identity_key=KeyPair(
                    public=identity_db.identity_key_public,
                    private=decrypt_at_rest(identity_db.identity_key_private),
                ),
                signing_key=KeyPair(
                    public=identity_db.signing_key_public,
                    private=decrypt_at_rest(identity_db.signing_key_private),
                ),
                registration_id=identity_db.registration_id,
            )

        return await self._create_identity()

    async def _create_identity(self) -> IdentityKeyPair:
        """Create and persist a new identity key pair."""
        keypair = generate_identity_key_pair()

        identity_db = UserIdentityKey(
            user_id=self.user_id,
            identity_key_public=keypair.identity_key.public,
            identity_key_private=encrypt_at_rest(keypair.identity_key.private),
            signing_key_public=keypair.signing_key.public,
            signing_key_private=encrypt_at_rest(keypair.signing_key.private),
            registration_id=keypair.registration_id,
        )
        self.db.add(identity_db)
        await self.db.commit()
        return keypair

    async def rotate_identity(self) -> IdentityKeyPair:
        """Rotate identity keys (dangerous - breaks all existing sessions!)."""
        identity_ids = (
            await self.db.execute(
                select(UserIdentityKey.id).where(UserIdentityKey.user_id == self.user_id)
            )
        ).scalars().all()

        if identity_ids:
            await self.db.execute(
                delete(UserPreKey).where(UserPreKey.identity_id.in_(identity_ids))
            )
            await self.db.execute(
                delete(UserSignedPreKey).where(UserSignedPreKey.identity_id.in_(identity_ids))
            )
            await self.db.execute(
                delete(Session).where(
                    (Session.user_id == self.user_id) | (Session.remote_user_id == self.user_id)
                )
            )
            await self.db.execute(
                delete(UserIdentityKey).where(UserIdentityKey.user_id == self.user_id)
            )
            await self.db.commit()

        return await self._create_identity()

    async def _identity_row(self) -> UserIdentityKey:
        """Get the identity DB row for the current user."""
        identity_db = (
            await self.db.execute(
                select(UserIdentityKey).where(UserIdentityKey.user_id == self.user_id)
            )
        ).scalar_one()
        return identity_db

    async def generate_prekeys(self, count: int = 100) -> List[PreKeyRecord]:
        """Generate and store a batch of prekeys."""
        identity_db = await self._identity_row()
        existing_count = (
            await self.db.execute(
                select(func.count()).select_from(UserPreKey).where(
                    UserPreKey.identity_id == identity_db.id
                )
            )
        ).scalar_one()
        start_id = existing_count + 1

        prekeys = []
        for i in range(count):
            key_pair = generate_x25519_keypair()
            pk = PreKeyRecord(
                prekey_id=start_id + i,
                key_pair=KeyPair(public=key_pair[0], private=key_pair[1]),
            )
            prekeys.append(pk)

            db_pk = UserPreKey(
                identity_id=identity_db.id,
                prekey_id=pk.prekey_id,
                public_key=pk.key_pair.public,
                private_key=encrypt_at_rest(pk.key_pair.private),
            )
            self.db.add(db_pk)

        await self.db.commit()
        return prekeys

    async def get_unused_prekeys(self, count: int = 50) -> List[PreKeyRecord]:
        """Get unused prekeys from database."""
        identity_db = await self._identity_row()

        unused = (
            await self.db.execute(
                select(UserPreKey)
                .where(
                    UserPreKey.identity_id == identity_db.id,
                    UserPreKey.used.is_(False),
                )
                .limit(count)
            )
        ).scalars().all()

        return [
            PreKeyRecord(
                prekey_id=pk.prekey_id,
                key_pair=KeyPair(
                    public=pk.public_key,
                    private=decrypt_at_rest(pk.private_key)
                )
            )
            for pk in unused
        ]

    async def consume_prekey(self, prekey_id: int) -> Optional[PreKeyRecord]:
        """Mark a prekey as used."""
        identity_db = await self._identity_row()

        prekey_db = (
            await self.db.execute(
                select(UserPreKey).where(
                    UserPreKey.identity_id == identity_db.id,
                    UserPreKey.prekey_id == prekey_id,
                )
            )
        ).scalar_one_or_none()

        if not prekey_db or prekey_db.used:
            return None

        prekey_db.used = True
        prekey_db.used_at = datetime.utcnow()
        await self.db.commit()

        return PreKeyRecord(
            prekey_id=prekey_db.prekey_id,
            key_pair=KeyPair(
                public=prekey_db.public_key,
                private=decrypt_at_rest(prekey_db.private_key)
            )
        )

    async def get_signed_prekey(self) -> Optional[SignedPreKeyRecord]:
        """Get current signed prekey."""
        identity_db = await self._identity_row()

        spk_db = (
            await self.db.execute(
                select(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity_db.id)
            )
        ).scalar_one_or_none()

        if not spk_db:
            return None

        return SignedPreKeyRecord(
            prekey_id=spk_db.prekey_id,
            key_pair=KeyPair(
                public=spk_db.public_key,
                private=decrypt_at_rest(spk_db.private_key)
            ),
            signature=spk_db.signature,
            timestamp=int(spk_db.created_at.timestamp()),
        )

    async def generate_signed_prekey(self) -> SignedPreKeyRecord:
        """Generate and store a signed prekey."""
        identity = await self.load_or_create_identity()
        identity_db = await self._identity_row()

        await self.db.execute(
            delete(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity_db.id)
        )

        signing_key_private = identity.signing_key.private
        keypair = generate_x25519_keypair()
        spk = SignedPreKeyRecord(
            prekey_id=1,
            key_pair=KeyPair(public=keypair[0], private=keypair[1]),
            signature=ed25519_sign(signing_key_private, keypair[0]),
            timestamp=int(datetime.utcnow().timestamp()),
        )

        spk_db = UserSignedPreKey(
            identity_id=identity_db.id,
            prekey_id=spk.prekey_id,
            public_key=spk.key_pair.public,
            private_key=encrypt_at_rest(spk.key_pair.private),
            signature=spk.signature,
        )
        self.db.add(spk_db)
        await self.db.commit()

        return spk

    async def rotate_signed_prekey(self) -> SignedPreKeyRecord:
        """Rotate signed prekey."""
        identity_db = await self._identity_row()
        await self.db.execute(
            delete(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity_db.id)
        )
        return await self.generate_signed_prekey()