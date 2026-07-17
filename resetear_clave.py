"""
Resetear la contraseña de un usuario del taller (personal del panel).

Uso (con el venv activado):

    python resetear_clave.py                # pregunta correo y clave nueva
    python resetear_clave.py ana@correo.co  # pregunta solo la clave nueva

La clave se escribe oculta (no se ve al teclear) y se guarda cifrada con
bcrypt, igual que en el registro. No toca a los clientes del portal.
"""

import sys
from getpass import getpass

from app.database import SessionLocal
from app import models, security

# --- Correo del usuario: por argumento o preguntando ---
if len(sys.argv) > 1:
    email = sys.argv[1].strip().lower()
else:
    email = input("Correo del usuario: ").strip().lower()

db = SessionLocal()

usuario = db.query(models.Usuario).filter(models.Usuario.email == email).first()
if usuario is None:
    print(f"No existe ningún usuario con el correo: {email}")
    db.close()
    sys.exit(1)

print(f"Usuario: {usuario.nombre} (rol {usuario.rol}, taller {usuario.taller_id})")

# --- Clave nueva, dos veces para evitar errores de dedo ---
clave = getpass("Clave nueva (mínimo 6 caracteres): ")
if len(clave) < 6:
    print("Muy corta. No se cambió nada.")
    db.close()
    sys.exit(1)

confirmacion = getpass("Repite la clave nueva: ")
if clave != confirmacion:
    print("No coinciden. No se cambió nada.")
    db.close()
    sys.exit(1)

usuario.clave_hash = security.cifrar_clave(clave)
db.commit()
db.close()

print("¡Listo! Contraseña actualizada.")
print(f"Ya puedes entrar al panel con {email} y la clave nueva.")
