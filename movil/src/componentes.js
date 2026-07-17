// ============================================================
//  COMPONENTES — las piezas de LEGO que comparten las pantallas
// ============================================================
// Si un botón se ve de una forma en una pantalla, se ve IGUAL en todas.
// Eso es lo que hace que una app se sienta "bien hecha".

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ALTO_TOQUE, COLORES, ESPACIO, ESTADOS, LETRA } from './tema';

// --- Botón principal: grande, texto claro, imposible de no ver ---
export function Boton({ titulo, onPress, deshabilitado, tono = 'primario' }) {
  const fondo = tono === 'peligro' ? COLORES.vencido : COLORES.primario;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={estilos.botonTexto}>{titulo}</Text>
    </Pressable>
  );
}

// --- Tarjeta: la caja donde vive cada bloque de información ---
export function Tarjeta({ children, style }) {
  return <View style={[estilos.tarjeta, style]}>{children}</View>;
}

// --- Placa del vehículo: amarilla, como la placa real colombiana.
//     El cliente reconoce SU carro por la placa, no por "vehículo #3". ---
export function Placa({ texto }) {
  return (
    <View style={estilos.placa}>
      <Text style={estilos.placaTexto}>{texto}</Text>
    </View>
  );
}

// --- Banda de estado: color + ícono + nombre + qué hacer.
//     Es EL mensaje central de la app; nunca un color solo. ---
export function BandaEstado({ estado, grande }) {
  const info = ESTADOS[estado] || ESTADOS.al_dia;
  return (
    <View style={[estilos.banda, { borderColor: info.color, backgroundColor: info.color + '22' }]}>
      <Text style={{ fontSize: grande ? 28 : 20 }}>{info.icono}</Text>
      <View style={{ flex: 1, marginLeft: ESPACIO.m }}>
        <Text style={[estilos.bandaNombre, { color: info.color, fontSize: grande ? LETRA.subtitulo : LETRA.normal }]}>
          {info.nombre}
        </Text>
        <Text style={estilos.bandaAccion}>{info.accion}</Text>
      </View>
    </View>
  );
}

// --- Punto de color con texto: para cada mantenimiento en el detalle ---
export function PuntoEstado({ estado }) {
  const info = ESTADOS[estado] || ESTADOS.al_dia;
  return <View style={[estilos.punto, { backgroundColor: info.color }]} />;
}

// --- Pantalla de "cargando", con mensaje amable ---
export function Cargando({ mensaje = 'Un momento…' }) {
  return (
    <View style={estilos.centrado}>
      <ActivityIndicator size="large" color={COLORES.primario} />
      <Text style={estilos.cargandoTexto}>{mensaje}</Text>
    </View>
  );
}

// --- Caja de error: explica qué pasó y qué hacer, sin tecnicismos ---
export function CajaError({ mensaje }) {
  if (!mensaje) return null;
  return (
    <View style={estilos.cajaError}>
      <Text style={estilos.cajaErrorTexto}>{mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: ALTO_TOQUE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIO.l,
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: LETRA.normal,
    fontWeight: '700',
  },
  tarjeta: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  placa: {
    backgroundColor: COLORES.placaFondo,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORES.placaTexto,
    paddingVertical: ESPACIO.xs,
    paddingHorizontal: ESPACIO.m,
    alignSelf: 'flex-start',
  },
  placaTexto: {
    color: COLORES.placaTexto,
    fontSize: LETRA.placa,
    fontWeight: '900',
    letterSpacing: 2,
  },
  banda: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: ESPACIO.m,
  },
  bandaNombre: {
    fontWeight: '800',
  },
  bandaAccion: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    marginTop: 2,
  },
  punto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: ESPACIO.m,
  },
  centrado: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ESPACIO.l,
  },
  cargandoTexto: {
    color: COLORES.textoSuave,
    fontSize: LETRA.normal,
    marginTop: ESPACIO.m,
  },
  cajaError: {
    backgroundColor: COLORES.vencido + '22',
    borderColor: COLORES.vencido,
    borderWidth: 1,
    borderRadius: 12,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  cajaErrorTexto: {
    color: '#fca5a5',
    fontSize: LETRA.pequena,
    lineHeight: 20,
  },
});
