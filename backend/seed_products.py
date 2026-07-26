import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.product import Product
from app.models.user import User
from sqlalchemy import select

async def seed_products():
    async with async_session() as db:
        # Flourish & Blotts products
        flourish_products = [
            Product(
                id=str(uuid.uuid4()),
                name="Libro Estandar de Hechizos (Grado 1)",
                description="El manual basico para todo estudiante de Hogwarts. Contiene hechizos esenciales como Wingardium Leviosa, Lumos y Alohomora.",
                price=250,
                category="Encantamientos",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=50,
                weekly_sales=12,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Una Historia de la Magia",
                description="Un recorrido fascinante por la historia magica desde la antiguedad hasta la actualidad. Escrito por Bathilda Bagshot.",
                price=420,
                category="Historia",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=30,
                weekly_sales=8,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Mil Hierbas Magicas y Hongos",
                description="La guia definitiva de botanica magica. Incluye propiedades, usos y cuidados de mas de 1000 especies.",
                price=180,
                category="Pociones",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=40,
                weekly_sales=15,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Bases de Defensa Contra las Artes Oscuras",
                description="Manual de proteccion contra maldiciones, maleficios y criaturas oscuras. Indispensable para la clase de D.C.A.O.",
                price=95,
                category="D.C.A.O.",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=60,
                weekly_sales=20,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Animales Fantasticos y Donde Encontrarlos",
                description="La obra maestra de Newt Scamander. Catalogo completo de criaturas magicas con clasificacion de peligro del Ministerio.",
                price=310,
                category="Zoologia",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=25,
                weekly_sales=18,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Libro de Hechizos Avanzados (Grado 3)",
                description="Para estudiantes con base solida. Incluye Patronus, hechizos de silencio y transformaciones complejas.",
                price=480,
                category="Encantamientos",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=20,
                weekly_sales=5,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Elaboracion de Pociones Intermedia",
                description="Recetas paso a paso para pociones como Polijugos, Felix Felicis y Amortentia. Con consejos de Slughorn.",
                price=350,
                category="Pociones",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=35,
                weekly_sales=10,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Tratado de Adivinacion y Profecias",
                description="Metodos de lectura de hojas de te, bola de cristal, runas y suenos. Incluye interpretaciones de Sibila Trelawney.",
                price=220,
                category="Adivinacion",
                shop="flourish",
                image_url="/placeholder-book.jpg",
                stock=15,
                weekly_sales=3,
                created_at=datetime.utcnow(),
            ),
        ]

        # Borgin & Burkes products
        borgin_products = [
            Product(
                id=str(uuid.uuid4()),
                name="Espejo de Oesed",
                description="Muestra el deseo mas profundo de quien lo mira. Reliquia antigua con marco de madera oscura tallada a mano.",
                price=850,
                category="Reliquia Rara",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=3,
                weekly_sales=2,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Grito de la Banshee",
                description="Objeto oscurecido que emite un chillido mortal al ser abierto. Solo para coleccionistas expertos en artes oscuras.",
                price=1200,
                category="Objeto Oscuro",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=2,
                weekly_sales=1,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Caliz de Helga Hufflepuff",
                description="Una replica exacta del caliz original, con grabados antiguos. Pieza de exhibicion para verdaderos conocedores.",
                price=2500,
                category="Reliquia Historica",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=1,
                weekly_sales=0,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Sombrero Seleccionador (usado)",
                description="El sombrero original que selecciono a generaciones de estudiantes. Aun murmura las casas al ponerselo.",
                price=3000,
                category="Artefacto",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=1,
                weekly_sales=0,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Pluma Bicorne de Newt",
                description="Pluma perteneciente al magizoologo Newt Scamander. Escribe sola lo que el usuario piensa en lenguas antiguas.",
                price=450,
                category="Curiosidad",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=5,
                weekly_sales=3,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Anillo de los Gaunt",
                description="Anillo con la piedra de la resurreccion (simbolo). Replica del horrocrux de Marvolo Gaunt. No funcional.",
                price=1800,
                category="Reliquia Oscura",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=1,
                weekly_sales=0,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Collar de Opalos Maldito",
                description="Joya que trae mala suerte a quien la porta. Historia documentada en el Callejón Knockturn desde 1800.",
                price=950,
                category="Objeto Maldito",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=2,
                weekly_sales=1,
                created_at=datetime.utcnow(),
            ),
            Product(
                id=str(uuid.uuid4()),
                name="Varita de Sauco (replica)",
                description="Replica fiel de la Varita del Destino. Nucleo de pelo de Thestral, madera de sauco. Solo decorativa.",
                price=1500,
                category="Varita",
                shop="borgin",
                image_url="/placeholder-artifact.jpg",
                stock=3,
                weekly_sales=2,
                created_at=datetime.utcnow(),
            ),
        ]

        for p in flourish_products + borgin_products:
            db.add(p)

        await db.commit()
        print(f"Seeded {len(flourish_products)} Flourish products and {len(borgin_products)} Borgin products")

if __name__ == "__main__":
    asyncio.run(seed_products())