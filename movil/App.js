// ============================================================
//  App.js — el punto de entrada de la app
// ============================================================
// Envuelve todo en dos proveedores: apariencia (claro/oscuro) y
// sesión. Luego decide: sin sesión -> "Entrar"; con sesión -> el
// navegador con las pantallas del cliente.

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ProveedorApariencia, useTema } from './src/apariencia';
import { Cargando } from './src/componentes';
import Ajustes from './src/pantallas/Ajustes';
import Entrar from './src/pantallas/Entrar';
import MisVehiculos from './src/pantallas/MisVehiculos';
import Vehiculo from './src/pantallas/Vehiculo';
import { ProveedorSesion, useSesion } from './src/sesion';

const Pila = createNativeStackNavigator();

function Pantallas() {
  const { token, listo } = useSesion();
  const { esquema, colores } = useTema();

  // La barra de estado (hora, batería) se invierte según el modo.
  const estiloBarra = esquema === 'oscuro' ? 'light' : 'dark';

  // Tema del navegador: que las barras y fondos usen NUESTROS colores.
  const temaNavegacion = {
    dark: esquema === 'oscuro',
    colors: {
      primary: colores.primario,
      background: colores.fondo,
      card: colores.tarjeta,
      text: colores.texto,
      border: colores.borde,
      notification: colores.vencido,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  };

  // Todavía estamos mirando si había sesión guardada en el celular.
  if (!listo) return <Cargando mensaje="Abriendo la app…" />;

  // Sin sesión: lo ÚNICO que existe es la pantalla de entrar.
  if (!token) {
    return (
      <>
        <Entrar />
        <StatusBar style={estiloBarra} />
      </>
    );
  }

  // Con sesión: las pantallas del cliente, apiladas como cartas.
  return (
    <NavigationContainer theme={temaNavegacion}>
      <Pila.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colores.fondo },
          headerTintColor: colores.texto,
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
      <StatusBar style={estiloBarra} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ProveedorApariencia>
      <ProveedorSesion>
        <Pantallas />
      </ProveedorSesion>
    </ProveedorApariencia>
  );
}
