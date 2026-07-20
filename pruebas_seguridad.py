"""
Pruebas de seguridad automáticas (auditoría). NO tocan Supabase ni mandan
correos: usan una BD SQLite temporal y fuerzan SMTP/WhatsApp/push apagados.
Corre: venv/Scripts/python.exe <este archivo>
"""
import os, sys, tempfile

# Aislar de la configuración real ANTES de importar la app.
_tmpdir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_tmpdir, "prueba.db").replace("\\", "/")
for v in ("SMTP_HOST", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "PORTAL_URL"):
    os.environ.pop(v, None)
os.environ["ENTORNO"] = "test"

sys.path.insert(0, os.path.abspath("."))
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)

fallos = []
def ok(cond, nombre):
    marca = "OK " if cond else "FALLA"
    print(f"[{marca}] {nombre}")
    if not cond:
        fallos.append(nombre)

def registrar(sufijo):
    r = c.post("/registro", json={
        "taller_nombre": f"Taller {sufijo}", "taller_email": f"taller{sufijo}@x.com",
        "admin_nombre": f"Admin {sufijo}", "admin_email": f"admin{sufijo}@x.com",
        "admin_clave": "clave123",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return d["taller_id"], d["access_token"]

def h(tok):
    return {"Authorization": f"Bearer {tok}"}

# --- Dos talleres para probar aislamiento ---
tallerA, tokA = registrar("A")
tallerB, tokB = registrar("B")

# Cliente + vehículo en A
r = c.post(f"/talleres/{tallerA}/clientes", headers=h(tokA),
           json={"nombre": "Cliente A", "email": "cliA@x.com", "consentimiento": True})
clienteA = r.json()["id"]
r = c.post(f"/talleres/{tallerA}/vehiculos", headers=h(tokA),
           json={"cliente_id": clienteA, "placa": "ABC123", "km_actual": 1000})
vehiculoA = r.json()["id"]

# ============ 1. AISLAMIENTO MULTI-TALLER (Regla #1) ============
print("\n== Aislamiento multi-taller ==")
r = c.get(f"/talleres/{tallerA}/clientes", headers=h(tokB))
ok(r.status_code == 403, "B no lista clientes de A (403)")
r = c.get(f"/talleres/{tallerA}/vehiculos", headers=h(tokB))
ok(r.status_code == 403, "B no lista vehículos de A (403)")
r = c.get(f"/talleres/{tallerA}/clientes/{clienteA}", headers=h(tokB))
ok(r.status_code == 403, "B no ve un cliente de A por id (403)")
# B intenta registrar ingreso en vehículo de A (endpoint global /ingresos)
r = c.post("/ingresos", headers=h(tokB),
           json={"vehiculo_id": vehiculoA, "kilometraje": 2000})
ok(r.status_code == 404, "B no registra ingreso en vehículo de A (404)")
r = c.get(f"/vehiculos/{vehiculoA}/ingresos", headers=h(tokB))
ok(r.status_code == 404, "B no ve historial de vehículo de A (404)")
r = c.get(f"/vehiculos/{vehiculoA}/recordatorios", headers=h(tokB))
ok(r.status_code == 404, "B no ve recordatorios de vehículo de A (404)")

# ============ 2. AUTENTICACIÓN OBLIGATORIA ============
print("\n== Autenticación ==")
r = c.get(f"/talleres/{tallerA}/clientes")
ok(r.status_code == 401, "Sin token: 401")
r = c.get(f"/talleres/{tallerA}/clientes", headers={"Authorization": "Bearer basura"})
ok(r.status_code == 401, "Token falso: 401")

# ============ 3. ROLES (mecánico vs admin) ============
print("\n== Roles ==")
r = c.post(f"/talleres/{tallerA}/usuarios", headers=h(tokA),
           json={"nombre": "Meca", "email": "meca@x.com", "clave": "clave123", "rol": "mecanico"})
ok(r.status_code == 200, "Admin crea mecánico")
r = c.post("/login", data={"username": "meca@x.com", "password": "clave123"})
tokMeca = r.json()["access_token"]
r = c.get(f"/talleres/{tallerA}/usuarios", headers=h(tokMeca))
ok(r.status_code == 403, "Mecánico NO lista equipo (403)")
r = c.post(f"/talleres/{tallerA}/usuarios", headers=h(tokMeca),
           json={"nombre": "X", "email": "x2@x.com", "clave": "clave123", "rol": "admin"})
ok(r.status_code == 403, "Mecánico NO crea usuarios (403)")
r = c.post(f"/talleres/{tallerA}/tipos-mantenimiento", headers=h(tokMeca),
           json={"nombre": "Hack", "intervalo_km": 1000})
ok(r.status_code == 403, "Mecánico NO crea reglas (403)")
r = c.post(f"/talleres/{tallerA}/clientes/{clienteA}/regenerar-token", headers=h(tokMeca))
ok(r.status_code == 403, "Mecánico NO regenera token (403)")
r = c.delete(f"/talleres/{tallerA}/clientes/{clienteA}/datos-personales", headers=h(tokMeca))
ok(r.status_code == 403, "Mecánico NO suprime datos (403)")
# El mecánico SÍ puede registrar ingresos/clientes (su trabajo)
r = c.post(f"/talleres/{tallerA}/clientes", headers=h(tokMeca),
           json={"nombre": "C2", "consentimiento": True})
ok(r.status_code == 200, "Mecánico SÍ crea clientes")

# ============ 4. HABEAS DATA (consentimiento) ============
print("\n== Habeas Data ==")
r = c.post(f"/talleres/{tallerA}/clientes", headers=h(tokA),
           json={"nombre": "Sin permiso", "email": "np@x.com"})
ok(r.status_code == 422, "Sin consentimiento: 422")

# ============ 5. FUERZA BRUTA (bloqueo login) ============
print("\n== Fuerza bruta ==")
codigos = []
for i in range(7):
    r = c.post("/login", data={"username": "adminA@x.com", "password": "malaX"})
    codigos.append(r.status_code)
ok(429 in codigos, f"Login se bloquea tras varios intentos (429). Vistos: {codigos}")

# ============ 6. PORTAL (token secreto) ============
print("\n== Portal cliente ==")
r = c.get(f"/talleres/{tallerA}/clientes/{clienteA}/enlace-portal", headers=h(tokA))
tokenPortal = r.json()["token"]
r = c.get(f"/portal/{tokenPortal}")
ok(r.status_code == 200, "Portal con token válido: 200")
r = c.get("/portal/token-inventado-que-no-existe")
ok(r.status_code == 404, "Portal con token falso: 404")
# El cliente A no puede pedir cita para un vehículo que no es suyo
r = c.post(f"/talleres/{tallerB}/clientes", headers=h(tokB),
           json={"nombre": "Cliente B", "consentimiento": True})
clienteB = r.json()["id"]
r = c.post(f"/talleres/{tallerB}/vehiculos", headers=h(tokB),
           json={"cliente_id": clienteB, "placa": "XYZ999", "km_actual": 500})
vehiculoB = r.json()["id"]
r = c.post(f"/portal/{tokenPortal}/citas",
           json={"vehiculo_id": vehiculoB, "fecha": "2026-12-01"})
ok(r.status_code == 404, "Cliente A no pide cita en vehículo de B (404)")
r = c.post(f"/portal/{tokenPortal}/kilometraje",
           json={"vehiculo_id": vehiculoB, "kilometraje": 9999})
ok(r.status_code == 404, "Cliente A no reporta km de vehículo de B (404)")

# ============ 7. SUPRESIÓN (Habeas Data) apaga el enlace ============
print("\n== Supresión ==")
r = c.delete(f"/talleres/{tallerA}/clientes/{clienteA}/datos-personales", headers=h(tokA))
ok(r.status_code == 200, "Admin suprime datos")
r = c.get(f"/portal/{tokenPortal}")
ok(r.status_code == 404, "Enlace del portal muere tras supresión (404)")
r = c.get(f"/talleres/{tallerA}/clientes/{clienteA}/enlace-portal", headers=h(tokA))
ok(r.status_code == 410, "Pedir enlace tras supresión: 410")

# ============ 8. VALIDACIÓN: km no retrocede ============
print("\n== Validaciones de negocio ==")
r = c.post(f"/talleres/{tallerA}/clientes", headers=h(tokA),
           json={"nombre": "C3", "consentimiento": True})
c3 = r.json()["id"]
r = c.post(f"/talleres/{tallerA}/vehiculos", headers=h(tokA),
           json={"cliente_id": c3, "placa": "KM0001", "km_actual": 5000})
v3 = r.json()["id"]
r = c.post("/ingresos", headers=h(tokA), json={"vehiculo_id": v3, "kilometraje": 100})
ok(r.status_code == 422, "Km menor al anterior: 422")

print("\n" + "=" * 50)
if fallos:
    print(f"RESULTADO: {len(fallos)} FALLA(S):")
    for f in fallos:
        print("  -", f)
    sys.exit(1)
else:
    print("RESULTADO: TODAS LAS PRUEBAS PASARON")
