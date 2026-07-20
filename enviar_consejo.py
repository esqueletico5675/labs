"""
Consejo del día — tarea programada.

Manda UN dato curioso de mantenimiento ("¿Sabías que…?") por notificación
push a los clientes que activaron los avisos. Pensado para correr UNA vez
al día (lo programa GitHub Actions; ver .github/workflows/consejo.yml).

    python enviar_consejo.py

Es el mismo dato para todos y cambia solo con la fecha. Solo push: no manda
correos (sería demasiado ruido). Si no hay llaves de push configuradas
(VAPID para web) o nadie tiene la app, simplemente no entrega nada.
"""

from app.database import SessionLocal, engine
from app import models, notificaciones

# Nos aseguramos de que las tablas existan.
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    resumen = notificaciones.enviar_consejo_del_dia(db)
    print(f"Consejo del día: {resumen['consejo']}")
    print(f"Dispositivos suscritos: {resumen['dispositivos']}")
    print(f"Notificaciones entregadas: {resumen['push']}")
finally:
    db.close()
