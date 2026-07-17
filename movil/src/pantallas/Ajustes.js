// ============================================================
//  PANTALLA: Ajustes
// ============================================================
// Poquitas cosas, bien claras: quién soy, de qué taller soy cliente,
// y cerrar sesión. (Las notificaciones push llegarán aquí luego.)

import { StyleSheet, Text } from 'react-native';
import { ScrollView } from 'react-native';
import { Boton, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { COLORES, ESPACIO, LETRA } from '../tema';

export default function Ajustes({ route }) {
  const { salir } = useSesion();
  // El nombre y el taller llegan desde la pantalla anterior.
  const { cliente, taller } = route.params || {};

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORES.fondo }}
      contentContainerStyle={estilos.contenido}
    >
      <Tarjeta>
        <Text style={estilos.etiqueta}>Tu nombre</Text>
        <Text style={estilos.valor}>{cliente || '—'}</Text>
        <Text style={[estilos.etiqueta, { marginTop: ESPACIO.m }]}>Tu taller</Text>
        <Text style={estilos.valor}>{taller || '—'}</Text>
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

const estilos = StyleSheet.create({
  contenido: {
    padding: ESPACIO.m,
    paddingBottom: ESPACIO.xl,
  },
  etiqueta: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: ESPACIO.xs,
  },
  valor: {
    color: COLORES.texto,
    fontSize: LETRA.subtitulo,
    fontWeight: '600',
  },
  parrafo: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    lineHeight: 24,
  },
  pie: {
    color: COLORES.textoSuave,
    fontSize: 12,
    textAlign: 'center',
    marginTop: ESPACIO.l,
    lineHeight: 18,
  },
});
