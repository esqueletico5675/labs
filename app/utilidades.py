"""
Utilidades pequeñas compartidas por todo el proyecto.

¿Por qué existe este archivo? `datetime.utcnow()` está OBSOLETO en Python
moderno. La forma nueva es `datetime.now(timezone.utc)`, pero esa devuelve
una fecha "consciente" de zona horaria, y SQLite guarda fechas "ingenuas"
(sin zona). Mezclar las dos rompe las comparaciones.

Solución simple: esta función devuelve la hora UTC de hoy SIN zona horaria,
igual que hacía utcnow(), pero usando la API moderna. Todo el proyecto debe
usar `ahora_utc()` en vez de `datetime.utcnow()`.
"""

import os
import secrets
from datetime import datetime, timezone
from pathlib import Path


def ahora_utc() -> datetime:
    """Hora actual en UTC, sin zona horaria (compatible con SQLite)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def cargar_env(ruta=None) -> int:
    """
    FASE 5 — Carga las variables del archivo `.env` (los secretos del
    proyecto: claves de correo, base de datos, etc.).

    ¿Por qué un archivo? Para no tener que escribir las claves en la
    terminal cada vez. El archivo está en el `.gitignore`: NUNCA se sube
    al repositorio.

    Regla importante: si una variable YA existe en el entorno (la
    definiste en la terminal o en el servidor), esa gana; el archivo solo
    rellena las que falten. Las líneas con # y los valores vacíos se
    ignoran. Devuelve cuántas variables cargó.
    """
    archivo = Path(ruta) if ruta else Path(__file__).resolve().parent.parent / ".env"
    if not archivo.exists():
        return 0
    cargadas = 0
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        clave, valor = clave.strip(), valor.strip().strip('"').strip("'")
        if not clave or not valor:
            continue
        if clave not in os.environ:
            os.environ[clave] = valor
            cargadas += 1
    return cargadas


def token_portal() -> str:
    """
    Genera el 'enlace secreto' de un cliente para el portal (Fase 3).
    `secrets` es el módulo de Python para azar CRIPTOGRÁFICO: produce un
    código tan largo y aleatorio que es imposible adivinarlo probando.
    """
    return secrets.token_urlsafe(16)
