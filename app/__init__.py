# Este archivo corre ANTES que cualquier módulo del paquete `app`.
# Aquí cargamos el .env para que los secretos ya estén disponibles cuando
# security.py y database.py lean sus variables de entorno al importarse.
from .utilidades import cargar_env

cargar_env()
