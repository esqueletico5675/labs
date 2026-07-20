"""
Consejos de mantenimiento ("¿Sabías que…?") — versión del SERVIDOR.

¿Por qué una copia aquí si ya existen en la app (movil/src/consejos.js)?
Porque las notificaciones push las arma el SERVIDOR, no la app: el celular
solo las recibe. Por eso el texto tiene que vivir también en Python.

Si cambias esta lista, cambia también movil/src/consejos.js para que la
tarjeta dentro de la app y la notificación digan lo mismo.

Los kilómetros son ORIENTATIVOS (varían por vehículo); por eso el aviso
cierra invitando a consultar con el taller.
"""
import time

CONSEJOS = [
    "las pastillas de freno suelen cambiarse entre los 40.000 y 50.000 km, pero si oyes un chirrido al frenar, no esperes.",
    "el aceite del motor diésel se cambia en promedio cada 10.000 km o cada 6 meses, lo que pase primero.",
    "un filtro de aire tapado hace que el motor gaste más combustible. Muchos se cambian cerca de los 20.000 km.",
    "el filtro de combustible es clave en un diésel: si se ensucia, el motor pierde fuerza. Suele cambiarse cada 30.000 km.",
    "el líquido de frenos absorbe humedad con el tiempo y pierde eficacia; muchos fabricantes lo cambian cada 2 años.",
    "el refrigerante evita que el motor se recaliente. Revisar su nivel de vez en cuando te ahorra un daño caro.",
    "rotar las llantas (cambiarlas de posición) cada 10.000 km hace que duren más parejo y más tiempo.",
    "la correa de repartición, si tu motor la usa, es de las piezas más importantes: si se rompe andando, el daño es grave.",
    "reportar tu kilometraje en la app ayuda a que los avisos te lleguen justo a tiempo, ni antes ni después.",
    "arrancar y dejar calentar el diésel unos segundos antes de exigirle alarga la vida del motor.",
    "una revisión a tiempo casi siempre cuesta mucho menos que reparar la pieza cuando ya falló.",
    "el filtro de habitáculo (el del aire que respiras dentro del carro) también se cambia; muchos lo hacen cada año.",
]


def consejo_del_dia() -> str:
    """
    El consejo "del día": rota solo con la fecha, así todos los clientes
    reciben el MISMO dato el mismo día y cambia al siguiente. Misma fórmula
    que la app (días transcurridos desde 1970).
    """
    dia = int(time.time() // 86400)
    return CONSEJOS[dia % len(CONSEJOS)]
