// ============================================================
//  COMPONENTES — las piezas de LEGO que comparten las pantallas
// ============================================================
// Rediseño v2 (tema claro): tarjetas blancas con sombra suave,
// insignias de estado tipo "píldora" y barra de progreso por
// mantenimiento. Si una pieza cambia aquí, cambia en toda la app.

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ALTO_TOQUE, COLORES, ESPACIO, ESTADOS, LETRA, RADIO, SOMBRA,
} from './tema';

// --- Botón principal: grande, redondeado, imposible de no ver ---
export function Boton({ titulo, onPress, deshabilitado, tono = 'primario' }) {
  const fondo = tono === 'peligro' ? COLORES.vencido : COLORES.primario;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        SOMBRA,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={estilos.botonTexto}>{titulo}</Text>
    </Pressable>
  );
}

// --- Tarjeta: caja blanca con sombra suave, esquinas bien redondas ---
export function Tarjeta({ children, style }) {
  return <View style={[estilos.tarjeta, SOMBRA, style]}>{children}</View>;
}

// --- Placa del vehículo: amarilla, como la placa real colombiana ---
export function Placa({ texto }) {
  return (
    <View style={estilos.placa}>
      <Text style={estilos.placaTexto}>{texto}</Text>
    </View>
  );
}

// --- Insignia de estado: píldora de color con ícono + palabra.
//     Compacta, para las tarjetas de la lista. ---
export function Insignia({ estado }) {
  const info = ESTADOS[estado] || ESTADOS.al_dia;
  return (
    <View style={[estilos.insignia, { backgroundColor: info.fondo }]}>
      <Text style={{ fontSize: 14 }}>{info.icono}</Text>
      <Text style={[estilos.insigniaTexto, { color: info.color }]}>{info.nombre}</Text>
    </View>
  );
}

// --- Banda de estado: la versión grande, con la acción a tomar.
//     Es EL mensaje central de la app; nunca un color solo. ---
export function BandaEstado({ estado }) {
  const info = ESTADOS[estado] || ESTADOS.al_dia;
  return (
    <View style={[estilos.banda, { backgroundColor: info.fondo }]}>
      <Text style={{ fontSize: 26 }}>{info.icono}</Text>
      <View style={{ flex: 1, marginLeft: ESPACIO.m }}>
        <Text style={[estilos.bandaNombre, { color: info.color }]}>{info.nombre}</Text>
        <Text style={[estilos.bandaAccion, { color: info.color }]}>{info.accion}</Text>
      </View>
    </View>
  );
}

// --- Barra de progreso: qué tan cerca está de vencerse (0 a 1).
//     Verde al principio, del color del estado al final. ---
export function BarraProgreso({ fraccion, estado }) {
  if (fraccion === null || fraccion === undefined) return null;
  const info = ESTADOS[estado] || ESTADOS.al_dia;
  return (
    <View style={estilos.barraFondo}>
      <View
        style={[
          estilos.barraRelleno,
          { width: `${Math.round(fraccion * 100)}%`, backgroundColor: info.color },
        ]}
      />
    </View>
  );
}

// --- Círculo con el ícono del mantenimiento (🛢️ 🛑 ⛽ …) ---
export function CirculoIcono({ icono, fondo = COLORES.primarioSuave }) {
  return (
    <View style={[estilos.circuloIcono, { backgroundColor: fondo }]}>
      <Text style={{ fontSize: 20 }}>{icono}</Text>
    </View>
  );
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
      <Text style={estilos.cajaErrorTexto}>⚠️ {mensaje}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: ALTO_TOQUE,
    borderRadius: RADIO.boton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIO.l,
  },
  botonTexto: {
    color: COLORES.blanco,
    fontSize: LETRA.normal,
    fontWeight: '700',
  },
  tarjeta: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: RADIO.tarjeta,
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
  insignia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: ESPACIO.m,
    alignSelf: 'flex-start',
  },
  insigniaTexto: {
    fontSize: LETRA.pequena,
    fontWeight: '800',
  },
  banda: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIO.campo,
    padding: ESPACIO.m,
  },
  bandaNombre: {
    fontSize: LETRA.subtitulo,
    fontWeight: '800',
  },
  bandaAccion: {
    fontSize: LETRA.pequena,
    marginTop: 2,
    opacity: 0.85,
  },
  barraFondo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORES.borde,
    overflow: 'hidden',
    marginTop: ESPACIO.s,
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 3,
  },
  circuloIcono: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: COLORES.vencidoFondo,
    borderRadius: RADIO.campo,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  cajaErrorTexto: {
    color: COLORES.vencido,
    fontSize: LETRA.pequena,
    lineHeight: 20,
    fontWeight: '600',
  },
});
