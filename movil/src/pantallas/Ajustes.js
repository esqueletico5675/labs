// ============================================================
//  PANTALLA: Ajustes
// ============================================================
// Poquitas cosas, bien claras: quién soy, el modo claro/oscuro,
// y cerrar sesión. (Las notificaciones push llegarán aquí luego.)

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTema } from '../apariencia';
import { Boton, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO } from '../tema';

export default function Ajustes({ route }) {
  const { salir } = useSesion();
  const { esquema, colores, cambiarEsquema } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  // El nombre y el taller llegan desde la pantalla anterior.
  const { cliente, taller } = route.params || {};

  const opciones = [
    { id: 'claro', etiqueta: '☀️ Claro' },
    { id: 'oscuro', etiqueta: '🌙 Oscuro' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
    >
      <Tarjeta>
        <Text style={estilos.etiqueta}>Tu nombre</Text>
        <Text style={estilos.valor}>{cliente || '—'}</Text>
        <Text style={[estilos.etiqueta, { marginTop: ESPACIO.m }]}>Tu taller</Text>
        <Text style={estilos.valor}>{taller || '—'}</Text>
      </Tarjeta>

      {/* El interruptor de apariencia: dos botones grandes, el activo resaltado. */}
      <Tarjeta>
        <Text style={estilos.etiqueta}>Apariencia</Text>
        <View style={estilos.filaOpciones}>
          {opciones.map((op) => {
            const activo = esquema === op.id;
            return (
              <Pressable
                key={op.id}
                onPress={() => cambiarEsquema(op.id)}
                style={[estilos.opcion, activo && estilos.opcionActiva]}
              >
                <Text style={[estilos.opcionTexto, activo && estilos.opcionTextoActivo]}>
                  {op.etiqueta}
                </Text>
                {activo && <Text style={estilos.opcionMarca}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Tarjeta>

      <Tarjeta>
        <Text style={estilos.etiqueta}>Avisos en tu celular</Text>
        <Text style={estilos.parrafo}>
          🔔 Muy pronto la app te avisará aquí mismo cuando a tu carro le
          toque mantenimiento. Por ahora te seguimos avisando por correo.
        </Text>
      </Tarjeta>

      <Boton titulo="Cerrar sesión" tono="peligro" onPress={salir} />

      <Text style={estilos.pie}>
        Tus datos están protegidos según la Ley 1581 de 2012 (Habeas Data).{'\n'}
        Puedes pedir su corrección o eliminación en tu taller.
      </Text>
    </ScrollView>
  );
}

// Los estilos dependen de la paleta activa: se crean con ella.
function crearEstilos(c) {
  return StyleSheet.create({
    contenido: {
      padding: ESPACIO.m,
      paddingBottom: ESPACIO.xl,
    },
    etiqueta: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: ESPACIO.s,
    },
    valor: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '700',
    },
    filaOpciones: {
      flexDirection: 'row',
      gap: ESPACIO.s,
    },
    opcion: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ESPACIO.s,
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      paddingVertical: ESPACIO.m,
      minHeight: 54,
      backgroundColor: c.fondo,
    },
    opcionActiva: {
      borderColor: c.primario,
      backgroundColor: c.primarioSuave,
    },
    opcionTexto: {
      color: c.textoSuave,
      fontSize: LETRA.normal,
      fontWeight: '700',
    },
    opcionTextoActivo: {
      color: c.texto,
    },
    opcionMarca: {
      color: c.primario,
      fontSize: LETRA.normal,
      fontWeight: '900',
    },
    parrafo: {
      color: c.texto,
      fontSize: LETRA.normal,
      lineHeight: 24,
    },
    pie: {
      color: c.textoSuave,
      fontSize: 12,
      textAlign: 'center',
      marginTop: ESPACIO.l,
      lineHeight: 18,
    },
  });
}
