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
import re
import smtplib
import urllib.error
import urllib.request
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
#  Push a la APP MÓVIL — vía el servicio de push de Expo
#
#  La app del celular (React Native + Expo) registra su "ExponentPushToken"
#  con POST /portal/{token}/push-movil. Para avisarle, hacemos UN POST al
#  servicio de Expo (gratis, sin llaves) y Expo se encarga de repartir a
#  Google (Android) y Apple (iPhone) por nosotros.
# ============================================================
URL_PUSH_EXPO = "https://exp.host/--/api/v2/push/send"


def enviar_push_expo(db, suscripcion, titulo: str, cuerpo: str) -> bool:
    """
    Manda UNA notificación a UN celular con la app. Devuelve True si salió.
    Si Expo responde "DeviceNotRegistered" (desinstaló la app o quitó el
    permiso), borramos la suscripción para no insistir.
    """
    peticion = urllib.request.Request(
        URL_PUSH_EXPO,
        data=json.dumps({
            "to": suscripcion.endpoint,   # el ExponentPushToken del celular
            "title": titulo,
            "body": cuerpo,
            "sound": "default",
        }).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=15) as r:
            respuesta = json.load(r)
    except Exception:
        # Sin internet o Expo caído: hoy no llegó, mañana se reintenta.
        return False

    dato = respuesta.get("data") or {}
    if isinstance(dato, list):  # Expo responde lista si mandas varios
        dato = dato[0] if dato else {}
    if dato.get("status") == "ok":
        return True

    detalles = dato.get("details") or {}
    if detalles.get("error") == "DeviceNotRegistered":
        db.delete(suscripcion)
        db.commit()
    return False


# ============================================================
#  WhatsApp (Fase 4) — vía la API oficial de Meta (Cloud API)
#
#  Se configura con variables de entorno (nunca en el código):
#    WHATSAPP_TOKEN     -> el token permanente de la app de Meta
#    WHATSAPP_PHONE_ID  -> el ID del número emisor (no es el número en sí)
#    WHATSAPP_PAIS      -> indicativo del país, "57" (Colombia) por defecto
#
#  Sin credenciales -> MODO SIMULACIÓN (se imprime en consola), igual que
#  el correo sin SMTP. Así se desarrolla y prueba sin gastar un peso.
#
#  LA REGLA DE ORO DE META (importante para el MVP): un negocio solo puede
#  mandar TEXTO LIBRE dentro de las 24 horas siguientes al último mensaje
#  DEL cliente. Un recordatorio proactivo (nuestro caso) exige una
#  PLANTILLA pre-aprobada por Meta. Por eso hay dos modos:
#
#    WHATSAPP_PLANTILLA sin definir -> texto libre (sirve para probar con
#      el número de prueba de Meta, o si el cliente escribió hace <24 h).
#    WHATSAPP_PLANTILLA=recordatorio_mantenimiento -> usa la plantilla
#      aprobada. ESTE es el modo del piloto en producción.
#
#  La plantilla sugerida (se registra UNA vez en el panel de Meta,
#  categoría "Utility", idioma es_CO), con 3 variables:
#    "Hola {{1}}, del taller te recordamos que tu vehículo {{2}} tiene
#     pendiente: {{3}}. Responde este mensaje para agendar tu cita."
# ============================================================
def normalizar_telefono(telefono: str) -> str:
    """
    Deja el número como lo exige la API: solo dígitos con indicativo de país.
    Ej: "300 123 4567" -> "573001234567" (celular colombiano de 10 dígitos).
    """
    digitos = re.sub(r"\D", "", telefono or "")
    pais = os.environ.get("WHATSAPP_PAIS", "57")
    if len(digitos) == 10 and not digitos.startswith(pais):
        digitos = pais + digitos
    return digitos


def _cuerpo_whatsapp(numero: str, texto: str, variables=None) -> dict:
    """
    Arma el JSON que espera la API de Meta. Si hay plantilla configurada Y
    variables, manda mensaje de plantilla (el único que llega de forma
    proactiva); si no, texto libre (solo sirve dentro de la ventana de 24 h
    o con el número de prueba de Meta).
    """
    plantilla = os.environ.get("WHATSAPP_PLANTILLA")
    if plantilla and variables:
        return {
            "messaging_product": "whatsapp",
            "to": numero,
            "type": "template",
            "template": {
                "name": plantilla,
                "language": {"code": os.environ.get("WHATSAPP_IDIOMA", "es_CO")},
                "components": [{
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(v)} for v in variables],
                }],
            },
        }
    return {
        "messaging_product": "whatsapp",
        "to": numero,
        "type": "text",
        "text": {"body": texto},
    }


def enviar_whatsapp(telefono: str, texto: str, variables=None) -> str | None:
    """
    Envía UN mensaje de WhatsApp. Devuelve "enviado", "simulado", o None
    si falló (número inválido, sin internet, token vencido...).

    `variables` son los valores para la plantilla (nombre, placa, lista de
    pendientes). Solo se usan si WHATSAPP_PLANTILLA está configurada.
    """
    numero = normalizar_telefono(telefono)
    if not numero:
        return None

    token = os.environ.get("WHATSAPP_TOKEN")
    phone_id = os.environ.get("WHATSAPP_PHONE_ID")
    cuerpo = _cuerpo_whatsapp(numero, texto, variables)

    if not token or not phone_id:
        # --- Modo simulación: no hay credenciales de Meta ---
        print("=" * 60)
        print("[SIMULACIÓN WHATSAPP — configura WHATSAPP_TOKEN y WHATSAPP_PHONE_ID]")
        print(f"Para:    +{numero}   (modo: {cuerpo['type']})")
        print("-" * 60)
        print(texto)
        print("=" * 60)
        return "simulado"

    peticion = urllib.request.Request(
        f"https://graph.facebook.com/v20.0/{phone_id}/messages",
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=20):
            return "enviado"
    except urllib.error.HTTPError as error:
        # Meta explica el motivo en el cuerpo de la respuesta: lo mostramos
        # completo, porque "error 400" a secas no le sirve a nadie.
        detalle = error.read().decode("utf-8", errors="replace")
        print(f"[WhatsApp] Meta rechazó el envío a +{numero}: {detalle}")
        return None
    except Exception as error:
        # Un número dañado no debe tumbar el proceso del día completo.
        print(f"[WhatsApp] No se pudo enviar a +{numero}: {error}")
        return None


def redactar_whatsapp(nombre_taller, cliente, vehiculo, pendientes) -> str:
    """Mensaje corto (WhatsApp no es un correo): saludo, lista y llamado a agendar."""
    lineas = [f"Hola {cliente.nombre}, te saluda *{nombre_taller}*."]
    vencidos = [p for p in pendientes if p["estado"] == "vencido"]
    proximos = [p for p in pendientes if p["estado"] == "proximo"]
    if vencidos:
        lineas.append(f"Tu vehículo {vehiculo.placa} tiene mantenimientos *vencidos*:")
        lineas += [f"• {p['tipo']}" for p in vencidos]
    if proximos:
        lineas.append("Próximos a vencerse:")
        lineas += [f"• {p['tipo']}" for p in proximos]
    lineas.append("Responde este mensaje para agendar tu cita.")
    portal_url = os.environ.get("PORTAL_URL")
    if portal_url and getattr(cliente, "token_acceso", None):
        lineas.append(f"Estado completo: {portal_url}/app/?t={cliente.token_acceso}")
    return "\n".join(lineas)


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
        "whatsapp": 0,                # mensajes de WhatsApp (Fase 4)
        "avisos": 0,
        "omitidos_sin_contacto": 0,   # clientes sin correo, push NI teléfono
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

        # ¿Cómo contactamos al cliente? Correo, push y/o WhatsApp.
        cliente = vehiculo.cliente
        suscripciones = db.query(models.SuscripcionPush).filter(
            models.SuscripcionPush.cliente_id == cliente.id
        ).all() if cliente else []
        if not cliente or (not cliente.email and not suscripciones
                           and not cliente.telefono):
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
                # Cada dispositivo sabe su canal: navegador (web) o celular (expo).
                if (suscripcion.tipo or "web") == "expo":
                    entregado = enviar_push_expo(db, suscripcion, titulo_push, cuerpo_push)
                else:
                    entregado = enviar_push(db, suscripcion, titulo_push, cuerpo_push)
                if entregado:
                    push_entregados += 1
            resumen["push"] += push_entregados

        # Y el WhatsApp, si el cliente dejó su teléfono (Fase 4).
        modo_whatsapp = None
        if cliente.telefono:
            texto = redactar_whatsapp(taller.nombre, cliente, vehiculo, nuevos)
            # Las 3 variables de la plantilla aprobada: {{1}} nombre,
            # {{2}} placa, {{3}} lista de pendientes separada por comas.
            variables = (
                cliente.nombre,
                vehiculo.placa,
                ", ".join(p["tipo"] for p in nuevos),
            )
            modo_whatsapp = enviar_whatsapp(cliente.telefono, texto, variables)
            if modo_whatsapp:
                resumen["whatsapp"] += 1

        # Dejamos constancia de cada aviso para no repetirlo mañana.
        canales = []
        if modo:
            canales.append("email" if modo == "enviado" else "email_simulado")
        if push_entregados:
            canales.append("push")
        if modo_whatsapp:
            canales.append("whatsapp" if modo_whatsapp == "enviado" else "whatsapp_simulado")
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
            "whatsapp": modo_whatsapp,
        })

    return resumen
