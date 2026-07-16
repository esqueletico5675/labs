"""
FASE 2 — Envío de recordatorios por correo.

Idea general (3 pasos):
  1. Recorrer los vehículos de un taller y preguntarle al motor
     (mantenimiento.calcular_recordatorios) qué está vencido o próximo.
  2. Filtrar lo que YA avisamos hace poco (tabla RecordatorioEnviado),
     para no mandarle el mismo correo al cliente todos los días.
  3. Redactar UN correo por vehículo con la lista de pendientes y enviarlo.

Sobre el envío: usamos `smtplib`, que viene GRATIS con Python (no hay que
instalar nada). El servidor de correo se configura con variables de entorno:

    SMTP_HOST      -> ej. "smtp.gmail.com"
    SMTP_PUERTO    -> ej. "587" (es el valor por defecto)
    SMTP_USUARIO   -> el correo con el que se envía
    SMTP_CLAVE     -> la contraseña o "clave de aplicación"
    SMTP_REMITENTE -> opcional; si no se define, se usa SMTP_USUARIO

¿Qué es una variable de entorno? Un valor que vive FUERA del código (en la
terminal o en el servidor). Así la clave del correo nunca queda escrita en
el código ni se sube al repositorio. Regla de seguridad básica.

MODO SIMULACIÓN: si no defines SMTP_HOST, no se envía nada de verdad; el
correo se imprime en la consola. Perfecto para desarrollar sin gastar.
(Ojo: la simulación TAMBIÉN se registra en RecordatorioEnviado, para que
puedas probar la regla de "no repetir avisos".)
"""

import json
import os
import smtplib
from datetime import timedelta
from email.message import EmailMessage
from pathlib import Path

from . import models, mantenimiento
from .utilidades import ahora_utc

# Si ya avisamos de un mantenimiento hace menos de estos días, no repetimos.
DIAS_ENTRE_AVISOS = 7


# ============================================================
#  Notificaciones PUSH (Fase 3)
#  Las llaves VAPID se crean una vez con: python generar_llaves_push.py
#  Sin llaves, el push simplemente se omite (igual que el correo sin SMTP).
# ============================================================
ARCHIVO_LLAVES = Path(__file__).resolve().parent.parent / "llaves_push.json"


def llaves_push():
    """Carga las llaves VAPID (de variables de entorno o del archivo). None si no hay."""
    publica = os.environ.get("VAPID_PUBLICA")
    privada = os.environ.get("VAPID_PRIVADA")
    if publica and privada:
        return {"publica": publica, "privada": privada}
    if ARCHIVO_LLAVES.exists():
        with open(ARCHIVO_LLAVES, encoding="utf-8") as f:
            return json.load(f)
    return None


def enviar_push(db, suscripcion, titulo: str, cuerpo: str) -> bool:
    """
    Manda UNA notificación push a UN dispositivo. Devuelve True si salió.
    Si el dispositivo ya no existe (el cliente desinstaló la app o revocó
    el permiso), el servicio responde 404/410 y borramos la suscripción.
    """
    llaves = llaves_push()
    if not llaves:
        return False

    from pywebpush import webpush, WebPushException  # import perezoso

    try:
        webpush(
            subscription_info={
                "endpoint": suscripcion.endpoint,
                "keys": {"p256dh": suscripcion.p256dh, "auth": suscripcion.auth},
            },
            data=json.dumps({"titulo": titulo, "cuerpo": cuerpo}),
            vapid_private_key=llaves["privada"],
            vapid_claims={"sub": "mailto:" + os.environ.get(
                "VAPID_EMAIL", "contacto@example.com")},
        )
        return True
    except WebPushException as error:
        # 404/410 = "esta dirección ya no existe": limpiamos la suscripción.
        if error.response is not None and error.response.status_code in (404, 410):
            db.delete(suscripcion)
            db.commit()
        return False
    except Exception:
        # Cualquier otro problema (suscripción corrupta, sin internet...):
        # este dispositivo no recibió el aviso, pero el proceso del día
        # NUNCA se debe caer por un solo dispositivo dañado.
        return False


# ============================================================
#  1) El envío en sí (o su simulación)
# ============================================================
def enviar_correo(destinatario: str, asunto: str, cuerpo: str) -> str:
    """
    Envía un correo. Devuelve "enviado" si salió por SMTP de verdad,
    o "simulado" si no hay servidor configurado (y lo imprime en consola).
    """
    host = os.environ.get("SMTP_HOST")

    if not host:
        # --- Modo simulación: no hay servidor configurado ---
        print("=" * 60)
        print("[SIMULACIÓN — configura SMTP_HOST para enviar de verdad]")
        print(f"Para:    {destinatario}")
        print(f"Asunto:  {asunto}")
        print("-" * 60)
        print(cuerpo)
        print("=" * 60)
        return "simulado"

    puerto = int(os.environ.get("SMTP_PUERTO", "587"))
    usuario = os.environ.get("SMTP_USUARIO", "")
    clave = os.environ.get("SMTP_CLAVE", "")
    remitente = os.environ.get("SMTP_REMITENTE", usuario)

    mensaje = EmailMessage()
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)

    # starttls() = la conexión se cifra antes de mandar usuario y clave.
    with smtplib.SMTP(host, puerto) as servidor:
        servidor.starttls()
        if usuario:
            servidor.login(usuario, clave)
        servidor.send_message(mensaje)
    return "enviado"


# ============================================================
#  2) Redactar el correo (texto claro, sin tecnicismos)
# ============================================================
def redactar_correo(nombre_taller, cliente, vehiculo, pendientes):
    """Arma el asunto y el cuerpo del correo para UN vehículo."""
    vencidos = [p for p in pendientes if p["estado"] == "vencido"]

    if vencidos:
        asunto = f"Tu {vehiculo.marca or 'vehículo'} ({vehiculo.placa}) tiene mantenimientos pendientes"
    else:
        asunto = f"Tu {vehiculo.marca or 'vehículo'} ({vehiculo.placa}) pronto necesitará mantenimiento"

    lineas = [f"Hola {cliente.nombre},", ""]
    lineas.append(f"Te escribimos de {nombre_taller} sobre tu vehículo de placa {vehiculo.placa}.")
    lineas.append("")

    if vencidos:
        lineas.append("Estos mantenimientos YA están vencidos:")
        for p in vencidos:
            lineas.append(f"  - {p['tipo']} ({p['motivo']})")
        lineas.append("")

    proximos = [p for p in pendientes if p["estado"] == "proximo"]
    if proximos:
        lineas.append("Y estos están próximos a vencerse:")
        for p in proximos:
            lineas.append(f"  - {p['tipo']}")
        lineas.append("")

    lineas.append("Agenda tu cita respondiendo este correo o llamándonos.")

    # Si el portal ya está publicado en internet (variable PORTAL_URL, ej.
    # "https://mitaller.co"), incluimos el enlace personal del cliente.
    portal_url = os.environ.get("PORTAL_URL")
    if portal_url and getattr(cliente, "token_acceso", None):
        lineas.append("")
        lineas.append(f"Consulta el estado completo de tu vehículo aquí:")
        lineas.append(f"  {portal_url}/app/?t={cliente.token_acceso}")

    lineas.append("")
    lineas.append(f"— {nombre_taller}")

    return asunto, "\n".join(lineas)


# ============================================================
#  3) El proceso completo para un taller
# ============================================================
def enviar_recordatorios_taller(db, taller) -> dict:
    """
    Revisa TODOS los vehículos de un taller y envía los correos que toquen.
    Devuelve un resumen (cuántos correos, cuántos avisos, qué se omitió).
    """
    resumen = {
        "taller": taller.nombre,
        "correos": 0,
        "push": 0,                    # notificaciones push entregadas
        "avisos": 0,
        "omitidos_sin_contacto": 0,   # clientes sin correo NI push
        "omitidos_ya_avisados": 0,    # avisos repetidos que evitamos
        "detalle": [],
    }

    limite = ahora_utc() - timedelta(days=DIAS_ENTRE_AVISOS)

    vehiculos = db.query(models.Vehiculo).filter(
        models.Vehiculo.taller_id == taller.id
    ).all()

    for vehiculo in vehiculos:
        resultados = mantenimiento.calcular_recordatorios(db, vehiculo)
        pendientes = [r for r in resultados if r["estado"] in ("vencido", "proximo")]
        if not pendientes:
            continue

        # ¿Cómo contactamos al cliente? Por correo, por push, o por ambos.
        cliente = vehiculo.cliente
        suscripciones = db.query(models.SuscripcionPush).filter(
            models.SuscripcionPush.cliente_id == cliente.id
        ).all() if cliente else []
        if not cliente or (not cliente.email and not suscripciones):
            resumen["omitidos_sin_contacto"] += 1
            continue

        # Quitamos los avisos que ya mandamos hace menos de DIAS_ENTRE_AVISOS.
        ya_avisados = {
            r.tipo_id
            for r in db.query(models.RecordatorioEnviado).filter(
                models.RecordatorioEnviado.vehiculo_id == vehiculo.id,
                models.RecordatorioEnviado.enviado_en >= limite,
            )
        }
        nuevos = [p for p in pendientes if p["tipo_id"] not in ya_avisados]
        resumen["omitidos_ya_avisados"] += len(pendientes) - len(nuevos)
        if not nuevos:
            continue

        # Redactamos y enviamos UN correo con todos los pendientes nuevos.
        modo = None
        if cliente.email:
            asunto, cuerpo = redactar_correo(taller.nombre, cliente, vehiculo, nuevos)
            modo = enviar_correo(cliente.email, asunto, cuerpo)
            resumen["correos"] += 1

        # Y la notificación push a cada dispositivo del cliente (texto corto).
        push_entregados = 0
        if suscripciones:
            titulo_push = f"{vehiculo.placa}: mantenimiento pendiente"
            cuerpo_push = ", ".join(p["tipo"] for p in nuevos)
            for suscripcion in suscripciones:
                if enviar_push(db, suscripcion, titulo_push, cuerpo_push):
                    push_entregados += 1
            resumen["push"] += push_entregados

        # Dejamos constancia de cada aviso para no repetirlo mañana.
        canales = []
        if modo:
            canales.append("email" if modo == "enviado" else "email_simulado")
        if push_entregados:
            canales.append("push")
        for p in nuevos:
            db.add(models.RecordatorioEnviado(
                vehiculo_id=vehiculo.id,
                tipo_id=p["tipo_id"],
                estado=p["estado"],
                canal="+".join(canales) or "ninguno",
            ))
        db.commit()

        resumen["avisos"] += len(nuevos)
        resumen["detalle"].append({
            "vehiculo": vehiculo.placa,
            "cliente": cliente.nombre,
            "email": cliente.email,
            "avisos": [p["tipo"] for p in nuevos],
            "modo": modo,
            "push": push_entregados,
        })

    return resumen
