// ============================================================
//  CONSEJOS — datos curiosos de mantenimiento ("¿Sabías que…?")
// ============================================================
// Educan al dueño sin ser una notificación de "te toca". Son
// ORIENTATIVOS: los kilómetros exactos varían por marca y modelo, por
// eso la tarjeta SIEMPRE cierra con "consulta con tu taller". Escritos
// en lenguaje cotidiano, para clientes no técnicos.
//
// No dependen del backend: viven en la app y no gastan datos.

export const CONSEJOS = [
  'las pastillas de freno suelen cambiarse entre los 40.000 y 50.000 km, pero si oyes un chirrido al frenar, no esperes.',
  'el aceite del motor diésel se cambia en promedio cada 10.000 km o cada 6 meses, lo que pase primero.',
  'un filtro de aire tapado hace que el motor gaste más combustible. Muchos se cambian cerca de los 20.000 km.',
  'el filtro de combustible es clave en un diésel: si se ensucia, el motor pierde fuerza. Suele cambiarse cada 30.000 km.',
  'el líquido de frenos absorbe humedad con el tiempo y pierde eficacia; muchos fabricantes lo cambian cada 2 años.',
  'el refrigerante evita que el motor se recaliente. Revisar su nivel de vez en cuando te ahorra un daño caro.',
  'rotar las llantas (cambiarlas de posición) cada 10.000 km hace que duren más parejo y más tiempo.',
  'la correa de repartición, si tu motor la usa, es de las piezas más importantes: si se rompe andando, el daño es grave.',
  'reportar tu kilometraje en la app ayuda a que los avisos te lleguen justo a tiempo, ni antes ni después.',
  'arrancar y dejar calentar el diésel unos segundos antes de exigirle alarga la vida del motor.',
  'una revisión a tiempo casi siempre cuesta mucho menos que reparar la pieza cuando ya falló.',
  'el filtro de habitáculo (el del aire que respiras dentro del carro) también se cambia; muchos lo hacen cada año.',
];

// El consejo "del día": estable durante todo el día (no cambia cada
// segundo), pero rota solo con la fecha. Así se siente como un dato nuevo
// cada mañana sin repetir el mismo siempre.
export function consejoDelDia() {
  const dia = Math.floor(Date.now() / 86400000); // días desde 1970
  return CONSEJOS[dia % CONSEJOS.length];
}
