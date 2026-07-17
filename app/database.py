"""
Configuración de la base de datos.

Usamos SQLite para desarrollar porque no requiere instalar nada: la base de
datos es un solo archivo (taller.db). Para producción usamos PostgreSQL
(por ejemplo el de Supabase, que tiene un plan gratis), y el resto del
código sigue funcionando igual porque SQLAlchemy traduce las diferencias.

FASE 5 — la URL ahora viene de la variable de entorno DATABASE_URL:

  - Sin definirla  -> SQLite local (desarrollo, como siempre).
  - Con Supabase   -> en el panel de Supabase: Connect -> "Session pooler",
    copia la URI y ponla en la variable (con tu contraseña real):

      DATABASE_URL=postgresql://postgres.TUPROYECTO:TUCLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres

    ¿Por qué el "pooler" y no la conexión directa? La directa de Supabase
    usa solo IPv6, que muchas redes caseras aún no tienen; el pooler
    funciona en cualquier red.

La contraseña va SOLO en la variable de entorno, nunca en este archivo.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# --- Aquí se define DÓNDE vive la base de datos ---
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./taller.db")

# El "engine" es la conexión con la base de datos.
if DATABASE_URL.startswith("sqlite"):
    # connect_args solo aplica a SQLite (permite usarla desde varios hilos).
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL (Supabase). pool_pre_ping revisa que la conexión siga viva
    # antes de usarla: evita errores cuando el servidor cierra conexiones
    # que llevan rato quietas.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

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
