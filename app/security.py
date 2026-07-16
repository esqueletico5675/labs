"""
Seguridad: contraseñas y tokens de sesión (JWT).

Regla #1 de seguridad: NUNCA guardar la contraseña tal cual. Guardamos un
"hash" (una huella irreversible). bcrypt es el estándar para esto: aunque
alguien robe la base de datos, no puede recuperar las contraseñas.

FASE 3 — ¿Qué es un JWT? Un "carné digital" que el servidor firma al hacer
login. Contiene quién eres (usuario, taller, rol) y hasta cuándo sirve.
En cada petición el navegador lo presenta, y el servidor solo verifica la
FIRMA (rapidísimo, sin consultar la BD para validar la sesión). Si alguien
altera el contenido, la firma ya no cuadra y el token se rechaza.
"""

import os
from datetime import timedelta

import bcrypt
import jwt

from .utilidades import ahora_utc

# La "llave" con la que se firman los tokens. En desarrollo usamos un valor
# por defecto, pero en producción DEBE venir de una variable de entorno
# (si alguien conoce esta llave, puede fabricar carnés falsos).
JWT_SECRETO = os.environ.get("JWT_SECRETO", "llave-solo-para-desarrollo-cambiame-en-produccion")
JWT_ALGORITMO = "HS256"
HORAS_VALIDEZ_TOKEN = 8  # una jornada de trabajo; luego toca volver a entrar


def cifrar_clave(clave: str) -> str:
    """Convierte una contraseña en un hash seguro para guardar en la BD."""
    sal = bcrypt.gensalt()
    hash_bytes = bcrypt.hashpw(clave.encode("utf-8"), sal)
    return hash_bytes.decode("utf-8")


def verificar_clave(clave: str, clave_hash: str) -> bool:
    """Comprueba si una contraseña coincide con el hash guardado."""
    return bcrypt.checkpw(clave.encode("utf-8"), clave_hash.encode("utf-8"))


def crear_token(usuario) -> str:
    """Firma el 'carné digital' (JWT) de un usuario tras un login exitoso."""
    datos = {
        "sub": str(usuario.id),          # "subject": de quién es el token
        "taller_id": usuario.taller_id,  # a qué taller pertenece (¡clave!)
        "rol": usuario.rol,
        "exp": ahora_utc() + timedelta(hours=HORAS_VALIDEZ_TOKEN),  # vencimiento
    }
    return jwt.encode(datos, JWT_SECRETO, algorithm=JWT_ALGORITMO)


def leer_token(token: str):
    """
    Verifica la firma y el vencimiento de un token. Devuelve sus datos
    (dict) si es válido, o None si es falso o ya venció.
    """
    try:
        return jwt.decode(token, JWT_SECRETO, algorithms=[JWT_ALGORITMO])
    except jwt.PyJWTError:
        return None
