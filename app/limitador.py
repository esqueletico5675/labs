"""
Rate limit (límite de peticiones) — un freno simple contra abusos.

¿Qué problema resuelve? Sin freno, alguien podría martillar la API con
miles de peticiones por segundo: probar contraseñas, tumbar el servidor o
raspar datos. Este límite corta a quien pase de cierto número de peticiones
por minuto (contadas por dirección IP) y le responde 429 ("muchas
peticiones, espera").

Cómo funciona (ventana deslizante): por cada IP guardamos la hora de sus
últimas peticiones; si en los últimos 60 segundos ya hizo más de LÍMITE,
se le frena hasta que la ventana avance.

Limitaciones honestas (aceptadas para el piloto de un servidor):
  - Vive en MEMORIA: se reinicia cuando se reinicia el servidor, y si un día
    corres varios servidores, cada uno cuenta por su lado. Igual que el
    bloqueo anti fuerza bruta del login. Cuando escales, esto se movería a
    Redis.
  - Cuenta por IP: varios empleados del taller tras el mismo WiFi comparten
    IP. Por eso el límite por defecto es holgado (un humano normal jamás lo
    alcanza; un ataque automático sí).

El límite se ajusta con la variable de entorno RATE_LIMIT_POR_MINUTO.
"""
import os
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

VENTANA_SEG = 60
LIMITE = int(os.environ.get("RATE_LIMIT_POR_MINUTO", "180"))

# ip -> deque con las horas (monotónicas) de sus últimas peticiones.
_accesos: dict[str, deque] = defaultdict(deque)
_peticiones_desde_limpieza = 0
_LIMPIAR_CADA = 500  # cada tantas peticiones, barremos IPs inactivas


def _ip_cliente(request: Request) -> str:
    """
    La IP real del visitante. Detrás de un proxy (Render, Cloudflare) la IP
    del cliente NO es request.client.host (esa es la del proxy): la real
    viaja en el encabezado X-Forwarded-For, primer valor de la lista.
    """
    reenviada = request.headers.get("x-forwarded-for")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.client.host if request.client else "desconocida"


def _limpiar_inactivas(limite_tiempo: float):
    """Borra IPs sin peticiones recientes para que el diccionario no crezca sin fin."""
    vacias = [ip for ip, cola in _accesos.items()
              if not cola or cola[-1] < limite_tiempo]
    for ip in vacias:
        del _accesos[ip]


async def limitar_peticiones(request: Request, call_next):
    """Middleware: cuenta las peticiones por IP y frena a quien se pase."""
    global _peticiones_desde_limpieza

    ahora = time.monotonic()
    limite_tiempo = ahora - VENTANA_SEG
    cola = _accesos[_ip_cliente(request)]

    # Sacamos de la cola las peticiones que ya salieron de la ventana de 60 s.
    while cola and cola[0] < limite_tiempo:
        cola.popleft()

    if len(cola) >= LIMITE:
        return JSONResponse(
            status_code=429,
            content={"detail": "Demasiadas peticiones. Espera un momento e intenta de nuevo."},
        )

    cola.append(ahora)

    # Cada tantas peticiones, limpiamos IPs viejas (barato y ocasional).
    _peticiones_desde_limpieza += 1
    if _peticiones_desde_limpieza >= _LIMPIAR_CADA:
        _peticiones_desde_limpieza = 0
        _limpiar_inactivas(limite_tiempo)

    return await call_next(request)
