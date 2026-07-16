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

import secrets
from datetime import datetime, timezone


def ahora_utc() -> datetime:
    """Hora actual en UTC, sin zona horaria (compatible con SQLite)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def token_portal() -> str:
    """
    Genera el 'enlace secreto' de un cliente para el portal (Fase 3).
    `secrets` es el módulo de Python para azar CRIPTOGRÁFICO: produce un
    código tan largo y aleatorio que es imposible adivinarlo probando.
    """
    return secrets.token_urlsafe(16)
