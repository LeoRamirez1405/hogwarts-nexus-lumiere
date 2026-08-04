"""seed_initial_data

Revision ID: 91bae5f43996
Revises: 0fb1f990f924
Create Date: 2026-08-04 02:17:17.462542

"""
from typing import Sequence, Union
from datetime import datetime, timedelta

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91bae5f43996'
down_revision: Union[str, None] = '0fb1f990f924'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Fixed UUIDs for the 5 demo users (so we can reference them in FKs)
ADMIN_ID = "00000000-0000-0000-0000-000000000001"
HERMIONE_ID = "00000000-0000-0000-0000-000000000002"
LUNA_ID = "00000000-0000-0000-0000-000000000003"
CEDRIC_ID = "00000000-0000-0000-0000-000000000004"
HARRY_ID = "00000000-0000-0000-0000-000000000005"

# Password hash for "admin123" and "user123" (bcrypt)
# Generated with: hash_password("admin123") and hash_password("user123")
ADMIN_PWD_HASH = "$2b$12$Gwq23dl4JYN1XMAt.ylwfOvH4P1unDbMi6WrMZ2snpO8w4c.cMeHy"
USER_PWD_HASH = "$2b$12$OEAga83wnDfKEYUls7wS2uUv5AKQ9S7tn7q/yyXjqDbJWHHoe6P4i"

# Base timestamps (relative to migration run time via SQL functions)
# We'll use datetime.utcnow() equivalent for created_at
NOW = datetime.utcnow()


def upgrade() -> None:
    # ---------- USERS ----------
    op.bulk_insert(
        sa.table(
            "users",
            sa.column("id", sa.String),
            sa.column("name", sa.String),
            sa.column("email", sa.String),
            sa.column("password_hash", sa.String),
            sa.column("role", sa.String),
            sa.column("zerines", sa.Integer),
            sa.column("house_points", sa.Integer),
            sa.column("house", sa.String),
            sa.column("bio", sa.Text),
            sa.column("avatar_url", sa.String),
            sa.column("care_actions", sa.Integer),
            sa.column("items_purchased", sa.Integer),
            sa.column("sanctuary_penalty", sa.Integer),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {
                "id": ADMIN_ID,
                "name": "Albus Dumbledore",
                "email": "admin@nexus.com",
                "password_hash": ADMIN_PWD_HASH,
                "role": "admin",
                "zerines": 50000,
                "house_points": 500,
                "house": "Gryffindor",
                "bio": "Headmaster of Hogwarts School of Witchcraft and Wizardry",
                "avatar_url": None,
                "care_actions": 0,
                "items_purchased": 0,
                "sanctuary_penalty": 0,
                "created_at": NOW - timedelta(days=1825),
            },
            {
                "id": HERMIONE_ID,
                "name": "Hermione Granger",
                "email": "hermione@nexus.com",
                "password_hash": USER_PWD_HASH,
                "role": "user",
                "zerines": 14205,
                "house_points": 320,
                "house": "Gryffindor",
                "bio": "Brightest witch of her age. Prefect and co-founder of Dumbledore's Army.",
                "avatar_url": None,
                "care_actions": 0,
                "items_purchased": 0,
                "sanctuary_penalty": 0,
                "created_at": NOW - timedelta(days=730),
            },
            {
                "id": LUNA_ID,
                "name": "Luna Lovegood",
                "email": "luna@nexus.com",
                "password_hash": USER_PWD_HASH,
                "role": "user",
                "zerines": 8750,
                "house_points": 180,
                "house": "Ravenclaw",
                "bio": "Believer in the extraordinary. Editor of The Quibbler.",
                "avatar_url": None,
                "care_actions": 0,
                "items_purchased": 0,
                "sanctuary_penalty": 0,
                "created_at": NOW - timedelta(days=420),
            },
            {
                "id": CEDRIC_ID,
                "name": "Cedric Diggory",
                "email": "cedric@nexus.com",
                "password_hash": USER_PWD_HASH,
                "role": "user",
                "zerines": 12300,
                "house_points": 250,
                "house": "Hufflepuff",
                "bio": "True Hufflepuff. Triwizard Champion and all-around good person.",
                "avatar_url": None,
                "care_actions": 0,
                "items_purchased": 0,
                "sanctuary_penalty": 0,
                "created_at": NOW - timedelta(days=210),
            },
            {
                "id": HARRY_ID,
                "name": "Harry Potter",
                "email": "harry@nexus.com",
                "password_hash": USER_PWD_HASH,
                "role": "user",
                "zerines": 22100,
                "house_points": 410,
                "house": "Gryffindor",
                "bio": "The Boy Who Lived. Savior of the Wizarding World.",
                "avatar_url": None,
                "care_actions": 0,
                "items_purchased": 0,
                "sanctuary_penalty": 0,
                "created_at": NOW - timedelta(days=95),
            },
        ],
    )

    # ---------- PRODUCTS ----------
    op.bulk_insert(
        sa.table(
            "products",
            sa.column("id", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.Text),
            sa.column("price", sa.Integer),
            sa.column("category", sa.String),
            sa.column("shop", sa.String),
            sa.column("image_url", sa.String),
            sa.column("stock", sa.Integer),
            sa.column("weekly_sales", sa.Integer),
            sa.column("created_at", sa.DateTime),
        ),
        [
            # Borgin & Burkes
            {"id": "10000000-0000-0000-0000-000000000001", "name": "Espejo de Oesed", "description": "The Mirror of Erised shows the deepest desire of the heart. Be warned, it can drive one to madness.", "price": 850, "category": "Reliquia Rara", "shop": "borgin", "image_url": None, "stock": 3, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000002", "name": "Grito de la Banshee", "description": "A scream that can be heard only by the person it's meant for. Useful for dark rituals.", "price": 1200, "category": "Objeto Oscuro", "shop": "borgin", "image_url": None, "stock": 5, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000003", "name": "Caliz de Helga", "description": "Cup of Helga Hufflepuff, one of the founder's relics. Genuinely rare collectible.", "price": 2500, "category": "Reliquia Histórica", "shop": "borgin", "image_url": None, "stock": 1, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000004", "name": "Sombrero Seleccionador", "description": "The Sorting Hat that determined the houses of every Hogwarts student. Needs restocking.", "price": 3000, "category": "Artefacto", "shop": "borgin", "image_url": None, "stock": 2, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000005", "name": "Pluma Bicorne", "description": "A two-horned quill that writes by itself. Occasionally writes poetry.", "price": 450, "category": "Curiosidad", "shop": "borgin", "image_url": None, "stock": 10, "weekly_sales": 0, "created_at": NOW},
            # Flourish & Blotts
            {"id": "10000000-0000-0000-0000-000000000006", "name": "Libro Hechizos Avanzados", "description": "Advanced spellbook covering N.E.W.T. level charms, jinxes, and counter-jinxes.", "price": 250, "category": "Hechizos", "shop": "flourish", "image_url": None, "stock": 20, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000007", "name": "Historia de la Magia", "description": "A comprehensive history of magic from ancient Egypt to modern day Ministry regulations.", "price": 420, "category": "Historia", "shop": "flourish", "image_url": None, "stock": 15, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000008", "name": "Set de Hierbas Medicinales", "description": "Premium magical herb growing kit with Mandrake seeds, Moly, and watering enchantments.", "price": 180, "category": "Botánica", "shop": "flourish", "image_url": None, "stock": 25, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000009", "name": "Defensa Contra Artes Oscuras", "description": "The definitive guide to defending against the Dark Arts, by Gilderoy Lockhart (revised edition).", "price": 95, "category": "D.C.A.O.", "shop": "flourish", "image_url": None, "stock": 30, "weekly_sales": 0, "created_at": NOW},
            {"id": "10000000-0000-0000-0000-000000000010", "name": "Guia de Animales Fantasticos", "description": "Newt Scamander's field guide to magical creatures with stunning illustrations.", "price": 310, "category": "Zoología", "shop": "flourish", "image_url": None, "stock": 18, "weekly_sales": 0, "created_at": NOW},
        ],
    )

    # ---------- CREATURES ----------
    op.bulk_insert(
        sa.table(
            "creatures",
            sa.column("id", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.Text),
            sa.column("rarity", sa.String),
            sa.column("pet_type", sa.String),
            sa.column("price", sa.Integer),
            sa.column("required_user_level", sa.Integer),
            sa.column("required_sanctuary_level", sa.Integer),
            sa.column("ability", sa.Text),
            sa.column("image_url", sa.String),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": "20000000-0000-0000-0000-000000000001", "name": "Fawkes the Phoenix", "description": "A majestic phoenix that can burst into flame and be reborn. Loyal to Dumbledore.", "rarity": "rare", "pet_type": "Aves", "price": 450, "required_user_level": 4, "required_sanctuary_level": 0, "ability": "Renacer de las cenizas una vez al dia.", "image_url": None, "created_at": NOW},
            {"id": "20000000-0000-0000-0000-000000000002", "name": "Niffler", "description": "A small, furry creature attracted to shiny things. Excellent at finding treasure.", "rarity": "uncommon", "pet_type": "Criaturas pequeñas", "price": 320, "required_user_level": 1, "required_sanctuary_level": 0, "ability": "Encuentra Zerines perdidos (+10% al cuidar).", "image_url": None, "created_at": NOW},
            {"id": "20000000-0000-0000-0000-000000000003", "name": "Hedwig the Owl", "description": "A beautiful snowy owl, exceptionally loyal and clever. Perfect for delivering letters.", "rarity": "ethereal", "pet_type": "Aves", "price": 600, "required_user_level": 1, "required_sanctuary_level": 5, "ability": "Entrega mensajes en la medianoche (+25% felicidad al jugar).", "image_url": None, "created_at": NOW},
            {"id": "20000000-0000-0000-0000-000000000004", "name": "Toad", "description": "A common but endearing toad. Trevor the toad enjoys wandering off at parties.", "rarity": "common", "pet_type": "Criaturas pequeñas", "price": 200, "required_user_level": 1, "required_sanctuary_level": 0, "ability": None, "image_url": None, "created_at": NOW},
            {"id": "20000000-0000-0000-0000-000000000005", "name": "Buckbeak the Hippogriff", "description": "A proud and noble hippogriff. Must be approached with respect. Loves fresh fish.", "rarity": "legendary", "pet_type": "Bestias", "price": 5200, "required_user_level": 6, "required_sanctuary_level": 8, "ability": "Vuelo majestuoso: doble de Zerines al cuidar.", "image_url": None, "created_at": NOW},
        ],
    )

    # ---------- ARTICLES ----------
    op.bulk_insert(
        sa.table(
            "articles",
            sa.column("id", sa.String),
            sa.column("title", sa.String),
            sa.column("body", sa.Text),
            sa.column("author_id", sa.String),
            sa.column("category", sa.String),
            sa.column("image_url", sa.String),
            sa.column("featured", sa.Boolean),
            sa.column("pinned", sa.Boolean),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": "30000000-0000-0000-0000-000000000001", "title": "The Lost Crumple-Horned Snorkack: A Field Guide", "body": "For decades, the elusive Crumple-Horned Snorkack has been the subject of much debate among wizarding naturalists. While some dismiss it as pure fantasy, dedicated researchers like Xenophilius Lovegood have spent years tracking these remarkable creatures through the Swedish forests.\n\nRecent evidence suggests that Snorkacks may indeed exist, though they possess an uncanny ability to avoid detection. Their supposed habitat includes deep forest clearings near magical springs, where they feed on enchanted moss and moonstone mushrooms.\n\nKey identification features (according to reports):\n- Spiral-shaped horn approximately 12 inches long\n- Iridescent fur that changes color with the seasons\n- Ability to become invisible when frightened\n- A distinctive humming sound at twilight\n\nIf you believe you have spotted a Snorkack, please report your sighting to The Quibbler.", "author_id": HERMIONE_ID, "category": "Criaturas Mágicas", "image_url": None, "featured": True, "pinned": False, "created_at": NOW},
            {"id": "30000000-0000-0000-0000-000000000002", "title": "A Complete Guide to Wizard Chess Strategy", "body": "Wizard chess differs from its Muggle counterpart in one crucial respect: the pieces are alive and have opinions about the strategies being employed. This guide covers advanced tactics while also addressing how to manage disagreements with your pieces.", "author_id": HARRY_ID, "category": "Pasatiempos", "image_url": None, "featured": False, "pinned": False, "created_at": NOW},
            {"id": "30000000-0000-0000-0000-000000000003", "title": "Top 10 Potions Every Student Should Master", "body": "Whether you are preparing for your O.W.L.s or simply want to impress your friends, these ten potions are essential knowledge for any aspiring potioneer. From the classic Wiggenweld Potion to the challenging Felix Felicis, we cover ingredients, techniques, and common mistakes to avoid.", "author_id": LUNA_ID, "category": "Pociones", "image_url": None, "featured": False, "pinned": False, "created_at": NOW},
            {"id": "30000000-0000-0000-0000-000000000004", "title": "The History of Hogwarts Houses", "body": "Hogwarts School of Witchcraft and Wizardry was founded over a thousand years ago by four great witches and wizards: Godric Gryffindor, Helga Hufflepuff, Rowena Ravenclaw, and Salazar Slytherin. Each founder created a house that embodied their values and ideals. The Sorting Hat, enchanted by all four founders, continues to place students in the house best suited to their character.", "author_id": ADMIN_ID, "category": "Historia", "image_url": None, "featured": False, "pinned": False, "created_at": NOW},
            {"id": "30000000-0000-0000-0000-000000000005", "title": "Exploring the Forbidden Forest: What We Know", "body": "The Forbidden Forest surrounding Hogwarts has long been a source of both fascination and danger. While students are strictly forbidden from entering without permission, this article compiles everything known about the forest's inhabitants and secrets, gathered from the notes of Rubeus Hagrid and other qualified experts.", "author_id": CEDRIC_ID, "category": "Exploración", "image_url": None, "featured": False, "pinned": False, "created_at": NOW},
        ],
    )

    # ---------- ANNOUNCEMENTS ----------
    op.bulk_insert(
        sa.table(
            "announcements",
            sa.column("id", sa.String),
            sa.column("body", sa.Text),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": "40000000-0000-0000-0000-000000000001", "body": "La Copa de las Casas arranca el próximo viernes en el Gran Salon", "created_at": NOW},
            {"id": "40000000-0000-0000-0000-000000000002", "body": "Nuevas reglas para el Santuario de Mascotas: maximo 3 criaturas por estudiante", "created_at": NOW},
            {"id": "40000000-0000-0000-0000-000000000003", "body": "Flourish & Blotts ofrece un 20% de descuento en libros de pociones esta semana", "created_at": NOW},
        ],
    )

    # ---------- CLASSIFIEDS ----------
    op.bulk_insert(
        sa.table(
            "classifieds",
            sa.column("id", sa.String),
            sa.column("title", sa.String),
            sa.column("price", sa.String),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": "50000000-0000-0000-0000-000000000001", "title": "Vendo escoba Nimbus 2001", "price": "150 Zerines", "created_at": NOW},
            {"id": "50000000-0000-0000-0000-000000000002", "title": "Se buscan voluntarios para Hogsmeade", "price": "Gratis", "created_at": NOW},
            {"id": "50000000-0000-0000-0000-000000000003", "title": "Intercambio de cartas de Quidditch", "price": "A convenir", "created_at": NOW},
        ],
    )

    # ---------- MESSAGES ----------
    op.bulk_insert(
        sa.table(
            "messages",
            sa.column("id", sa.String),
            sa.column("sender_id", sa.String),
            sa.column("receiver_id", sa.String),
            sa.column("body", sa.Text),
            sa.column("read", sa.Boolean),
            sa.column("kind", sa.String),
            sa.column("forwarded", sa.Boolean),
            sa.column("starred", sa.Boolean),
            sa.column("pinned", sa.Boolean),
            sa.column("edited", sa.Boolean),
            sa.column("e2e_encrypted", sa.Boolean),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": "60000000-0000-0000-0000-000000000001", "sender_id": HARRY_ID, "receiver_id": HERMIONE_ID, "body": "Hermione, have you seen the new Potions book at Flourish & Blotts?", "read": True, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000002", "sender_id": HERMIONE_ID, "receiver_id": HARRY_ID, "body": "Yes! I already bought two copies. The chapter on advanced potion-making is fascinating.", "read": True, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000003", "sender_id": HARRY_ID, "receiver_id": HERMIONE_ID, "body": "Of course you did. Want to study together later?", "read": True, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000004", "sender_id": HERMIONE_ID, "receiver_id": HARRY_ID, "body": "The library at 4pm? I'll save us a table near the Restricted Section.", "read": False, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000005", "sender_id": LUNA_ID, "receiver_id": HARRY_ID, "body": "Harry! I saw a Wrackspurt near the Charms corridor today. Very unusual!", "read": False, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000006", "sender_id": CEDRIC_ID, "receiver_id": LUNA_ID, "body": "Luna, that's interesting! What did it look like?", "read": True, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000007", "sender_id": LUNA_ID, "receiver_id": CEDRIC_ID, "body": "Invisible, obviously. But you could feel its presence. Like a tickle in your brain.", "read": True, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
            {"id": "60000000-0000-0000-0000-000000000008", "sender_id": ADMIN_ID, "receiver_id": HARRY_ID, "body": "Mr. Potter, please report to my office at your earliest convenience.", "read": True, "kind": "text", "forwarded": False, "starred": False, "pinned": False, "edited": False, "e2e_encrypted": False, "created_at": NOW},
        ],
    )

    # ---------- POSTS ----------
    post_ids = [
        "70000000-0000-0000-0000-000000000001",
        "70000000-0000-0000-0000-000000000002",
        "70000000-0000-0000-0000-000000000003",
        "70000000-0000-0000-0000-000000000004",
        "70000000-0000-0000-0000-000000000005",
        "70000000-0000-0000-0000-000000000006",
    ]

    op.bulk_insert(
        sa.table(
            "posts",
            sa.column("id", sa.String),
            sa.column("author_id", sa.String),
            sa.column("body", sa.Text),
            sa.column("image_url", sa.String),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": post_ids[0], "author_id": HARRY_ID, "body": "Just had the most amazing Quidditch practice! The new Firebolt is incredible. Anyone up for a match this weekend? 🧹⚡", "image_url": None, "created_at": NOW},
            {"id": post_ids[1], "author_id": HERMIONE_ID, "body": "Studying for N.E.W.T.s in the library. If anyone needs help with Charms, I'll be here until closing.", "image_url": None, "created_at": NOW},
            {"id": post_ids[2], "author_id": LUNA_ID, "body": "Good morning! The Nargles were particularly active near the mistletoe today. Has anyone seen my Spectrespecs? 🦋", "image_url": None, "created_at": NOW},
            {"id": post_ids[3], "author_id": CEDRIC_ID, "body": "Hufflepuff common room is so cozy today. Made some hot chocolate for everyone! Come and get some 🍫", "image_url": None, "created_at": NOW},
            {"id": post_ids[4], "author_id": ADMIN_ID, "body": "Welcome to the Nexus Lumière  ! This platform connects all members of the wizarding community. Please read the community guidelines pinned above.", "image_url": None, "created_at": NOW},
            {"id": post_ids[5], "author_id": HARRY_ID, "body": "Another great day at Hogwarts! 🧙‍♂️✨", "image_url": None, "created_at": NOW},
        ],
    )

    # ---------- POST LIKES ----------
    op.bulk_insert(
        sa.table(
            "post_likes",
            sa.column("post_id", sa.String),
            sa.column("user_id", sa.String),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"post_id": post_ids[0], "user_id": HERMIONE_ID, "created_at": NOW},
            {"post_id": post_ids[0], "user_id": LUNA_ID, "created_at": NOW},
            {"post_id": post_ids[0], "user_id": CEDRIC_ID, "created_at": NOW},
            {"post_id": post_ids[1], "user_id": HARRY_ID, "created_at": NOW},
            {"post_id": post_ids[1], "user_id": LUNA_ID, "created_at": NOW},
            {"post_id": post_ids[2], "user_id": HARRY_ID, "created_at": NOW},
            {"post_id": post_ids[2], "user_id": HERMIONE_ID, "created_at": NOW},
            {"post_id": post_ids[2], "user_id": CEDRIC_ID, "created_at": NOW},
            {"post_id": post_ids[2], "user_id": ADMIN_ID, "created_at": NOW},
            {"post_id": post_ids[3], "user_id": HARRY_ID, "created_at": NOW},
            {"post_id": post_ids[3], "user_id": HERMIONE_ID, "created_at": NOW},
            {"post_id": post_ids[3], "user_id": LUNA_ID, "created_at": NOW},
            {"post_id": post_ids[4], "user_id": HARRY_ID, "created_at": NOW},
            {"post_id": post_ids[4], "user_id": HERMIONE_ID, "created_at": NOW},
            {"post_id": post_ids[4], "user_id": LUNA_ID, "created_at": NOW},
            {"post_id": post_ids[4], "user_id": CEDRIC_ID, "created_at": NOW},
        ],
    )

    # ---------- TRANSACTIONS ----------
    start_of_week = (NOW - timedelta(days=NOW.weekday())).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)

    def day_of_week(offset: int, hour: int = 10) -> datetime:
        d = start_of_week + timedelta(days=offset)
        return d.replace(hour=hour, minute=(offset * 7) % 60, second=0, microsecond=0)

    op.bulk_insert(
        sa.table(
            "transactions",
            sa.column("id", sa.String),
            sa.column("sender_id", sa.String),
            sa.column("receiver_id", sa.String),
            sa.column("amount", sa.Integer),
            sa.column("type", sa.String),
            sa.column("description", sa.Text),
            sa.column("status", sa.String),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": "90000000-0000-0000-0000-000000000001", "sender_id": ADMIN_ID, "receiver_id": HARRY_ID, "amount": 5000, "type": "transfer", "description": "Bono de bienvenida a Nexus Lumière", "status": "confirmed", "created_at": day_of_week(0, 9)},
            {"id": "90000000-0000-0000-0000-000000000002", "sender_id": ADMIN_ID, "receiver_id": HERMIONE_ID, "amount": 3000, "type": "transfer", "description": "Premio a la excelencia académica", "status": "confirmed", "created_at": day_of_week(1, 11)},
            {"id": "90000000-0000-0000-0000-000000000003", "sender_id": HARRY_ID, "receiver_id": HERMIONE_ID, "amount": 200, "type": "transfer", "description": "Por esos apuntes de Encantamientos", "status": "confirmed", "created_at": day_of_week(2, 15)},
            {"id": "90000000-0000-0000-0000-000000000004", "sender_id": ADMIN_ID, "receiver_id": CEDRIC_ID, "amount": 1500, "type": "transfer", "description": "Contribución al Torneo de los Tres Magos", "status": "completed", "created_at": day_of_week(3, 14)},
            {"id": "90000000-0000-0000-0000-000000000005", "sender_id": HERMIONE_ID, "receiver_id": LUNA_ID, "amount": 100, "type": "transfer", "description": "Por la suscripción a El Quisquilloso", "status": "confirmed", "created_at": day_of_week(4, 17)},
            {"id": "90000000-0000-0000-0000-000000000006", "sender_id": None, "receiver_id": ADMIN_ID, "amount": 10000, "type": "deposit", "description": "Depósito inicial de tesorería", "status": "completed", "created_at": day_of_week(5, 10)},
            {"id": "90000000-0000-0000-0000-000000000007", "sender_id": HARRY_ID, "receiver_id": None, "amount": 500, "type": "purchase", "description": "Compra de Niffler en la tienda de criaturas", "status": "confirmed", "created_at": day_of_week(6, 18)},
            {"id": "90000000-0000-0000-0000-000000000008", "sender_id": LUNA_ID, "receiver_id": None, "amount": 310, "type": "purchase", "description": "Compra de Guia de Animales Fantasticos", "status": "confirmed", "created_at": day_of_week(6, 19)},
        ],
    )

    # ---------- PET ITEMS ----------
    op.bulk_insert(
        sa.table(
            "pet_items",
            sa.column("id", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.Text),
            sa.column("kind", sa.String),
            sa.column("pet_type", sa.String),
            sa.column("price", sa.Integer),
            sa.column("restore_amount", sa.Integer),
            sa.column("pack_size", sa.Integer),
            sa.column("image_url", sa.String),
            sa.column("created_at", sa.DateTime),
        ),
        [
            # AVIAN
            {"id": "a0000000-0000-0000-0000-000000000001", "name": "Semillas de Fenix", "description": "Semillas doradas que reavivan la energia de las aves magicas.", "kind": "food", "pet_type": "Aves", "price": 40, "restore_amount": 15, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000002", "name": "Bayas Incandescentes", "description": "Bayas calidas ideales para fenix y lechuzas hambrientas.", "kind": "food", "pet_type": "Aves", "price": 90, "restore_amount": 30, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000003", "name": "Ratones de Campo Frescos", "description": "Presa natural para lechuzas; muy nutritiva.", "kind": "food", "pet_type": "Aves", "price": 180, "restore_amount": 55, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000004", "name": "Festin de Salmon Ahumado", "description": "Un banquete premium que sacia por completo a cualquier ave.", "kind": "food", "pet_type": "Aves", "price": 350, "restore_amount": 85, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000005", "name": "Racion Diaria de Semillas", "description": "Bolsa con varias raciones de semillas para el dia a dia.", "kind": "food", "pet_type": "Aves", "price": 150, "restore_amount": 15, "pack_size": 5, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000006", "name": "Aro Flamigero", "description": "Un aro encantado que las aves persiguen felices.", "kind": "toy", "pet_type": "Aves", "price": 45, "restore_amount": 15, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000007", "name": "Campanilla Encantada", "description": "Tintinea con melodias que animan a las lechuzas.", "kind": "toy", "pet_type": "Aves", "price": 95, "restore_amount": 32, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000008", "name": "Percha Giratoria Mágica", "description": "Una percha que gira suavemente; horas de diversion.", "kind": "toy", "pet_type": "Aves", "price": 190, "restore_amount": 58, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "a0000000-0000-0000-0000-000000000009", "name": "Plumas Danzantes", "description": "Set de plumas que flotan y bailan solas.", "kind": "toy", "pet_type": "Aves", "price": 120, "restore_amount": 18, "pack_size": 4, "image_url": None, "created_at": NOW},
            # BESTIAS
            {"id": "b0000000-0000-0000-0000-000000000001", "name": "Huron Fresco", "description": "Bocado favorito de los hipogrifos.", "kind": "food", "pet_type": "Bestias", "price": 50, "restore_amount": 15, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000002", "name": "Pescado del Lago Negro", "description": "Pescado fresco que encanta a las bestias nobles.", "kind": "food", "pet_type": "Bestias", "price": 100, "restore_amount": 30, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000003", "name": "Cesta de Carne Premium", "description": "Carne selecta para saciar a las criaturas mas grandes.", "kind": "food", "pet_type": "Bestias", "price": 200, "restore_amount": 55, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000004", "name": "Banquete Real de Bestia", "description": "El festin definitivo; sacia por completo a la bestia.", "kind": "food", "pet_type": "Bestias", "price": 380, "restore_amount": 90, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000005", "name": "Saco de Hurones", "description": "Varios hurones para toda la semana.", "kind": "food", "pet_type": "Bestias", "price": 210, "restore_amount": 16, "pack_size": 5, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000006", "name": "Pelota de Cuero de Dragon", "description": "Resistente y rebota alto; ideal para bestias energeticas.", "kind": "toy", "pet_type": "Bestias", "price": 55, "restore_amount": 15, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000007", "name": "Lazo Volador", "description": "Un lazo encantado para juegos de persecucion.", "kind": "toy", "pet_type": "Bestias", "price": 110, "restore_amount": 33, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000008", "name": "Muneco de Entrenamiento", "description": "Muneco robusto que aguanta las embestidas mas fuertes.", "kind": "toy", "pet_type": "Bestias", "price": 210, "restore_amount": 60, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "b0000000-0000-0000-0000-000000000009", "name": "Set de Aros de Vuelo", "description": "Varios aros para montar circuitos de vuelo.", "kind": "toy", "pet_type": "Bestias", "price": 180, "restore_amount": 22, "pack_size": 3, "image_url": None, "created_at": NOW},
            # CRITTER
            {"id": "c0000000-0000-0000-0000-000000000001", "name": "Gusarajos", "description": "El aperitivo clasico para criaturas pequenas.", "kind": "food", "pet_type": "Criaturas pequeñas", "price": 35, "restore_amount": 15, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000002", "name": "Escarabajos Crujientes", "description": "Crujientes y nutritivos; les encantan.", "kind": "food", "pet_type": "Criaturas pequeñas", "price": 85, "restore_amount": 30, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000003", "name": "Bufe de Tesoros Comestibles", "description": "Golosinas brillantes que sacian y alegran.", "kind": "food", "pet_type": "Criaturas pequeñas", "price": 170, "restore_amount": 55, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000004", "name": "Festin del Niffler", "description": "Un banquete dorado que deja al niffler pleno.", "kind": "food", "pet_type": "Criaturas pequeñas", "price": 320, "restore_amount": 82, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000005", "name": "Bolsa de Gusarajos", "description": "Multiples raciones de gusarajos.", "kind": "food", "pet_type": "Criaturas pequeñas", "price": 140, "restore_amount": 15, "pack_size": 5, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000006", "name": "Bolitas Brillantes", "description": "Bolitas relucientes que los nifflers adoran perseguir.", "kind": "toy", "pet_type": "Criaturas pequeñas", "price": 40, "restore_amount": 15, "pack_size": 5, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000007", "name": "Rueda Giratoria", "description": "Una rueda para que corran sin parar.", "kind": "toy", "pet_type": "Criaturas pequeñas", "price": 90, "restore_amount": 30, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000008", "name": "Cubo Excavador", "description": "Un cubo lleno de rincones para escarbar tesoros.", "kind": "toy", "pet_type": "Criaturas pequeñas", "price": 175, "restore_amount": 55, "pack_size": 1, "image_url": None, "created_at": NOW},
            {"id": "c0000000-0000-0000-0000-000000000009", "name": "Piezas de Lego Mágico", "description": "Piezas encantadas para construir y jugar; se venden por lote.", "kind": "toy", "pet_type": "Criaturas pequeñas", "price": 100, "restore_amount": 20, "pack_size": 5, "image_url": None, "created_at": NOW},
        ],
    )

    # ---------- FEATURE FLAGS ----------
    op.bulk_insert(
        sa.table(
            "feature_flags",
            sa.column("key", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.Text),
            sa.column("enabled", sa.Boolean),
            sa.column("category", sa.String),
            sa.column("hidden", sa.Boolean),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {"key": "dashboard.winning_house", "name": "Casa Ganadora (Dashboard Admin)", "description": "Muestra la sección 'Casa Ganadora' con el ranking de puntos por casa en el dashboard de administrador.", "enabled": False, "category": "dashboard", "hidden": False, "created_at": NOW, "updated_at": NOW},
            {"key": "treasury.withdraw", "name": "Retirar Zerines (Tesorería)", "description": "Habilita la pestaña 'Retirar' en la Cámara de Tesorería para que los usuarios puedan retirar zerines.", "enabled": False, "category": "treasury", "hidden": False, "created_at": NOW, "updated_at": NOW},
            {"key": "pets.market", "name": "Mercado de Mascotas (La Menajería)", "description": "Habilita la pestaña 'Mercado' y la opción de poner mascotas en venta en La Menajería Susurrante.", "enabled": False, "category": "pets", "hidden": False, "created_at": NOW, "updated_at": NOW},
            {"key": "events.enabled", "name": "Eventos en Grupos", "description": "Habilita la creación y gestión de eventos en las salas de chat. Los administradores y moderadores pueden crear eventos con RSVP, recordatorios y canales de voz.", "enabled": True, "category": "events", "hidden": False, "created_at": NOW, "updated_at": NOW},
            # The initial_seed_done flag (hidden system flag)
            {"key": "system.initial_seed_done", "name": "Seed inicial completado", "description": "Marca interna que evita re-ejecutar los seeds de datos en cada arranque.", "enabled": True, "category": "system", "hidden": True, "created_at": NOW, "updated_at": NOW},
        ],
    )

    # ---------- ENUM CATEGORIES & VALUES ----------
    # We need to insert categories first, then values referencing them.
    # Use fixed IDs for categories so we can reference them.
    cat_ids = {
        "pet_type": "e0000000-0000-0000-0000-000000000001",
        "book_category": "e0000000-0000-0000-0000-000000000002",
        "article_category": "e0000000-0000-0000-0000-000000000003",
        "borgin_category": "e0000000-0000-0000-0000-000000000004",
    }

    op.bulk_insert(
        sa.table(
            "enum_categories",
            sa.column("id", sa.String),
            sa.column("code", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.Text),
            sa.column("is_system", sa.Boolean),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": cat_ids["pet_type"], "code": "pet_type", "name": "Tipo de Mascota", "description": "Clasificación de criaturas mágicas por tipo (campo Creature.pet_type)", "is_system": True, "created_at": NOW},
            {"id": cat_ids["book_category"], "code": "book_category", "name": "Categoría de Libro", "description": "Categorías de productos de Flourish & Blotts (campo Product.category con shop=flourish)", "is_system": True, "created_at": NOW},
            {"id": cat_ids["article_category"], "code": "article_category", "name": "Categoría de Artículo", "description": "Categorías de artículos de El Quisquilloso (campo Article.category)", "is_system": True, "created_at": NOW},
            {"id": cat_ids["borgin_category"], "code": "borgin_category", "name": "Categoría de Producto (Borgin)", "description": "Categorías de artefactos oscuros de Borgin & Burkes (campo Product.category con shop=borgin)", "is_system": True, "created_at": NOW},
        ],
    )

    op.bulk_insert(
        sa.table(
            "enum_values",
            sa.column("id", sa.String),
            sa.column("category_id", sa.String),
            sa.column("label", sa.String),
            sa.column("description", sa.Text),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            # pet_type
            {"id": "f0000000-0000-0000-0000-000000000001", "category_id": cat_ids["pet_type"], "label": "Aves", "description": "Aves y criaturas voladoras", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000002", "category_id": cat_ids["pet_type"], "label": "Bestias", "description": "Grandes bestias mágicas", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000003", "category_id": cat_ids["pet_type"], "label": "Criaturas pequeñas", "description": "Criaturas pequeñas y roedores", "created_at": NOW, "updated_at": NOW},
            # book_category
            {"id": "f0000000-0000-0000-0000-000000000004", "category_id": cat_ids["book_category"], "label": "Hechizos", "description": "Libros de hechizos y encantamientos", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000005", "category_id": cat_ids["book_category"], "label": "Historia", "description": "Historia de la magia", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000006", "category_id": cat_ids["book_category"], "label": "Botánica", "description": "Herbología y plantas mágicas", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000007", "category_id": cat_ids["book_category"], "label": "D.C.A.O.", "description": "Defensa Contra las Artes Oscuras", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000008", "category_id": cat_ids["book_category"], "label": "Zoología", "description": "Guías de criaturas mágicas", "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000009", "category_id": cat_ids["book_category"], "label": "Pociones", "description": "Libros de pociones", "created_at": NOW, "updated_at": NOW},
            # article_category
            {"id": "f0000000-0000-0000-0000-000000000010", "category_id": cat_ids["article_category"], "label": "Criaturas Mágicas", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000011", "category_id": cat_ids["article_category"], "label": "Pasatiempos", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000012", "category_id": cat_ids["article_category"], "label": "Pociones", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000013", "category_id": cat_ids["article_category"], "label": "Historia", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000014", "category_id": cat_ids["article_category"], "label": "Exploración", "description": None, "created_at": NOW, "updated_at": NOW},
            # borgin_category
            {"id": "f0000000-0000-0000-0000-000000000015", "category_id": cat_ids["borgin_category"], "label": "Reliquia Rara", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000016", "category_id": cat_ids["borgin_category"], "label": "Objeto Oscuro", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000017", "category_id": cat_ids["borgin_category"], "label": "Reliquia Histórica", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000018", "category_id": cat_ids["borgin_category"], "label": "Artefacto", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000019", "category_id": cat_ids["borgin_category"], "label": "Curiosidad", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000020", "category_id": cat_ids["borgin_category"], "label": "Reliquia Oscura", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000021", "category_id": cat_ids["borgin_category"], "label": "Objeto Maldito", "description": None, "created_at": NOW, "updated_at": NOW},
            {"id": "f0000000-0000-0000-0000-000000000022", "category_id": cat_ids["borgin_category"], "label": "Varita", "description": None, "created_at": NOW, "updated_at": NOW},
        ],
    )


def downgrade() -> None:
    # Delete in reverse order of dependencies
    op.execute("DELETE FROM enum_values")
    op.execute("DELETE FROM enum_categories")
    op.execute("DELETE FROM feature_flags WHERE key IN ('dashboard.winning_house', 'treasury.withdraw', 'pets.market', 'events.enabled', 'system.initial_seed_done')")
    op.execute("DELETE FROM pet_items")
    op.execute("DELETE FROM transactions")
    op.execute("DELETE FROM post_likes")
    op.execute("DELETE FROM posts")
    op.execute("DELETE FROM messages")
    op.execute("DELETE FROM classifieds")
    op.execute("DELETE FROM announcements")
    op.execute("DELETE FROM articles")
    op.execute("DELETE FROM creatures")
    op.execute("DELETE FROM products")
    op.execute("DELETE FROM users WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005')")