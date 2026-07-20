"""
Cambiar la contraseña del PERSONAL del taller (admin o mecánico).

¿Para qué existe? El panel no tiene "olvidé mi contraseña": si un empleado
olvida la suya, o quieres forzar un cambio, este script la reemplaza
directo en la base de datos (siempre cifrada con bcrypt, nunca en texto
plano). Es la herramienta de rescate del piloto.

Usa la misma base que el servidor: lee DATABASE_URL del entorno / .env.
  - Sin DATABASE_URL  -> la SQLite local (taller.db).
  - Con DATABASE_URL  -> la base de Supabase (producción).

Cómo se usa (desde la carpeta del proyecto, con el venv):

  Ver todos los usuarios y su taller:
      venv\Scripts\python.exe cambiar_clave.py

  Cambiar la contraseña de un usuario (te la pide sin mostrarla):
      venv\Scripts\python.exe cambiar_clave.py correo@deltaller.com

  O pasándola directo (útil en scripts, pero queda en el historial):
      venv\Scripts\python.exe cambiar_clave.py correo@deltaller.com NuevaClaveLarga

Nota: NO cambia la contraseña de los CLIENTES (dueños de carro). Ellos la
cambian solos desde su portal (crear/actualizar contraseña con su enlace),
o el admin les regenera el enlace desde el panel.
"""
import sys
import getpass

from app.utilidades import cargar_env

cargar_env()  # lee DATABASE_URL, etc. del .env antes de conectar

from app.database import SessionLocal
from app import models, security

CLAVE_MINIMA = 6


def listar_usuarios(db):
    """Muestra todos los usuarios del sistema con su taller y rol."""
    usuarios = db.query(models.Usuario).order_by(models.Usuario.taller_id).all()
    if not usuarios:
        print("No hay usuarios registrados todavía.")
        return
    print(f"{'CORREO':<35} {'ROL':<10} {'TALLER'}")
    print("-" * 70)
    for u in usuarios:
        taller = u.taller.nombre if u.taller else f"id {u.taller_id}"
        print(f"{u.email:<35} {u.rol:<10} {taller}")
    print()
    print("Para cambiar una: python cambiar_clave.py <correo>")


def cambiar(db, email: str, nueva_clave: str):
    """Reemplaza la contraseña de un usuario por su correo."""
    usuario = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if not usuario:
        print(f"No existe ningún usuario con el correo '{email}'.")
        print("Corre el script sin argumentos para ver la lista de correos.")
        return 1
    if len(nueva_clave) < CLAVE_MINIMA:
        print(f"La contraseña debe tener al menos {CLAVE_MINIMA} caracteres.")
        return 1

    usuario.clave_hash = security.cifrar_clave(nueva_clave)
    db.commit()
    taller = usuario.taller.nombre if usuario.taller else usuario.taller_id
    print(f"Listo. Contraseña actualizada para {usuario.nombre} ({email}), taller '{taller}'.")
    print("Ya puede entrar al panel con su correo y la nueva contraseña.")
    return 0


def main():
    db = SessionLocal()
    try:
        # Sin argumentos: solo listar.
        if len(sys.argv) == 1:
            listar_usuarios(db)
            return 0

        email = sys.argv[1].strip().lower()

        # La clave puede venir como argumento o pedirse en pantalla (más seguro:
        # no queda en el historial de la terminal y no se ve al teclear).
        if len(sys.argv) >= 3:
            nueva = sys.argv[2]
        else:
            nueva = getpass.getpass("Nueva contraseña (no se muestra): ")
            repetir = getpass.getpass("Repite la contraseña: ")
            if nueva != repetir:
                print("Las contraseñas no coinciden. No se cambió nada.")
                return 1

        return cambiar(db, email, nueva)
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
