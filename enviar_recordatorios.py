"""
FASE 2 — Tarea programada de recordatorios.

Este script revisa TODOS los talleres y envía (o simula) los correos de
recordatorio que toquen hoy. Está pensado para correr UNA vez al día:

    python enviar_recordatorios.py

¿Cómo se programa para que corra solo?
  - Windows: "Programador de tareas" -> Crear tarea básica -> Diaria ->
    Programa: python, Argumentos: enviar_recordatorios.py,
    Iniciar en: la carpeta del proyecto.
  - Linux/Mac (cron): crontab -e  y agregar, por ejemplo a las 8am:
        0 8 * * * cd /ruta/al/proyecto && python enviar_recordatorios.py

No repite avisos: si ya se avisó de un mantenimiento hace menos de 7 días
(ver DIAS_ENTRE_AVISOS en app/notificaciones.py), lo omite.

Sin configurar SMTP corre en MODO SIMULACIÓN (imprime los correos en la
consola en vez de enviarlos). Ver app/notificaciones.py para configurarlo.
"""

from app.database import SessionLocal, engine
from app import models, notificaciones

# Nos aseguramos de que las tablas existan (incluida recordatorios_enviados).
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

talleres = db.query(models.Taller).all()
if not talleres:
    print("No hay talleres registrados todavía. Corre primero: python seed.py")

total_correos = 0
for taller in talleres:
    resumen = notificaciones.enviar_recordatorios_taller(db, taller)
    total_correos += resumen["correos"]
    print(f"\nTaller: {resumen['taller']}")
    print(f"  Correos enviados:            {resumen['correos']}")
    print(f"  Push entregados:             {resumen['push']}")
    print(f"  Avisos incluidos:            {resumen['avisos']}")
    print(f"  Clientes sin contacto:       {resumen['omitidos_sin_contacto']}")
    print(f"  Avisos omitidos (repetidos): {resumen['omitidos_ya_avisados']}")

print(f"\nListo: {total_correos} correo(s) en total.")
db.close()
