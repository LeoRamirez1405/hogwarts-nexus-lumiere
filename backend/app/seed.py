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
            house="Gryffindor",
            bio="Headmaster of Hogwarts School of Witchcraft and Wizardry",
            avatar_url="/placeholder-avatar.svg",
            created_at=datetime.now() - timedelta(days=1825),
        )

        hermione = User(
            name="Hermione Granger",
            email="hermione@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=14205,
            house="Gryffindor",
            bio="Brightest witch of her age. Prefect and co-founder of Dumbledore's Army.",
            avatar_url="/placeholder-avatar.svg",
            created_at=datetime.now() - timedelta(days=730),
        )

        luna = User(
            name="Luna Lovegood",
            email="luna@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=8750,
            house="Ravenclaw",
            bio="Believer in the extraordinary. Editor of The Quibbler.",
            avatar_url="/placeholder-avatar.svg",
            created_at=datetime.now() - timedelta(days=420),
        )

        cedric = User(
            name="Cedric Diggory",
            email="cedric@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=12300,
            house="Hufflepuff",
            bio="True Hufflepuff. Triwizard Champion and all-around good person.",
            avatar_url="/placeholder-avatar.svg",
            created_at=datetime.now() - timedelta(days=210),
        )

        harry = User(
            name="Harry Potter",
            email="harry@nexus.com",
            password_hash=hash_password("user123"),
            role="user",
            zerines=22100,
            house="Gryffindor",
            bio="The Boy Who Lived. Savior of the Wizarding World.",
            avatar_url="/placeholder-avatar.svg",
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
                image_url="/placeholder-generic.svg",
                stock=3,
            ),
            Product(
                name="Grito de la Banshee",
                description="A scream that can be heard only by the person it's meant for. Useful for dark rituals.",
                price=1200,
                category="Dark Arts",
                shop="borgin",
                image_url="/placeholder-generic.svg",
                stock=5,
            ),
            Product(
                name="Caliz de Helga",
                description="Cup of Helga Hufflepuff, one of the founder's relics. Genuinely rare collectible.",
                price=2500,
                category="Relics",
                shop="borgin",
                image_url="/placeholder-generic.svg",
                stock=1,
            ),
            Product(
                name="Sombrero Seleccionador",
                description="The Sorting Hat that determined the houses of every Hogwarts student. Needs restocking.",
                price=3000,
                category="Hogwarts",
                shop="borgin",
                image_url="/placeholder-generic.svg",
                stock=2,
            ),
            Product(
                name="Pluma Bicorne",
                description="A two-horned quill that writes by itself. Occasionally writes poetry.",
                price=450,
                category="Writing",
                shop="borgin",
                image_url="/placeholder-generic.svg",
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
                image_url="/placeholder-generic.svg",
                stock=20,
            ),
            Product(
                name="Historia de la Magia",
                description="A comprehensive history of magic from ancient Egypt to modern day Ministry regulations.",
                price=420,
                category="Books",
                shop="flourish",
                image_url="/placeholder-generic.svg",
                stock=15,
            ),
            Product(
                name="Set de Hierbas Medicinales",
                description="Premium magical herb growing kit with Mandrake seeds, Moly, and watering enchantments.",
                price=180,
                category="Herbology",
                shop="flourish",
                image_url="/placeholder-generic.svg",
                stock=25,
            ),
            Product(
                name="Defensa Contra Artes Oscuras",
                description="The definitive guide to defending against the Dark Arts, by Gilderoy Lockhart (revised edition).",
                price=95,
                category="Books",
                shop="flourish",
                image_url="/placeholder-generic.svg",
                stock=30,
            ),
            Product(
                name="Guia de Animales Fantasticos",
                description="Newt Scamander's field guide to magical creatures with stunning illustrations.",
                price=310,
                category="Beasts",
                shop="flourish",
                image_url="/placeholder-generic.svg",
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
                price=450,
                image_url="/placeholder-generic.svg",
            ),
            Creature(
                name="Niffler",
                description="A small, furry creature attracted to shiny things. Excellent at finding treasure.",
                rarity="uncommon",
                price=320,
                image_url="/placeholder-generic.svg",
            ),
            Creature(
                name="Hedwig the Owl",
                description="A beautiful snowy owl, exceptionally loyal and clever. Perfect for delivering letters.",
                rarity="ethereal",
                price=600,
                image_url="/placeholder-generic.svg",
            ),
            Creature(
                name="Toad",
                description="A common but endearing toad. Trevor the toad enjoys wandering off at parties.",
                rarity="common",
                price=200,
                image_url="/placeholder-generic.svg",
            ),
            Creature(
                name="Buckbeak the Hippogriff",
                description="A proud and noble hippogriff. Must be approached with respect. Loves fresh fish.",
                rarity="legendary",
                price=5200,
                image_url="/placeholder-generic.svg",
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
                image_url="/placeholder-generic.svg",
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
                image_url="/placeholder-generic.svg",
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
                image_url="/placeholder-generic.svg",
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
                image_url="/placeholder-generic.svg",
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
                image_url="/placeholder-generic.svg",
                featured=False,
            ),
        ]
        db.add_all(articles)

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
                image_url="/placeholder-generic.svg",
            ),
            Post(
                author_id=hermione.id,
                body="Studying for N.E.W.T.s in the library. If anyone needs help with Charms, I'll be here until closing.",
                image_url="/placeholder-generic.svg",
            ),
            Post(
                author_id=luna.id,
                body="Good morning! The Nargles were particularly active near the mistletoe today. Has anyone seen my Spectrespecs? 🦋",
                image_url="/placeholder-generic.svg",
            ),
            Post(
                author_id=cedric.id,
                body="Hufflepuff common room is so cozy today. Made some hot chocolate for everyone! Come and get some 🍫",
                image_url="/placeholder-generic.svg",
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
