from datetime import datetime, timedelta
from sqlalchemy import select
from .database import async_session
from .models.user import User
from .models.product import Product
from .models.article import Article
from .models.creature import Creature
from .models.user_creature import UserCreature
from .models.message import Message
from .models.post import Post, PostLike
from .models.transaction import Transaction
from .models.announcement import Announcement
from .models.classified import Classified
from .middleware.auth import hash_password


async def seed_data():
    async with async_session() as db:
        existing = await db.execute(select(User).limit(1))
        if existing.scalar_one_or_none():
            return

        # Users (each gets a distinct, realistic join date from the real DB)
        admin = User(
            name="Albus Dumbledore",
            email="admin@nexus.com",
            password_hash=hash_password("admin123"),
            role="admin",
            zerines=50000,
            house_points=500,
            house="Gryffindor",
            bio="Headmaster of Hogwarts School of Witchcraft and Wizardry",
            avatar_url=None,
            created_at=datetime.now() - timedelta(days=1825),
        )

        hermione = User(
            name="Hermione Granger",
            email="hermione@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=14205,
            house_points=320,
            house="Gryffindor",
            bio="Brightest witch of her age. Prefect and co-founder of Dumbledore's Army.",
            avatar_url=None,
            created_at=datetime.now() - timedelta(days=730),
        )

        luna = User(
            name="Luna Lovegood",
            email="luna@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=8750,
            house_points=180,
            house="Ravenclaw",
            bio="Believer in the extraordinary. Editor of The Quibbler.",
            avatar_url=None,
            created_at=datetime.now() - timedelta(days=420),
        )

        cedric = User(
            name="Cedric Diggory",
            email="cedric@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=12300,
            house_points=250,
            house="Hufflepuff",
            bio="True Hufflepuff. Triwizard Champion and all-around good person.",
            avatar_url=None,
            created_at=datetime.now() - timedelta(days=210),
        )

        harry = User(
            name="Harry Potter",
            email="harry@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=22100,
            house_points=410,
            house="Gryffindor",
            bio="The Boy Who Lived. Savior of the Wizarding World.",
            avatar_url=None,
            created_at=datetime.now() - timedelta(days=95),
        )

        db.add_all([admin, hermione, luna, cedric, harry])
        await db.flush()

        # Borgin & Burkes Products
        borgin_products = [
            Product(
                name="Espejo de Oesed",
                description="The Mirror of Erised shows the deepest desire of the heart. Be warned, it can drive one to madness.",
                price=850,
                category="Artifacts",
                shop="borgin",
                image_url=None,
                stock=3,
            ),
            Product(
                name="Grito de la Banshee",
                description="A scream that can be heard only by the person it's meant for. Useful for dark rituals.",
                price=1200,
                category="Dark Arts",
                shop="borgin",
                image_url=None,
                stock=5,
            ),
            Product(
                name="Caliz de Helga",
                description="Cup of Helga Hufflepuff, one of the founder's relics. Genuinely rare collectible.",
                price=2500,
                category="Relics",
                shop="borgin",
                image_url=None,
                stock=1,
            ),
            Product(
                name="Sombrero Seleccionador",
                description="The Sorting Hat that determined the houses of every Hogwarts student. Needs restocking.",
                price=3000,
                category="Hogwarts",
                shop="borgin",
                image_url=None,
                stock=2,
            ),
            Product(
                name="Pluma Bicorne",
                description="A two-horned quill that writes by itself. Occasionally writes poetry.",
                price=450,
                category="Writing",
                shop="borgin",
                image_url=None,
                stock=10,
            ),
        ]

        # Flourish & Blotts Products
        flourish_products = [
            Product(
                name="Libro Hechizos Avanzados",
                description="Advanced spellbook covering N.E.W.T. level charms, jinxes, and counter-jinxes.",
                price=250,
                category="Books",
                shop="flourish",
                image_url=None,
                stock=20,
            ),
            Product(
                name="Historia de la Magia",
                description="A comprehensive history of magic from ancient Egypt to modern day Ministry regulations.",
                price=420,
                category="Books",
                shop="flourish",
                image_url=None,
                stock=15,
            ),
            Product(
                name="Set de Hierbas Medicinales",
                description="Premium magical herb growing kit with Mandrake seeds, Moly, and watering enchantments.",
                price=180,
                category="Herbology",
                shop="flourish",
                image_url=None,
                stock=25,
            ),
            Product(
                name="Defensa Contra Artes Oscuras",
                description="The definitive guide to defending against the Dark Arts, by Gilderoy Lockhart (revised edition).",
                price=95,
                category="Books",
                shop="flourish",
                image_url=None,
                stock=30,
            ),
            Product(
                name="Guia de Animales Fantasticos",
                description="Newt Scamander's field guide to magical creatures with stunning illustrations.",
                price=310,
                category="Beasts",
                shop="flourish",
                image_url=None,
                stock=18,
            ),
        ]
        db.add_all(borgin_products + flourish_products)

        # Creatures
        creatures = [
            Creature(
                name="Fawkes the Phoenix",
                description="A majestic phoenix that can burst into flame and be reborn. Loyal to Dumbledore.",
                rarity="rare",
                pet_type="avian",
                price=450,
                required_user_level=4,
                ability="Renacer de las cenizas una vez al dia.",
                image_url=None,
            ),
            Creature(
                name="Niffler",
                description="A small, furry creature attracted to shiny things. Excellent at finding treasure.",
                rarity="uncommon",
                pet_type="critter",
                price=320,
                ability="Encuentra Zerines perdidos (+10% al cuidar).",
                image_url=None,
            ),
            Creature(
                name="Hedwig the Owl",
                description="A beautiful snowy owl, exceptionally loyal and clever. Perfect for delivering letters.",
                rarity="ethereal",
                pet_type="avian",
                price=600,
                required_sanctuary_level=5,
                ability="Entrega mensajes en la medianoche (+25% felicidad al jugar).",
                image_url=None,
            ),
            Creature(
                name="Toad",
                description="A common but endearing toad. Trevor the toad enjoys wandering off at parties.",
                rarity="common",
                pet_type="critter",
                price=200,
                image_url=None,
            ),
            Creature(
                name="Buckbeak the Hippogriff",
                description="A proud and noble hippogriff. Must be approached with respect. Loves fresh fish.",
                rarity="legendary",
                pet_type="beast",
                price=5200,
                required_user_level=6,
                required_sanctuary_level=8,
                ability="Vuelo majestuoso: doble de Zerines al cuidar.",
                image_url=None,
            ),
        ]
        db.add_all(creatures)

        # Articles
        articles = [
            Article(
                title="The Lost Crumple-Horned Snorkack: A Field Guide",
                body=(
                    "For decades, the elusive Crumple-Horned Snorkack has been the subject of much debate "
                    "among wizarding naturalists. While some dismiss it as pure fantasy, dedicated researchers "
                    "like Xenophilius Lovegood have spent years tracking these remarkable creatures through "
                    "the Swedish forests.\n\n"
                    "Recent evidence suggests that Snorkacks may indeed exist, though they possess an uncanny "
                    "ability to avoid detection. Their supposed habitat includes deep forest clearings near "
                    "magical springs, where they feed on enchanted moss and moonstone mushrooms.\n\n"
                    "Key identification features (according to reports):\n"
                    "- Spiral-shaped horn approximately 12 inches long\n"
                    "- Iridescent fur that changes color with the seasons\n"
                    "- Ability to become invisible when frightened\n"
                    "- A distinctive humming sound at twilight\n\n"
                    "If you believe you have spotted a Snorkack, please report your sighting to The Quibbler."
                ),
                author_id=hermione.id,
                category="Magical Creatures",
                image_url=None,
                featured=True,
            ),
            Article(
                title="A Complete Guide to Wizard Chess Strategy",
                body=(
                    "Wizard chess differs from its Muggle counterpart in one crucial respect: the pieces are alive "
                    "and have opinions about the strategies being employed. This guide covers advanced tactics "
                    "while also addressing how to manage disagreements with your pieces."
                ),
                author_id=harry.id,
                category="Hobbies",
                image_url=None,
                featured=False,
            ),
            Article(
                title="Top 10 Potions Every Student Should Master",
                body=(
                    "Whether you are preparing for your O.W.L.s or simply want to impress your friends, "
                    "these ten potions are essential knowledge for any aspiring potioneer. From the classic "
                    "Wiggenweld Potion to the challenging Felix Felicis, we cover ingredients, techniques, "
                    "and common mistakes to avoid."
                ),
                author_id=luna.id,
                category="Potions",
                image_url=None,
                featured=False,
            ),
            Article(
                title="The History of Hogwarts Houses",
                body=(
                    "Hogwarts School of Witchcraft and Wizardry was founded over a thousand years ago "
                    "by four great witches and wizards: Godric Gryffindor, Helga Hufflepuff, Rowena Ravenclaw, "
                    "and Salazar Slytherin. Each founder created a house that embodied their values and ideals. "
                    "The Sorting Hat, enchanted by all four founders, continues to place students in the house "
                    "best suited to their character."
                ),
                author_id=admin.id,
                category="History",
                image_url=None,
                featured=False,
            ),
            Article(
                title="Exploring the Forbidden Forest: What We Know",
                body=(
                    "The Forbidden Forest surrounding Hogwarts has long been a source of both fascination "
                    "and danger. While students are strictly forbidden from entering without permission, "
                    "this article compiles everything known about the forest's inhabitants and secrets, "
                    "gathered from the notes of Rubeus Hagrid and other qualified experts."
                ),
                author_id=cedric.id,
                category="Exploration",
                image_url=None,
                featured=False,
            ),
        ]
        db.add_all(articles)

        # Announcements (short bulletin texts for /news sidebar)
        announcements_seed = [
            Announcement(
                body="La Copa de las Casas arranca el proximo viernes en el Gran Salon",
            ),
            Announcement(
                body="Nuevas reglas para el Santuario de Mascotas: maximo 3 criaturas por estudiante",
            ),
            Announcement(
                body="Flourish & Blotts ofrece un 20% de descuento en libros de pociones esta semana",
            ),
        ]
        db.add_all(announcements_seed)

        # Classifieds (title + price for /news sidebar)
        classifieds_seed = [
            Classified(
                title="Vendo escoba Nimbus 2001",
                price="150 Zerines",
            ),
            Classified(
                title="Se buscan voluntarios para Hogsmeade",
                price="Gratis",
            ),
            Classified(
                title="Intercambio de cartas de Quidditch",
                price="A convenir",
            ),
        ]
        db.add_all(classifieds_seed)

        # Messages
        messages = [
            Message(
                sender_id=harry.id,
                receiver_id=hermione.id,
                body="Hermione, have you seen the new Potions book at Flourish & Blotts?",
                read=True,
            ),
            Message(
                sender_id=hermione.id,
                receiver_id=harry.id,
                body="Yes! I already bought two copies. The chapter on advanced potion-making is fascinating.",
                read=True,
            ),
            Message(
                sender_id=harry.id,
                receiver_id=hermione.id,
                body="Of course you did. Want to study together later?",
                read=True,
            ),
            Message(
                sender_id=hermione.id,
                receiver_id=harry.id,
                body="The library at 4pm? I'll save us a table near the Restricted Section.",
                read=False,
            ),
            Message(
                sender_id=luna.id,
                receiver_id=harry.id,
                body="Harry! I saw a Wrackspurt near the Charms corridor today. Very unusual!",
                read=False,
            ),
            Message(
                sender_id=cedric.id,
                receiver_id=luna.id,
                body="Luna, that's interesting! What did it look like?",
                read=True,
            ),
            Message(
                sender_id=luna.id,
                receiver_id=cedric.id,
                body="Invisible, obviously. But you could feel its presence. Like a tickle in your brain.",
                read=True,
            ),
            Message(
                sender_id=admin.id,
                receiver_id=harry.id,
                body="Mr. Potter, please report to my office at your earliest convenience.",
                read=True,
            ),
        ]
        db.add_all(messages)

        # Posts
        posts = [
            Post(
                author_id=harry.id,
                body="Just had the most amazing Quidditch practice! The new Firebolt is incredible. Anyone up for a match this weekend? 🧹⚡",
                image_url=None,
            ),
            Post(
                author_id=hermione.id,
                body="Studying for N.E.W.T.s in the library. If anyone needs help with Charms, I'll be here until closing.",
                image_url=None,
            ),
            Post(
                author_id=luna.id,
                body="Good morning! The Nargles were particularly active near the mistletoe today. Has anyone seen my Spectrespecs? 🦋",
                image_url=None,
            ),
            Post(
                author_id=cedric.id,
                body="Hufflepuff common room is so cozy today. Made some hot chocolate for everyone! Come and get some 🍫",
                image_url=None,
            ),
            Post(
                author_id=admin.id,
                body="Welcome to the Nexus Lumiere! This platform connects all members of the wizarding community. Please read the community guidelines pinned above.",
                image_url=None,
            ),
        ]
        db.add_all(posts)
        await db.flush()

        # Post Likes
        likes = [
            PostLike(post_id=posts[0].id, user_id=hermione.id),
            PostLike(post_id=posts[0].id, user_id=luna.id),
            PostLike(post_id=posts[0].id, user_id=cedric.id),
            PostLike(post_id=posts[1].id, user_id=harry.id),
            PostLike(post_id=posts[1].id, user_id=luna.id),
            PostLike(post_id=posts[2].id, user_id=harry.id),
            PostLike(post_id=posts[2].id, user_id=hermione.id),
            PostLike(post_id=posts[2].id, user_id=cedric.id),
            PostLike(post_id=posts[2].id, user_id=admin.id),
            PostLike(post_id=posts[3].id, user_id=harry.id),
            PostLike(post_id=posts[3].id, user_id=hermione.id),
            PostLike(post_id=posts[3].id, user_id=luna.id),
            PostLike(post_id=posts[4].id, user_id=harry.id),
            PostLike(post_id=posts[4].id, user_id=hermione.id),
            PostLike(post_id=posts[4].id, user_id=luna.id),
            PostLike(post_id=posts[4].id, user_id=cedric.id),
        ]
        db.add_all(likes)

        # Transactions (spread across current week, Mon-Sun, aligned to local frontend time)
        now = datetime.now()
        days_since_monday = now.weekday()  # Monday=0, Sunday=6
        start_of_week = (now - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        def day_of_week(offset: int, hour: int = 10) -> datetime:
            d = start_of_week + timedelta(days=offset)
            return d.replace(hour=hour, minute=(offset * 7) % 60, second=0, microsecond=0)

        transactions = [
            Transaction(
                sender_id=admin.id,
                receiver_id=harry.id,
                amount=5000,
                type="transfer",
                description="Welcome bonus to Nexus Lumiere",
                status="confirmed",
                created_at=day_of_week(0, 9),
            ),
            Transaction(
                sender_id=admin.id,
                receiver_id=hermione.id,
                amount=3000,
                type="transfer",
                description="Academic excellence reward",
                status="confirmed",
                created_at=day_of_week(1, 11),
            ),
            Transaction(
                sender_id=harry.id,
                receiver_id=hermione.id,
                amount=200,
                type="transfer",
                description="For those Charms notes",
                status="confirmed",
                created_at=day_of_week(2, 15),
            ),
            Transaction(
                sender_id=admin.id,
                receiver_id=cedric.id,
                amount=1500,
                type="transfer",
                description="Triwizard Tournament contribution",
                status="completed",
                created_at=day_of_week(3, 14),
            ),
            Transaction(
                sender_id=hermione.id,
                receiver_id=luna.id,
                amount=100,
                type="transfer",
                description="For the Quibbler subscription",
                status="confirmed",
                created_at=day_of_week(4, 17),
            ),
            Transaction(
                receiver_id=admin.id,
                amount=10000,
                type="deposit",
                description="Initial treasury deposit",
                status="completed",
                created_at=day_of_week(5, 10),
            ),
            Transaction(
                sender_id=harry.id,
                amount=500,
                type="purchase",
                description="Purchased Niffler from creature shop",
                status="confirmed",
                created_at=day_of_week(6, 18),
            ),
        ]
        db.add_all(transactions)

        await db.commit()


# Keyword-based mapping used to backfill pet_type on pre-existing creatures.
_PET_TYPE_KEYWORDS = [
    ("avian", ("phoenix", "owl", "hippogriff", "griffin", "eagle", "bird", "fawkes", "hedwig")),
    ("beast", ("dragon", "hippogriff", "thestral", "unicorn", "horse", "wolf", "buckbeak")),
]


def _guess_pet_type(name: str) -> str:
    lowered = (name or "").lower()
    # beast keywords take priority over generic avian for hippogriff-like beasts
    if any(k in lowered for k in ("hippogriff", "dragon", "thestral", "unicorn", "buckbeak")):
        return "beast"
    if any(k in lowered for k in ("phoenix", "owl", "eagle", "bird", "fawkes", "hedwig")):
        return "avian"
    return "critter"


# (name, description, kind, pet_type, price, restore_amount, pack_size)
_PET_SUPPLIES = [
    # ---- AVIAN (fénix, lechuza) ----
    ("Semillas de Fenix", "Semillas doradas que reavivan la energia de las aves magicas.", "food", "avian", 40, 15, 1),
    ("Bayas Incandescentes", "Bayas calidas ideales para fenix y lechuzas hambrientas.", "food", "avian", 90, 30, 1),
    ("Ratones de Campo Frescos", "Presa natural para lechuzas; muy nutritiva.", "food", "avian", 180, 55, 1),
    ("Festin de Salmon Ahumado", "Un banquete premium que sacia por completo a cualquier ave.", "food", "avian", 350, 85, 1),
    ("Racion Diaria de Semillas", "Bolsa con varias raciones de semillas para el dia a dia.", "food", "avian", 150, 15, 5),
    ("Aro Flamigero", "Un aro encantado que las aves persiguen felices.", "toy", "avian", 45, 15, 1),
    ("Campanilla Encantada", "Tintinea con melodias que animan a las lechuzas.", "toy", "avian", 95, 32, 1),
    ("Percha Giratoria Magica", "Una percha que gira suavemente; horas de diversion.", "toy", "avian", 190, 58, 1),
    ("Plumas Danzantes", "Set de plumas que flotan y bailan solas.", "toy", "avian", 120, 18, 4),

    # ---- BEAST (hipogrifo y bestias grandes) ----
    ("Huron Fresco", "Bocado favorito de los hipogrifos.", "food", "beast", 50, 15, 1),
    ("Pescado del Lago Negro", "Pescado fresco que encanta a las bestias nobles.", "food", "beast", 100, 30, 1),
    ("Cesta de Carne Premium", "Carne selecta para saciar a las criaturas mas grandes.", "food", "beast", 200, 55, 1),
    ("Banquete Real de Bestia", "El festin definitivo; sacia por completo a la bestia.", "food", "beast", 380, 90, 1),
    ("Saco de Hurones", "Varios hurones para toda la semana.", "food", "beast", 210, 16, 5),
    ("Pelota de Cuero de Dragon", "Resistente y rebota alto; ideal para bestias energicas.", "toy", "beast", 55, 15, 1),
    ("Lazo Volador", "Un lazo encantado para juegos de persecucion.", "toy", "beast", 110, 33, 1),
    ("Muneco de Entrenamiento", "Muneco robusto que aguanta las embestidas mas fuertes.", "toy", "beast", 210, 60, 1),
    ("Set de Aros de Vuelo", "Varios aros para montar circuitos de vuelo.", "toy", "beast", 180, 22, 3),

    # ---- CRITTER (niffler, sapo, pequeños) ----
    ("Gusarajos", "El aperitivo clasico para criaturas pequenas.", "food", "critter", 35, 15, 1),
    ("Escarabajos Crujientes", "Crujientes y nutritivos; les encantan.", "food", "critter", 85, 30, 1),
    ("Bufe de Tesoros Comestibles", "Golosinas brillantes que sacian y alegran.", "food", "critter", 170, 55, 1),
    ("Festin del Niffler", "Un banquete dorado que deja al niffler pleno.", "food", "critter", 320, 82, 1),
    ("Bolsa de Gusarajos", "Multiples raciones de gusarajos.", "food", "critter", 140, 15, 5),
    ("Bolitas Brillantes", "Bolitas relucientes que los nifflers adoran perseguir.", "toy", "critter", 40, 15, 5),
    ("Rueda Giratoria", "Una rueda para que corran sin parar.", "toy", "critter", 90, 30, 1),
    ("Cubo Excavador", "Un cubo lleno de rincones para escarbar tesoros.", "toy", "critter", 175, 55, 1),
    ("Piezas de Lego Magico", "Piezas encantadas para construir y jugar; se venden por lote.", "toy", "critter", 100, 20, 5),
]


async def seed_pet_supplies():
    """Idempotently ensure pet food/toys exist and backfill creature pet_type.

    Runs independently of ``seed_data`` so that databases seeded before the
    pet-supply feature existed still get the catalog and correct pet types.
    """
    from .models.pet_item import PetItem

    async with async_session() as db:
        # Backfill pet_type on creatures still on the default.
        creatures = (await db.execute(select(Creature))).scalars().all()
        changed = False
        for c in creatures:
            if not c.pet_type or c.pet_type == "critter":
                guessed = _guess_pet_type(c.name)
                if guessed != c.pet_type:
                    c.pet_type = guessed
                    changed = True

        existing_item = await db.execute(select(PetItem).limit(1))
        if existing_item.scalar_one_or_none() is None:
            db.add_all([
                PetItem(
                    name=name,
                    description=desc,
                    kind=kind,
                    pet_type=pet_type,
                    price=price,
                    restore_amount=restore,
                    pack_size=pack,
                    image_url=None,
                )
                for (name, desc, kind, pet_type, price, restore, pack) in _PET_SUPPLIES
            ])
            changed = True

        if changed:
            await db.commit()
