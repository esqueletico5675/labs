"""
Datos de ejemplo (semilla).

Corre este script UNA vez para llenar la base de datos con un taller, un
cliente, un vehículo y algunos ingresos, y así ver el sistema funcionando
sin tener que meter todo a mano.

    python seed.py

Luego arranca el servidor (uvicorn app.main:app --reload) y prueba en /docs
el endpoint de recordatorios con el vehículo creado.
"""

from datetime import timedelta

from app.database import SessionLocal, engine
from app import models, security, mantenimiento
from app.utilidades import ahora_utc

# Contraseña del admin de ejemplo. Es solo para DEMOSTRAR el sistema con
# datos de juguete; cámbiala en cuanto registres tu taller real. Larga a
# propósito para no disparar detectores de secretos como GitGuardian.
CLAVE_DEMO = "taller-norte-demo-2026"

# Nos aseguramos de que las tablas existan.
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# --- Taller ---
taller = models.Taller(nombre="Taller Diésel del Norte", email="contacto@tallernorte.co")
db.add(taller)
db.commit()
db.refresh(taller)

# Intervalos por defecto para este taller.
for nombre, km, meses in mantenimiento.INTERVALOS_DIESEL_POR_DEFECTO:
    db.add(models.TipoMantenimiento(
        taller_id=taller.id, nombre=nombre, intervalo_km=km, intervalo_meses=meses,
    ))
db.commit()

# --- Usuario (admin) ---
db.add(models.Usuario(
    taller_id=taller.id, nombre="Ana Torres", email="ana@tallernorte.co",
    clave_hash=security.cifrar_clave(CLAVE_DEMO), rol="admin",
))
db.commit()

# --- Cliente y vehículo ---
cliente = models.Cliente(
    taller_id=taller.id, nombre="Carlos Ruiz",
    email="carlos@correo.co", telefono="3001234567",
)
db.add(cliente)
db.commit()
db.refresh(cliente)

vehiculo = models.Vehiculo(
    taller_id=taller.id, cliente_id=cliente.id,
    placa="ABC123", marca="Toyota", modelo="Hilux", anio=2019,
    km_actual=90000, fecha_km=ahora_utc() - timedelta(days=210),
)
db.add(vehiculo)
db.commit()
db.refresh(vehiculo)

# --- Un ingreso pasado donde se hizo cambio de aceite ---
tipo_aceite = db.query(models.TipoMantenimiento).filter(
    models.TipoMantenimiento.taller_id == taller.id,
    models.TipoMantenimiento.nombre.like("Cambio de aceite%"),
).first()

ingreso = models.Ingreso(
    vehiculo_id=vehiculo.id,
    fecha=ahora_utc() - timedelta(days=210),  # hace ~7 meses
    kilometraje=90000,
    descripcion="Cambio de aceite y revisión general",
)
db.add(ingreso)
db.commit()
db.refresh(ingreso)
db.add(models.MantenimientoRealizado(ingreso_id=ingreso.id, tipo_id=tipo_aceite.id))
db.commit()

print("¡Datos de ejemplo creados!")
print(f"  Taller ID: {taller.id}")
print(f"  Vehículo ID: {vehiculo.id} (placa {vehiculo.placa})")
print()
print("Ahora arranca el servidor:")
print("  uvicorn app.main:app --reload")
print(f"Y prueba en /docs el endpoint: GET /vehiculos/{vehiculo.id}/recordatorios")
print("(El cambio de aceite debería salir VENCIDO: pasaron ~7 meses > 6 meses.)")
print()
print(f"Login del taller (Fase 3): ana@tallernorte.co / {CLAVE_DEMO}")
print("Portal del cliente (PWA):")
print(f"  http://127.0.0.1:8000/app/?t={cliente.token_acceso}")

db.close()
