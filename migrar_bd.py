"""
FASE 5 — Migraciones simples de la base de datos.

¿Qué es una migración? Un cambio en la ESTRUCTURA de la base de datos
(agregar una columna, por ejemplo). `create_all()` solo crea tablas que no
existen: si la tabla ya está creada, NO le agrega columnas nuevas. Este
script revisa qué columnas faltan y las agrega, sin tocar los datos.

Cómo usarlo (cada vez que el código traiga columnas nuevas):
    python migrar_bd.py

Es seguro correrlo varias veces: si la columna ya existe, no hace nada.
Funciona igual en SQLite (desarrollo) y PostgreSQL/Supabase (producción).

(Proyectos grandes usan la herramienta `alembic` para esto; por ahora esta
lista simple nos alcanza y se entiende completa.)
"""

from sqlalchemy import inspect, text

from app.database import engine

# Cada migración: (tabla, columna nueva, tipo en SQL).
# "TIMESTAMP" funciona en SQLite y en PostgreSQL.
MIGRACIONES = [
    ("clientes", "consentimiento_en", "TIMESTAMP"),  # Habeas Data (Ley 1581/2012)
    ("clientes", "clave_hash", "TEXT"),              # MVP cliente: login con contraseña
]

if __name__ == "__main__":
    inspector = inspect(engine)
    aplicadas = 0
    for tabla, columna, tipo in MIGRACIONES:
        columnas = [c["name"] for c in inspector.get_columns(tabla)]
        if columna in columnas:
            print(f"OK  {tabla}.{columna} ya existe")
            continue
        with engine.begin() as conexion:
            conexion.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo}"))
        print(f"+++ {tabla}.{columna} agregada")
        aplicadas += 1
    print(f"\nListo: {aplicadas} cambio(s) aplicado(s).")
