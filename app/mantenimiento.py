"""
EL MOTOR DE RECORDATORIOS (el cerebro del producto).

Aquí vive la lógica que responde: "¿a este carro ya le toca algún mantenimiento?"

Funciona combinando dos criterios y avisa por el que se cumpla PRIMERO:
  1) Por kilometraje  -> ej. cambio de aceite cada 10.000 km
  2) Por tiempo       -> ej. o cada 6 meses

El reto del kilometraje (que al cliente le da pereza reportar) se resuelve
ESTIMÁNDOLO: sabemos el último km que registró el taller y en qué fecha, y
calculamos un promedio de km/mes con el historial. Así proyectamos el km de
hoy sin molestar al cliente.
"""

from datetime import datetime

from .utilidades import ahora_utc

# Intervalos de mantenimiento diésel sugeridos (punto de partida).
# OJO: son ORIENTATIVOS. Cada taller debería poder ajustarlos, e idealmente
# configurarlos por marca/modelo. Siempre manda el manual del fabricante.
# Formato: (nombre, intervalo_km, intervalo_meses)   -> None = no aplica
INTERVALOS_DIESEL_POR_DEFECTO = [
    ("Cambio de aceite y filtro de aceite", 10000, 6),
    ("Filtro de combustible", 30000, None),
    ("Filtro de aire", 20000, None),
    ("Pastillas de freno", 50000, None),
    ("Líquido de frenos", None, 24),
    ("Refrigerante", 50000, None),
    ("Filtro de habitáculo (polen)", 20000, 12),
    ("Rotación de llantas", 10000, None),
]

# Si un vehículo aún no tiene historial suficiente, asumimos este promedio
# para estimar (un valor conservador; el taller puede cambiarlo).
KM_PROMEDIO_MENSUAL_POR_DEFECTO = 1500


def meses_entre(fecha_inicio: datetime, fecha_fin: datetime) -> float:
    """Cantidad aproximada de meses entre dos fechas (usando 30.44 días/mes)."""
    dias = (fecha_fin - fecha_inicio).days
    return dias / 30.44


def estimar_km_actual(vehiculo, km_promedio_mensual=None, hoy=None) -> int:
    """
    Estima el kilometraje de HOY a partir del último dato conocido.

    km_estimado = km_actual + (km/mes) * (meses transcurridos desde la lectura)
    """
    if hoy is None:
        hoy = ahora_utc()
    if km_promedio_mensual is None:
        km_promedio_mensual = KM_PROMEDIO_MENSUAL_POR_DEFECTO

    meses = meses_entre(vehiculo.fecha_km, hoy)
    if meses < 0:
        meses = 0
    return int(vehiculo.km_actual + km_promedio_mensual * meses)


def calcular_km_promedio_mensual(ingresos) -> float:
    """
    Calcula el promedio de km/mes del vehículo usando su historial de ingresos.
    Si no hay suficientes datos, devuelve el valor por defecto.
    """
    if not ingresos or len(ingresos) < 2:
        return KM_PROMEDIO_MENSUAL_POR_DEFECTO

    ordenados = sorted(ingresos, key=lambda i: i.fecha)
    primero, ultimo = ordenados[0], ordenados[-1]

    km_recorridos = ultimo.kilometraje - primero.kilometraje
    meses = meses_entre(primero.fecha, ultimo.fecha)

    if meses <= 0 or km_recorridos <= 0:
        return KM_PROMEDIO_MENSUAL_POR_DEFECTO
    return km_recorridos / meses


def revisar_mantenimientos(vehiculo, tipos, ultimos_realizados, ingresos, hoy=None):
    """
    Revisa un vehículo contra todas las reglas y devuelve el estado de cada
    mantenimiento: si ya toca (vencido), si está próximo, o si está al día.

    Parámetros:
      vehiculo            -> el objeto Vehiculo
      tipos               -> lista de TipoMantenimiento del taller
      ultimos_realizados  -> dict {tipo_id: (fecha, km)} de la última vez que
                             se hizo cada mantenimiento a este vehículo
      ingresos            -> historial de ingresos (para estimar km/mes)

    Devuelve una lista de diccionarios, uno por tipo de mantenimiento.
    """
    if hoy is None:
        hoy = ahora_utc()

    km_mensual = calcular_km_promedio_mensual(ingresos)
    km_estimado = estimar_km_actual(vehiculo, km_mensual, hoy)

    resultados = []
    for tipo in tipos:
        # ¿Cuándo se hizo por última vez? Si nunca, usamos la primera lectura
        # conocida del vehículo como punto de partida.
        if tipo.id in ultimos_realizados:
            fecha_ult, km_ult = ultimos_realizados[tipo.id]
        else:
            fecha_ult, km_ult = vehiculo.fecha_km, vehiculo.km_actual

        vencido = False
        motivo = []

        # --- Criterio por kilometraje ---
        km_faltantes = None
        if tipo.intervalo_km:
            km_objetivo = km_ult + tipo.intervalo_km
            km_faltantes = km_objetivo - km_estimado
            if km_faltantes <= 0:
                vencido = True
                motivo.append("por kilometraje")

        # --- Criterio por tiempo ---
        meses_faltantes = None
        if tipo.intervalo_meses:
            meses_pasados = meses_entre(fecha_ult, hoy)
            meses_faltantes = tipo.intervalo_meses - meses_pasados
            if meses_faltantes <= 0:
                vencido = True
                motivo.append("por tiempo")

        # "Próximo" = falta poco (dentro del 15% del intervalo de km, o 1 mes).
        proximo = False
        if not vencido:
            if km_faltantes is not None and tipo.intervalo_km:
                if km_faltantes <= tipo.intervalo_km * 0.15:
                    proximo = True
            if meses_faltantes is not None and meses_faltantes <= 1:
                proximo = True

        estado = "vencido" if vencido else ("proximo" if proximo else "al_dia")

        resultados.append({
            "tipo_id": tipo.id,
            "tipo": tipo.nombre,
            "estado": estado,
            # Los intervalos de la regla: la PWA los usa para dibujar los
            # medidores (qué tanto del intervalo ya se consumió).
            "intervalo_km": tipo.intervalo_km,
            "intervalo_meses": tipo.intervalo_meses,
            "motivo": " y ".join(motivo) if motivo else None,
            "km_estimado": km_estimado,
            "km_faltantes": km_faltantes,
            "meses_faltantes": round(meses_faltantes, 1) if meses_faltantes is not None else None,
        })

    return resultados


def calcular_recordatorios(db, vehiculo):
    """
    Reúne desde la base de datos todo lo que el motor necesita para UN
    vehículo (reglas del taller, historial, últimos mantenimientos) y llama
    a revisar_mantenimientos().

    ¿Por qué existe? Para que el endpoint de la API y el envío de correos
    (Fase 2) usen EXACTAMENTE la misma lógica, sin copiar y pegar código.
    """
    from . import models  # import local para evitar dependencias circulares

    # Reglas de mantenimiento del taller dueño del vehículo.
    tipos = db.query(models.TipoMantenimiento).filter(
        models.TipoMantenimiento.taller_id == vehiculo.taller_id
    ).all()

    # Historial de ingresos del vehículo (para estimar km/mes).
    ingresos = db.query(models.Ingreso).filter(
        models.Ingreso.vehiculo_id == vehiculo.id
    ).all()

    # Última vez que se hizo cada tipo de mantenimiento a este vehículo.
    ultimos = {}
    for ing in ingresos:
        for realizado in ing.mantenimientos:
            actual = ultimos.get(realizado.tipo_id)
            if actual is None or ing.fecha > actual[0]:
                ultimos[realizado.tipo_id] = (ing.fecha, ing.kilometraje)

    return revisar_mantenimientos(
        vehiculo=vehiculo,
        tipos=tipos,
        ultimos_realizados=ultimos,
        ingresos=ingresos,
    )
