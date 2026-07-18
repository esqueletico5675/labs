"""
FASE 5 — Respaldo (backup) de la base de datos.

¿Por qué? El historial de mantenimientos ES el negocio: si la base de datos
se daña o se borra, se pierde todo. Este script hace una copia fechada en la
carpeta `respaldos/` y borra las más viejas para no llenar el disco.

Funciona con LAS DOS bases de datos, según la variable DATABASE_URL (la misma
que usa la app):

  - Sin DATABASE_URL (desarrollo)  -> respalda el archivo SQLite taller.db
    usando la API de respaldo de SQLite (segura aunque la base esté en uso;
    copiar/pegar el archivo a mano puede salir corrupto).

  - Con DATABASE_URL de PostgreSQL (Supabase, producción) -> intenta usar
    `pg_dump`, la herramienta oficial de respaldo de PostgreSQL. Si no está
    instalada (o su versión es más vieja que el servidor), usa un PLAN B en
    puro Python: exporta todas las filas de todas las tablas a un archivo
    .sql con INSERTs, en el orden correcto de las llaves foráneas.

Cómo usarlo:
    python respaldar_bd.py

Y programarlo (igual que enviar_recordatorios.py):
  - Windows: Programador de tareas -> tarea diaria que ejecute este script.
  - Linux/Mac: cron -> `0 2 * * * cd /ruta/del/proyecto && python respaldar_bd.py`

Cómo RESTAURAR:
  - SQLite: parar la app y reemplazar taller.db por la copia (renombrándola).
  - PostgreSQL con copia .dump (de pg_dump):
        pg_restore --dbname=$DATABASE_URL --clean --if-exists respaldos/taller_FECHA.dump
  - PostgreSQL con copia .sql (del plan B): sobre una base VACÍA,
    1) crear las tablas arrancando la app una vez (o `python migrar_bd.py`),
    2) cargar los datos:  psql $DATABASE_URL -f respaldos/taller_FECHA.sql
    El archivo ya incluye los ajustes de secuencias (setval) para que los
    próximos registros no choquen con ids ya usados.

Variables de entorno opcionales:
    RESPALDOS_MAXIMOS -> cuántas copias conservar (30 por defecto)

Ojo: el plan gratis de Supabase NO hace backups automáticos; por eso este
script. Y guarda la carpeta `respaldos/` también FUERA de este computador
(una USB o la nube) de vez en cuando.
"""

import os
import shutil
import sqlite3
import subprocess
from datetime import datetime
from glob import glob
from pathlib import Path

from app.utilidades import cargar_env

cargar_env()  # lee el .env (DATABASE_URL, RESPALDOS_MAXIMOS) antes de usarlo

CARPETA_PROYECTO = Path(__file__).resolve().parent
ARCHIVO_BD = CARPETA_PROYECTO / "taller.db"
CARPETA_RESPALDOS = CARPETA_PROYECTO / "respaldos"
RESPALDOS_MAXIMOS = int(os.environ.get("RESPALDOS_MAXIMOS", "30"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")


def sello_de_hoy() -> str:
    """Fecha y hora para el nombre del archivo, ej. 2026-07-18_020000."""
    return datetime.now().strftime("%Y-%m-%d_%H%M%S")


# ---------------------------------------------------------------- SQLite ---

def respaldar_sqlite() -> Path:
    """Copia segura y fechada del archivo taller.db. Devuelve su ruta."""
    if not ARCHIVO_BD.exists():
        raise SystemExit(f"No existe {ARCHIVO_BD}. ¿Estás en la carpeta del proyecto?")

    destino = CARPETA_RESPALDOS / f"taller_{sello_de_hoy()}.db"
    origen = sqlite3.connect(ARCHIVO_BD)
    copia = sqlite3.connect(destino)
    try:
        # backup() es la forma oficial y segura de copiar una BD en uso.
        origen.backup(copia)
    finally:
        copia.close()
        origen.close()
    return destino


# ------------------------------------------------------------ PostgreSQL ---

def buscar_pg_dump() -> str | None:
    """Busca pg_dump en el PATH y en las carpetas típicas de Windows."""
    encontrado = shutil.which("pg_dump")
    if encontrado:
        return encontrado
    # Instalaciones estándar de PostgreSQL en Windows: la versión más nueva primero.
    candidatos = sorted(
        glob(r"C:\Program Files\PostgreSQL\*\bin\pg_dump.exe"), reverse=True
    )
    return candidatos[0] if candidatos else None


def respaldar_con_pg_dump(pg_dump: str) -> Path:
    """
    Respaldo con la herramienta oficial. Formato "custom" (comprimido y
    restaurable con pg_restore). --no-owner y --no-privileges porque en
    Supabase los dueños/permisos son de ellos y estorban al restaurar.
    """
    destino = CARPETA_RESPALDOS / f"taller_{sello_de_hoy()}.dump"
    resultado = subprocess.run(
        [
            pg_dump,
            "--dbname=" + DATABASE_URL,
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            "--file=" + str(destino),
        ],
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        # El error típico: pg_dump local más viejo que el servidor de Supabase.
        destino.unlink(missing_ok=True)
        raise RuntimeError(resultado.stderr.strip() or "pg_dump falló sin mensaje")
    return destino


def respaldar_postgres_en_python() -> Path:
    """
    PLAN B sin pg_dump: exporta los DATOS de todas las tablas a un .sql con
    INSERTs. El esquema (las tablas vacías) lo recrea la app con migrar_bd.py,
    así que con los datos basta para no perder nada.

    Detalles importantes:
      - Las tablas van en orden de llaves foráneas (talleres antes que
        clientes, etc.); SQLAlchemy ya conoce ese orden (sorted_tables).
      - Los valores se escriben con mogrify() de psycopg2, que escapa
        comillas, fechas y NULLs correctamente (nunca "pegar strings a mano").
      - Al final se ajusta cada secuencia de ids con setval(): si no, el
        próximo registro nuevo intentaría usar un id ya ocupado.
    """
    # Se importa aquí (y no arriba) para que el respaldo SQLite funcione
    # aunque el entorno no tenga instalado psycopg2.
    from app.database import Base, engine
    from app import models  # noqa: F401  (registra las tablas en Base.metadata)

    destino = CARPETA_RESPALDOS / f"taller_{sello_de_hoy()}.sql"
    total_filas = 0

    with engine.connect() as conexion, open(destino, "w", encoding="utf-8") as archivo:
        cursor = conexion.connection.cursor()  # cursor psycopg2 "crudo", para mogrify
        archivo.write(
            "-- Respaldo de datos (plan B sin pg_dump) generado por respaldar_bd.py\n"
            "-- Restaurar sobre una base VACÍA con las tablas ya creadas\n"
            "-- (python migrar_bd.py) y luego:  psql $DATABASE_URL -f este_archivo.sql\n"
            "BEGIN;\n\n"
        )
        for tabla in Base.metadata.sorted_tables:
            columnas = [c.name for c in tabla.columns]
            lista_columnas = ", ".join(columnas)
            cursor.execute(f'SELECT {lista_columnas} FROM "{tabla.name}"')
            filas = cursor.fetchall()
            archivo.write(f"-- {tabla.name}: {len(filas)} filas\n")
            plantilla = "(" + ", ".join(["%s"] * len(columnas)) + ")"
            for fila in filas:
                valores = cursor.mogrify(plantilla, fila).decode("utf-8")
                archivo.write(
                    f'INSERT INTO "{tabla.name}" ({lista_columnas}) VALUES {valores};\n'
                )
            total_filas += len(filas)
            # Deja la secuencia de ids apuntando después del id más alto.
            if "id" in columnas:
                archivo.write(
                    f"SELECT setval(pg_get_serial_sequence('{tabla.name}', 'id'), "
                    f'COALESCE((SELECT MAX(id) FROM "{tabla.name}"), 1));\n'
                )
            archivo.write("\n")
        archivo.write("COMMIT;\n")

    print(f"Filas exportadas: {total_filas}")
    return destino


def respaldar_postgres() -> Path:
    """Intenta pg_dump; si no se puede, cae al plan B en Python."""
    pg_dump = buscar_pg_dump()
    if pg_dump:
        try:
            return respaldar_con_pg_dump(pg_dump)
        except RuntimeError as error:
            print(f"pg_dump falló: {error}")
            print("Uso el plan B en Python (exportar los datos a .sql)...")
    else:
        print("pg_dump no está instalado; uso el plan B en Python.")
        print("(Opcional: instalar 'Command Line Tools' de PostgreSQL para "
              "respaldos con la herramienta oficial.)")
    return respaldar_postgres_en_python()


# --------------------------------------------------------------- Rotación ---

def rotar() -> int:
    """Borra las copias más viejas, conservando las RESPALDOS_MAXIMOS recientes."""
    copias = sorted(CARPETA_RESPALDOS.glob("taller_*.*"))  # .db, .dump y .sql
    viejas = copias[:-RESPALDOS_MAXIMOS] if len(copias) > RESPALDOS_MAXIMOS else []
    for archivo in viejas:
        archivo.unlink()
    return len(viejas)


if __name__ == "__main__":
    CARPETA_RESPALDOS.mkdir(exist_ok=True)

    es_postgres = DATABASE_URL.startswith("postgres")
    if es_postgres:
        print("DATABASE_URL apunta a PostgreSQL (Supabase): respaldo remoto.")
        destino = respaldar_postgres()
    else:
        print("Sin DATABASE_URL de PostgreSQL: respaldo del SQLite local.")
        destino = respaldar_sqlite()

    tamano_kb = destino.stat().st_size / 1024
    borradas = rotar()
    total = len(list(CARPETA_RESPALDOS.glob("taller_*.*")))
    print(f"Respaldo creado: {destino.name} ({tamano_kb:.0f} KB)")
    print(f"Copias guardadas: {total} (se conservan máximo {RESPALDOS_MAXIMOS}; "
          f"borradas hoy: {borradas})")
    print("Consejo: guarda la carpeta 'respaldos/' también FUERA de este computador "
          "(una USB o la nube) de vez en cuando.")
