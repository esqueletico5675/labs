// ============================================================
//  TEMA — el sistema de diseño de la app (una sola fuente de verdad)
// ============================================================
// Regla de oro: NINGUNA pantalla inventa colores ni tamaños.
// v3: DOS paletas (clara y oscura). El usuario elige en Ajustes y
// toda la app se repinta sola, porque todo sale de aquí.

export const PALETAS = {
  // --- MODO CLARO: amigable, se lee bien a pleno sol ---
  claro: {
    fondo: '#eef2f7',        // gris azulado muy suave
    tarjeta: '#ffffff',
    borde: '#e2e8f0',
    texto: '#0f172a',
    textoSuave: '#64748b',
    primario: '#2563eb',
    primarioOscuro: '#1e40af', // cabecera azul
    primarioSuave: '#dbeafe',

    // Estados: color fuerte (texto/íconos) + fondo pastel (superficies).
    alDia: '#047857',    alDiaFondo: '#d1fae5',
    proximo: '#b45309',  proximoFondo: '#fef3c7',
    vencido: '#dc2626',  vencidoFondo: '#fee2e2',

    placaFondo: '#fbbf24',
    placaTexto: '#111827',
    blanco: '#ffffff',
  },

  // --- MODO OSCURO: para la noche y para ahorrar batería ---
  oscuro: {
    fondo: '#10161f',        // azul casi negro (el del portal)
    tarjeta: '#1a2230',
    borde: '#2a3648',
    texto: '#f1f5f9',
    textoSuave: '#94a3b8',
    primario: '#3b82f6',
    primarioOscuro: '#1e40af',
    primarioSuave: '#1e3a5f',

    // Mismos estados, versión para fondo oscuro: texto más brillante,
    // fondo del color pero bien apagado.
    alDia: '#34d399',    alDiaFondo: '#0b3b2e',
    proximo: '#fbbf24',  proximoFondo: '#42300a',
    vencido: '#f87171',  vencidoFondo: '#4c1717',

    placaFondo: '#fbbf24',   // la placa es amarilla en cualquier mundo
    placaTexto: '#111827',
    blanco: '#ffffff',
  },
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
// Lo fijo (ícono, nombre, acción, orden) vive aquí; el color depende
// de la paleta activa y se obtiene con infoEstado(estado, colores).
export const ESTADOS = {
  vencido: {
    icono: '🔴',
    nombre: 'Necesita taller',
    accion: 'Pide tu cita ya',
    orden: 0, // el más urgente primero
  },
  proximo: {
    icono: '🟠',
    nombre: 'Revisar pronto',
    accion: 'Agenda con calma esta semana',
    orden: 1,
  },
  al_dia: {
    icono: '🟢',
    nombre: 'Todo al día',
    accion: 'No tienes que hacer nada',
    orden: 2,
  },
};

// Junta lo fijo del estado con los colores de la paleta activa.
const CLAVES_COLOR = {
  vencido: ['vencido', 'vencidoFondo'],
  proximo: ['proximo', 'proximoFondo'],
  al_dia: ['alDia', 'alDiaFondo'],
};

export function infoEstado(estado, colores) {
  const clave = ESTADOS[estado] ? estado : 'al_dia';
  const [c, f] = CLAVES_COLOR[clave];
  return { ...ESTADOS[clave], color: colores[c], fondo: colores[f] };
}

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
