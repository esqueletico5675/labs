// Pantalla inicial de la app móvil del taller.
// Por ahora solo confirma que Expo corre en el celular y muestra
// el lenguaje visual que usaremos: fondo oscuro y 3 estados con color.

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Paleta compartida con el portal web (validada para daltonismo).
const COLORES = {
  fondo: '#10161f',
  tarjeta: '#1a2230',
  texto: '#f1f5f9',
  textoSuave: '#94a3b8',
  alDia: '#059669',
  proximo: '#d97706',
  vencido: '#ef4444',
};

// Una fila de la leyenda de estados: un punto de color + su significado.
function Estado({ color, nombre, detalle }) {
  return (
    <View style={estilos.filaEstado}>
      <View style={[estilos.punto, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={estilos.nombreEstado}>{nombre}</Text>
        <Text style={estilos.detalleEstado}>{detalle}</Text>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <View style={estilos.pantalla}>
      <Text style={estilos.titulo}>Taller Diésel</Text>
      <Text style={estilos.subtitulo}>Recordatorios de mantenimiento</Text>

      <View style={estilos.tarjeta}>
        <Text style={estilos.exito}>✅ La app ya corre en tu celular</Text>
        <Text style={estilos.nota}>
          Así se verá el estado de cada mantenimiento:
        </Text>

        <Estado color={COLORES.alDia} nombre="Al día" detalle="No hay que hacer nada" />
        <Estado color={COLORES.proximo} nombre="Próximo" detalle="Agenda tu cita pronto" />
        <Estado color={COLORES.vencido} nombre="Vencido" detalle="Llama al taller ya" />
      </View>

      <StatusBar style="light" />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  titulo: {
    color: COLORES.texto,
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitulo: {
    color: COLORES.textoSuave,
    fontSize: 16,
    marginTop: 4,
    marginBottom: 28,
  },
  tarjeta: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
  },
  exito: {
    color: COLORES.texto,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  nota: {
    color: COLORES.textoSuave,
    fontSize: 14,
    marginBottom: 16,
  },
  filaEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  punto: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 12,
  },
  nombreEstado: {
    color: COLORES.texto,
    fontSize: 16,
    fontWeight: '600',
  },
  detalleEstado: {
    color: COLORES.textoSuave,
    fontSize: 13,
  },
});
