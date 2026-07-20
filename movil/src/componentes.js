// ============================================================
//  COMPONENTES — las piezas de LEGO que comparten las pantallas
// ============================================================
// v3: cada pieza lee la paleta activa con useTema(). La GEOMETRÍA
// (tamaños, radios, márgenes) es fija; los COLORES vienen del tema.

import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTema } from './apariencia';
import { ALTO_TOQUE, ESPACIO, LETRA, RADIO, SOMBRA, infoEstado } from './tema';

// --- Botón principal: grande, redondeado, imposible de no ver ---
export function Boton({ titulo, onPress, deshabilitado, tono = 'primario' }) {
  const { colores } = useTema();
  const fondo = tono === 'peligro' ? colores.vencido : colores.primario;
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
      <Text style={[estilos.botonTexto, { color: colores.blanco }]}>{titulo}</Text>
    </Pressable>
  );
}

// --- Tarjeta: caja con sombra suave, esquinas bien redondas ---
export function Tarjeta({ children, style }) {
  const { colores } = useTema();
  return (
    <View style={[estilos.tarjeta, SOMBRA, { backgroundColor: colores.tarjeta }, style]}>
      {children}
    </View>
  );
}

// --- Placa del vehículo: amarilla, como la placa real colombiana ---
export function Placa({ texto }) {
  const { colores } = useTema();
  return (
    <View
      style={[
        estilos.placa,
        { backgroundColor: colores.placaFondo, borderColor: colores.placaTexto },
      ]}
    >
      <Text style={[estilos.placaTexto, { color: colores.placaTexto }]}>{texto}</Text>
    </View>
  );
}

// --- Insignia de estado: píldora de color con ícono + palabra ---
export function Insignia({ estado }) {
  const { colores } = useTema();
  const info = infoEstado(estado, colores);
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
  const { colores } = useTema();
  const info = infoEstado(estado, colores);
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

// --- Barra de progreso: qué tan cerca está de vencerse (0 a 1) ---
export function BarraProgreso({ fraccion, estado }) {
  const { colores } = useTema();
  if (fraccion === null || fraccion === undefined) return null;
  const info = infoEstado(estado, colores);
  return (
    <View style={[estilos.barraFondo, { backgroundColor: colores.borde }]}>
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
export function CirculoIcono({ icono, fondo }) {
  const { colores } = useTema();
  return (
    <View
      style={[estilos.circuloIcono, { backgroundColor: fondo || colores.primarioSuave }]}
    >
      <Text style={{ fontSize: 20 }}>{icono}</Text>
    </View>
  );
}

// --- Pantalla de "cargando", con mensaje amable ---
export function Cargando({ mensaje = 'Un momento…' }) {
  const { colores } = useTema();
  return (
    <View style={[estilos.centrado, { backgroundColor: colores.fondo }]}>
      <ActivityIndicator size="large" color={colores.primario} />
      <Text style={[estilos.cargandoTexto, { color: colores.textoSuave }]}>{mensaje}</Text>
    </View>
  );
}

// --- Campo de formulario: etiqueta + cajita de texto, igual en toda la app ---
export function Campo({ etiqueta, valor, alCambiar, ...resto }) {
  const { colores } = useTema();
  return (
    <View style={{ marginBottom: ESPACIO.m }}>
      <Text style={[estilos.campoEtiqueta, { color: colores.texto }]}>{etiqueta}</Text>
      <TextInput
        style={[
          estilos.campoCaja,
          {
            backgroundColor: colores.fondo,
            borderColor: colores.borde,
            color: colores.texto,
          },
        ]}
        value={valor}
        onChangeText={alCambiar}
        placeholderTextColor={colores.textoSuave}
        {...resto}
      />
    </View>
  );
}

// --- Casilla: fila tocable con ✓ (consentimientos, opciones sí/no) ---
export function Casilla({ texto, activo, alCambiar }) {
  const { colores } = useTema();
  return (
    <Pressable onPress={() => alCambiar(!activo)} style={estilos.casillaFila}>
      <View
        style={[
          estilos.casillaCuadro,
          {
            borderColor: activo ? colores.primario : colores.borde,
            backgroundColor: activo ? colores.primario : colores.fondo,
          },
        ]}
      >
        {activo && <Text style={{ color: colores.blanco, fontWeight: '900' }}>✓</Text>}
      </View>
      <Text style={[estilos.casillaTexto, { color: colores.texto }]}>{texto}</Text>
    </Pressable>
  );
}

// --- Tarjeta "¿Sabías que…?": un dato curioso de mantenimiento.
//     Educa sin alarmar y SIEMPRE cierra invitando a consultar al taller
//     (los kilómetros exactos varían por vehículo). ---
export function TarjetaConsejo({ texto }) {
  const { colores } = useTema();
  if (!texto) return null;
  return (
    <View
      style={[
        estilos.consejo,
        SOMBRA,
        { backgroundColor: colores.tarjeta, borderLeftColor: colores.primario },
      ]}
    >
      <Text style={[estilos.consejoTitulo, { color: colores.primario }]}>
        💡 ¿Sabías que…?
      </Text>
      <Text style={[estilos.consejoTexto, { color: colores.texto }]}>{texto}</Text>
      <Text style={[estilos.consejoPie, { color: colores.textoSuave }]}>
        Consulta con tu taller para tu caso.
      </Text>
    </View>
  );
}

// --- Caja de error: explica qué pasó y qué hacer, sin tecnicismos ---
export function CajaError({ mensaje }) {
  const { colores } = useTema();
  if (!mensaje) return null;
  return (
    <View style={[estilos.cajaError, { backgroundColor: colores.vencidoFondo }]}>
      <Text style={[estilos.cajaErrorTexto, { color: colores.vencido }]}>⚠️ {mensaje}</Text>
    </View>
  );
}

// Solo geometría: nada de colores aquí (los pone la paleta activa).
const estilos = StyleSheet.create({
  boton: {
    minHeight: ALTO_TOQUE,
    borderRadius: RADIO.boton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIO.l,
  },
  botonTexto: {
    fontSize: LETRA.normal,
    fontWeight: '700',
  },
  tarjeta: {
    borderRadius: RADIO.tarjeta,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  placa: {
    borderRadius: 8,
    borderWidth: 2,
    paddingVertical: ESPACIO.xs,
    paddingHorizontal: ESPACIO.m,
    alignSelf: 'flex-start',
  },
  placaTexto: {
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: ESPACIO.l,
  },
  cargandoTexto: {
    fontSize: LETRA.normal,
    marginTop: ESPACIO.m,
  },
  campoEtiqueta: {
    fontSize: LETRA.pequena,
    fontWeight: '700',
    marginBottom: ESPACIO.xs,
  },
  campoCaja: {
    borderWidth: 1,
    borderRadius: RADIO.campo,
    fontSize: LETRA.normal,
    padding: ESPACIO.m,
    minHeight: 52,
  },
  casillaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.m,
    marginBottom: ESPACIO.m,
    minHeight: ALTO_TOQUE,
  },
  casillaCuadro: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaTexto: {
    flex: 1,
    fontSize: LETRA.pequena,
    lineHeight: 20,
  },
  cajaError: {
    borderRadius: RADIO.campo,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  cajaErrorTexto: {
    fontSize: LETRA.pequena,
    lineHeight: 20,
    fontWeight: '600',
  },
  consejo: {
    borderRadius: RADIO.tarjeta,
    borderLeftWidth: 4,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  consejoTitulo: {
    fontSize: LETRA.pequena,
    fontWeight: '800',
    marginBottom: ESPACIO.xs,
  },
  consejoTexto: {
    fontSize: LETRA.normal,
    lineHeight: 24,
  },
  consejoPie: {
    fontSize: LETRA.pequena,
    fontStyle: 'italic',
    marginTop: ESPACIO.s,
  },
});
