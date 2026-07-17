"""
FASE 5 — Respaldo (backup) de la base de datos.

¿Por qué? El historial de mantenimientos ES el negocio: si el archivo
taller.db se daña o se borra, se pierde todo. Este script hace una copia
fechada en la carpeta `respaldos/` y borra las más viejas para no llenar
el disco.

IMPORTANTE: no copiamos el archivo "a mano" (con copiar/pegar), porque si
alguien está usando la app en ese momento la copia puede salir corrupta.
Usamos la API de respaldo de SQLite, que copia de forma SEGURA aunque la
base esté en uso.

Cómo usarlo:
    python respaldar_bd.py

Y programarlo (igual que enviar_recordatorios.py):
  - Windows: Programador de tareas -> tarea diaria que ejecute este script.
  - Linux/Mac: cron -> `0 2 * * * cd /ruta/del/proyecto && python respaldar_bd.py`

Variables de entorno opcionales:
    RESPALDOS_MAXIMOS -> cuántas copias conservar (30 por defecto)

En producción con PostgreSQL (Supabase) este script se reemplaza por
`pg_dump`, pero la idea (copia diaria + rotación) es exactamente la misma.
Ojo: el plan gratis de Supabase NO hace backups automáticos; hay que correr
pg_dump programado igual que esto, o pasarse al plan pago.
"""

import os
import sqlite3
from datetime import datetime
from pathlib import Path

from app.utilidades import cargar_env

cargar_env()  # lee el .env (ej. RESPALDOS_MAXIMOS) antes de usarlo

CARPETA_PROYECTO = Path(__file__).resolve().parent
ARCHIVO_BD = CARPETA_PROYECTO / "taller.db"
CARPETA_RESPALDOS = CARPETA_PROYECTO / "respaldos"
RESPALDOS_MAXIMOS = int(os.environ.get("RESPALDOS_MAXIMOS", "30"))


def respaldar() -> Path:
    """Crea una copia segura y fechada de la base de datos. Devuelve su ruta."""
    if not ARCHIVO_BD.exists():
        raise SystemExit(f"No existe {ARCHIVO_BD}. ¿Estás en la carpeta del proyecto?")

    CARPETA_RESPALDOS.mkdir(exist_ok=True)
    sello = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    destino = CARPETA_RESPALDOS / f"taller_{sello}.db"

    origen = sqlite3.connect(ARCHIVO_BD)
    copia = sqlite3.connect(destino)
    try:
        # backup() es la forma oficial y segura de copiar una BD en uso.
        origen.backup(copia)
    finally:
        copia.close()
        origen.close()
    return destino


def rotar():
    """Borra las copias más viejas, conservando las RESPALDOS_MAXIMOS recientes."""
    copias = sorted(CARPETA_RESPALDOS.glob("taller_*.db"))
    viejas = copias[:-RESPALDOS_MAXIMOS] if len(copias) > RESPALDOS_MAXIMOS else []
    for archivo in viejas:
        archivo.unlink()
    return len(viejas)


if __name__ == "__main__":
    destino = respaldar()
    tamano_kb = destino.stat().st_size / 1024
    borradas = rotar()
    total = len(list(CARPETA_RESPALDOS.glob("taller_*.db")))
    print(f"Respaldo creado: {destino.name} ({tamano_kb:.0f} KB)")
    print(f"Copias guardadas: {total} (se conservan máximo {RESPALDOS_MAXIMOS}; "
          f"borradas hoy: {borradas})")
    print("Consejo: guarda la carpeta 'respaldos/' también FUERA de este computador "
          "(una USB o la nube) de vez en cuando.")
