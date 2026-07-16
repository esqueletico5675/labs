"""
FASE 3 (push) — Generador de llaves VAPID. Se corre UNA sola vez:

    python generar_llaves_push.py

¿Qué es VAPID? El "carné de identidad" de tu servidor ante Google/Apple/
Mozilla: demuestra que las notificaciones push las manda TU servidor y no
un impostor. Son dos llaves:
  - la PÚBLICA se comparte con el navegador del cliente (no es secreta)
  - la PRIVADA firma cada envío (¡secreta! nunca se sube al repositorio)

El script las guarda en `llaves_push.json` (ya está en .gitignore).
Si generas llaves NUEVAS, las suscripciones viejas dejan de servir y los
clientes deben volver a activar los avisos. Por eso: se generan una vez.
"""

import json
import os

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid, b64urlencode

ARCHIVO = os.path.join(os.path.dirname(__file__), "llaves_push.json")

if os.path.exists(ARCHIVO):
    print(f"Ya existe {ARCHIVO}. Si de verdad quieres regenerar las llaves")
    print("(los clientes tendrán que reactivar sus avisos), bórralo primero.")
    raise SystemExit(1)

vapid = Vapid()
vapid.generate_keys()

# La pública en el formato "crudo" que el navegador espera (base64 url-safe).
publica = b64urlencode(vapid.public_key.public_bytes(
    serialization.Encoding.X962,
    serialization.PublicFormat.UncompressedPoint,
))
# La privada también en crudo (32 bytes), formato que pywebpush acepta.
privada = b64urlencode(
    vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
)

with open(ARCHIVO, "w", encoding="utf-8") as f:
    json.dump({"publica": publica, "privada": privada}, f, indent=2)

print(f"Llaves creadas y guardadas en {ARCHIVO}")
print("La app las carga sola. ¡No subas este archivo a ningún lado!")
