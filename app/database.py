"""
Configuración de la base de datos.

Usamos SQLite para empezar porque no requiere instalar nada: la base de datos
es un solo archivo (taller.db). Cuando pasen a producción, cambian esta URL
por la de PostgreSQL y el resto del código sigue funcionando igual, porque
SQLAlchemy se encarga de las diferencias.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# --- Aquí se define DÓNDE vive la base de datos ---
# Para empezar: un archivo local. Para producción (Fase 4+):
#   "postgresql://usuario:clave@localhost/taller"
DATABASE_URL = "sqlite:///./taller.db"

# El "engine" es la conexión con la base de datos.
# connect_args solo es necesario para SQLite.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Cada vez que atendamos una petición, abriremos una "sesión" para hablar
# con la base de datos y la cerraremos al terminar.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Todas nuestras tablas (modelos) heredarán de esta clase Base.
Base = declarative_base()


def get_db():
    """
    Dependencia de FastAPI: entrega una sesión de base de datos a cada
    endpoint y se asegura de cerrarla al final, aunque ocurra un error.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
