"""
Prueba de los avisos push de la APP MÓVIL.

Manda una notificación de prueba a cada celular registrado (las
suscripciones con tipo="expo"). Sirve para verificar el circuito
completo sin esperar al envío diario:

    python probar_push_movil.py

Requisitos: haber entrado en la app móvil y activado los avisos
(Ajustes -> "Activar avisos"), y tener internet.
"""

from app.database import SessionLocal
from app import models, notificaciones

db = SessionLocal()

celulares = db.query(models.SuscripcionPush).filter(
    models.SuscripcionPush.tipo == "expo"
).all()

if not celulares:
    print("No hay celulares registrados todavía.")
    print("En la app móvil: entra y activa los avisos en Ajustes.")
else:
    print(f"Celulares registrados: {len(celulares)}\n")
    for s in celulares:
        nombre = s.cliente.nombre if s.cliente else "?"
        ok = notificaciones.enviar_push_expo(
            db, s,
            "Prueba de avisos 🔔",
            f"Hola {nombre}: si lees esto, los avisos funcionan.",
        )
        estado = "ENVIADO" if ok else "FALLÓ (¿token viejo o sin internet?)"
        print(f"  {nombre}: {estado}")
    print("\nSi dice ENVIADO pero no llegó al celular, revisa que la app")
    print("tenga permiso de notificaciones en los ajustes del teléfono.")

db.close()
