// ============================================================
//  App.js — el punto de entrada de la app
// ============================================================
// Decide UNA cosa: si no hay sesión, muestra "Entrar"; si la hay,
// muestra el navegador con las pantallas del cliente.

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Cargando } from './src/componentes';
import Ajustes from './src/pantallas/Ajustes';
import Entrar from './src/pantallas/Entrar';
import MisVehiculos from './src/pantallas/MisVehiculos';
import Vehiculo from './src/pantallas/Vehiculo';
import { ProveedorSesion, useSesion } from './src/sesion';
import { COLORES } from './src/tema';

const Pila = createNativeStackNavigator();

// Tema del navegador: que las barras y fondos usen NUESTROS colores.
const temaNavegacion = {
  dark: false,
  colors: {
    primary: COLORES.primario,
    background: COLORES.fondo,
    card: COLORES.tarjeta,
    text: COLORES.texto,
    border: COLORES.borde,
    notification: COLORES.vencido,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

function Pantallas() {
  const { token, listo } = useSesion();

  // Todavía estamos mirando si había sesión guardada en el celular.
  if (!listo) return <Cargando mensaje="Abriendo la app…" />;

  // Sin sesión: lo ÚNICO que existe es la pantalla de entrar.
  if (!token) {
    return (
      <>
        <Entrar />
        <StatusBar style="dark" />
      </>
    );
  }

  // Con sesión: las pantallas del cliente, apiladas como cartas.
  return (
    <NavigationContainer theme={temaNavegacion}>
      <Pila.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORES.fondo },
          headerTintColor: COLORES.texto,
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
        }}
      >
        <Pila.Screen
          name="MisVehiculos"
          component={MisVehiculos}
          options={{ title: 'Mis vehículos' }}
        />
        <Pila.Screen
          name="Vehiculo"
          component={Vehiculo}
          options={({ route }) => ({
            title: route.params.vehiculo.placa,
            headerBackTitle: 'Atrás',
          })}
        />
        <Pila.Screen name="Ajustes" component={Ajustes} options={{ title: 'Ajustes' }} />
      </Pila.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ProveedorSesion>
      <Pantallas />
    </ProveedorSesion>
  );
}
