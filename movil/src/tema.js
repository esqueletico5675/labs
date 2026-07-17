// ============================================================
//  TEMA — el sistema de diseño de la app (una sola fuente de verdad)
// ============================================================
// Regla de oro: NINGUNA pantalla inventa colores ni tamaños.
// Rediseño v2: tema CLARO y amigable. Fondo suave, tarjetas blancas
// con sombra, colores de estado con su versión "pastel" de fondo.
// Se lee mejor a pleno sol (¡en un taller!) y se siente cercano.

export const COLORES = {
  fondo: '#eef2f7',        // gris azulado muy suave (no blanco puro: cansa menos)
  tarjeta: '#ffffff',      // tarjetas blancas
  borde: '#e2e8f0',        // bordes casi invisibles
  texto: '#0f172a',        // texto principal (azul casi negro)
  textoSuave: '#64748b',   // texto secundario
  primario: '#2563eb',     // azul de acción (botones, enlaces)
  primarioOscuro: '#1e40af', // azul de la cabecera
  primarioSuave: '#dbeafe',  // fondo azul pastel

  // Estados: color fuerte (texto/íconos) + fondo pastel (superficies).
  // Elegidos con contraste AA sobre blanco y distinguibles con daltonismo.
  alDia: '#047857',    alDiaFondo: '#d1fae5',
  proximo: '#b45309',  proximoFondo: '#fef3c7',
  vencido: '#dc2626',  vencidoFondo: '#fee2e2',

  placaFondo: '#fbbf24',   // amarillo placa colombiana
  placaTexto: '#111827',
  blanco: '#ffffff',
};

// Sombra suave estándar de todas las tarjetas (elevation es la de Android).
export const SOMBRA = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

// Espaciados consistentes (múltiplos de 4, estándar en diseño móvil).
export const ESPACIO = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };

// Radio de las esquinas: bien redondeadas = sensación amigable.
export const RADIO = { tarjeta: 20, boton: 16, campo: 14 };

// Tamaños de letra: grandes a propósito (usuarios no técnicos,
// muchos leerán sin gafas en el taller).
export const LETRA = {
  titulo: 28,
  subtitulo: 20,
  normal: 17,
  pequena: 14,
  placa: 26,
};

// Alto mínimo de todo lo tocable (dedos grandes, guantes de mecánico).
export const ALTO_TOQUE = 54;

// ============================================================
//  Los 3 estados, en LENGUAJE COTIDIANO.
// ============================================================
// El backend dice "vencido / proximo / al_dia". El cliente ve color +
// ícono + nombre + LA ACCIÓN a tomar. Nunca un color solo.
export const ESTADOS = {
  vencido: {
    color: COLORES.vencido,
    fondo: COLORES.vencidoFondo,
    icono: '🔴',
    nombre: 'Necesita taller',
    accion: 'Pide tu cita ya',
    orden: 0, // el más urgente primero
  },
  proximo: {
    color: COLORES.proximo,
    fondo: COLORES.proximoFondo,
    icono: '🟠',
    nombre: 'Revisar pronto',
    accion: 'Agenda con calma esta semana',
    orden: 1,
  },
  al_dia: {
    color: COLORES.alDia,
    fondo: COLORES.alDiaFondo,
    icono: '🟢',
    nombre: 'Todo al día',
    accion: 'No tienes que hacer nada',
    orden: 2,
  },
};

// Ícono según el nombre del mantenimiento: se reconoce sin leer.
export function iconoMantenimiento(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('aceite')) return '🛢️';
  if (n.includes('freno')) return '🛑';
  if (n.includes('combustible')) return '⛽';
  if (n.includes('aire') || n.includes('habitáculo') || n.includes('polen')) return '💨';
  if (n.includes('refrigerante')) return '❄️';
  if (n.includes('llanta') || n.includes('rotación')) return '🛞';
  if (n.includes('batería')) return '🔋';
  if (n.includes('correa')) return '⚙️';
  return '🔧';
}

// Peor estado de un vehículo (lo único que mostramos en la lista).
export function peorEstado(mantenimientos) {
  let peor = 'al_dia';
  for (const m of mantenimientos || []) {
    if (ESTADOS[m.estado] && ESTADOS[m.estado].orden < ESTADOS[peor].orden) {
      peor = m.estado;
    }
  }
  return peor;
}

// Qué tan "gastado" va un mantenimiento, de 0 (recién hecho) a 1 (vencido).
// Sirve para la barrita de progreso. Usa km o meses, lo que haya.
export function fraccionUso(m) {
  const porKm =
    m.intervalo_km && m.km_faltantes !== null && m.km_faltantes !== undefined
      ? 1 - m.km_faltantes / m.intervalo_km
      : null;
  const porMeses =
    m.intervalo_meses && m.meses_faltantes !== null && m.meses_faltantes !== undefined
      ? 1 - m.meses_faltantes / m.intervalo_meses
      : null;
  const valores = [porKm, porMeses].filter((v) => v !== null && !Number.isNaN(v));
  if (valores.length === 0) return m.estado === 'vencido' ? 1 : null;
  // El más avanzado de los dos, acotado entre 0 y 1.
  return Math.max(0, Math.min(1, Math.max(...valores)));
}

// Frase corta y humana para UN mantenimiento.
export function fraseMantenimiento(m) {
  const km = m.km_faltantes;
  const meses = m.meses_faltantes;

  if (m.estado === 'vencido') {
    if (km !== null && km !== undefined && km < 0) {
      return `Vencido hace ${formatearKm(-km)} km`;
    }
    if (meses !== null && meses !== undefined && meses < 0) {
      return `Vencido hace ${formatearMeses(-meses)}`;
    }
    return 'Ya se venció';
  }
  if (m.estado === 'proximo') {
    if (km !== null && km !== undefined && km >= 0) {
      return `Te toca en unos ${formatearKm(km)} km`;
    }
    if (meses !== null && meses !== undefined && meses >= 0) {
      return `Te toca en ${formatearMeses(meses)}`;
    }
    return 'Te toca pronto';
  }
  return 'Al día';
}

// 12345 -> "12.345" (así se escriben los números en Colombia).
export function formatearKm(km) {
  return Math.round(Math.abs(km)).toLocaleString('es-CO');
}

function formatearMeses(meses) {
  const m = Math.abs(meses);
  if (m < 1) return 'unas semanas';
  const redondo = Math.round(m);
  return redondo === 1 ? '1 mes' : `${redondo} meses`;
}
