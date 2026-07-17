"""
Prueba rápida del canal WhatsApp — para verificar credenciales de Meta.

Uso:
    python probar_whatsapp.py 3001234567

Qué hace:
  - Sin WHATSAPP_TOKEN / WHATSAPP_PHONE_ID -> simula (verás el mensaje aquí).
  - Con credenciales -> envía UN mensaje real a ese número.
  - Con WHATSAPP_PLANTILLA definida -> prueba la plantilla aprobada
    (el modo del piloto); sin ella, texto libre (solo funciona con el
    número de prueba de Meta o dentro de la ventana de 24 h).

OJO con el número de prueba de Meta: solo puede escribirle a máximo 5
números que hayas verificado antes en el panel de Meta (Getting Started).
Si Meta rechaza el envío, este script imprime el motivo completo.
"""

import sys

from app.notificaciones import enviar_whatsapp

if len(sys.argv) != 2:
    raise SystemExit("Uso: python probar_whatsapp.py <numero>   ej: 3001234567")

numero = sys.argv[1]
resultado = enviar_whatsapp(
    numero,
    "Mensaje de prueba del sistema de recordatorios del taller. "
    "Si lo recibiste, ¡el canal WhatsApp quedó funcionando!",
    # variables de la plantilla: {{1}} nombre, {{2}} placa, {{3}} pendientes
    variables=("Cliente de prueba", "ABC123", "Cambio de aceite"),
)

print(f"\nResultado: {resultado}")
if resultado == "simulado":
    print("Para enviar de verdad define WHATSAPP_TOKEN y WHATSAPP_PHONE_ID "
          "(ver GUIA_PILOTO.md, paso WhatsApp).")
elif resultado == "enviado":
    print("Revisa el WhatsApp del número destino.")
else:
    print("Falló: lee el motivo de Meta impreso arriba (token vencido, "
          "número no verificado en modo prueba, o plantilla no aprobada).")
