// ============================================================
//  TEMA — el sistema de diseño de la app (una sola fuente de verdad)
// ============================================================
// Regla de oro: NINGUNA pantalla inventa colores ni tamaños.
// Todo sale de aquí. Así la app entera se ve y se siente igual.

// Paleta compartida con el portal web. Los 3 colores de estado están
// validados para daltonismo, y NUNCA van solos: siempre con palabra e ícono.
export const COLORES = {
  fondo: '#10161f',       // fondo general (azul muy oscuro)
  tarjeta: '#1a2230',     // tarjetas y cajas
  borde: '#2a3648',       // bordes sutiles
  texto: '#f1f5f9',       // texto principal (casi blanco)
  textoSuave: '#94a3b8',  // texto secundario (gris azulado)
  primario: '#3b82f6',    // botones de acción (azul)
  alDia: '#059669',       // verde  — todo bien
  proximo: '#d97706',     // ámbar  — atención pronto
  vencido: '#ef4444',     // rojo   — acción ya
  placaFondo: '#fbbf24',  // amarillo placa colombiana
  placaTexto: '#111827',  // texto negro de la placa
};

// Espaciados consistentes (múltiplos de 4, estándar en diseño móvil).
export const ESPACIO = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };

// Tamaños de letra: grandes a propósito. Nuestros usuarios no son
// técnicos y muchos leerán sin gafas en el taller.
export const LETRA = {
  titulo: 28,
  subtitulo: 20,
  normal: 17,
  pequena: 14,
  placa: 26,
};

// Alto mínimo de todo lo tocable (dedos grandes, guantes de mecánico).
export const ALTO_TOQUE = 52;

// ============================================================
//  Los 3 estados, traducidos a LENGUAJE COTIDIANO.
// ============================================================
// El backend dice "vencido / proximo / al_dia". El cliente no tiene por
// qué entender jerga: cada estado tiene su color, su ícono, su nombre
// y LA ACCIÓN que debe tomar. Eso responde siempre "¿y yo qué hago?".
export const ESTADOS = {
  vencido: {
    color: COLORES.vencido,
    icono: '🔴',
    nombre: 'Necesita taller',
    accion: 'Pide tu cita ya',
    orden: 0, // el más urgente primero
  },
  proximo: {
    color: COLORES.proximo,
    icono: '🟠',
    nombre: 'Revisar pronto',
    accion: 'Agenda con calma esta semana',
    orden: 1,
  },
  al_dia: {
    color: COLORES.alDia,
    icono: '🟢',
    nombre: 'Todo al día',
    accion: 'No tienes que hacer nada',
    orden: 2,
  },
};

// Dado un vehículo con su lista de mantenimientos, devuelve el PEOR
// estado (el más urgente). Es lo único que mostramos en la lista de
// vehículos: un resumen, no veinte detalles.
export function peorEstado(mantenimientos) {
  let peor = 'al_dia';
  for (const m of mantenimientos || []) {
    if (ESTADOS[m.estado] && ESTADOS[m.estado].orden < ESTADOS[peor].orden) {
      peor = m.estado;
    }
  }
  return peor;
}

// Frase corta y humana para UN mantenimiento. Ejemplos:
//  "Vencido hace 500 km" · "Te toca en unos 2.000 km" · "Al día"
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
