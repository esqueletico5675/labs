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
import CitasTaller from './src/pantallas/CitasTaller';
import ClienteDetalle from './src/pantallas/ClienteDetalle';
import ClientesTaller from './src/pantallas/ClientesTaller';
import Entrar from './src/pantallas/Entrar';
import EquipoTaller from './src/pantallas/EquipoTaller';
import MisVehiculos from './src/pantallas/MisVehiculos';
import ReglasTaller from './src/pantallas/ReglasTaller';
import TableroTaller from './src/pantallas/TableroTaller';
import Vehiculo from './src/pantallas/Vehiculo';
import VehiculosTaller from './src/pantallas/VehiculosTaller';
import VehiculoTaller from './src/pantallas/VehiculoTaller';
import { ProveedorSesion, useSesion } from './src/sesion';

const Pila = createNativeStackNavigator();

function Pantallas() {
  const { sesion, listo } = useSesion();
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
  if (!sesion) {
    return (
      <>
        <Entrar />
        <StatusBar style={estiloBarra} />
      </>
    );
  }

  // Con sesión: cada tipo de usuario tiene SUS pantallas.
  const esTaller = sesion.tipo === 'taller';

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
        {esTaller ? (
          /* PERSONAL DEL TALLER: todo lo del panel web, en el celular. */
          <>
            <Pila.Screen
              name="TableroTaller"
              component={TableroTaller}
              options={{ title: 'Tablero' }}
            />
            <Pila.Screen
              name="CitasTaller"
              component={CitasTaller}
              options={{ title: 'Citas', headerBackTitle: 'Atrás' }}
            />
            <Pila.Screen
              name="ClientesTaller"
              component={ClientesTaller}
              options={{ title: 'Clientes', headerBackTitle: 'Atrás' }}
            />
            <Pila.Screen
              name="ClienteDetalle"
              component={ClienteDetalle}
              options={({ route }) => ({
                title: route.params.nombre,
                headerBackTitle: 'Atrás',
              })}
            />
            <Pila.Screen
              name="VehiculosTaller"
              component={VehiculosTaller}
              options={{ title: 'Vehículos', headerBackTitle: 'Atrás' }}
            />
            <Pila.Screen
              name="VehiculoTaller"
              component={VehiculoTaller}
              options={({ route }) => ({
                title: route.params.vehiculo.placa,
                headerBackTitle: 'Atrás',
              })}
            />
            <Pila.Screen
              name="ReglasTaller"
              component={ReglasTaller}
              options={{ title: 'Reglas de mantenimiento', headerBackTitle: 'Atrás' }}
            />
            <Pila.Screen
              name="EquipoTaller"
              component={EquipoTaller}
              options={{ title: 'Equipo', headerBackTitle: 'Atrás' }}
            />
            <Pila.Screen name="Ajustes" component={Ajustes} options={{ title: 'Ajustes' }} />
          </>
        ) : (
          /* DUEÑO DEL CARRO: sus vehículos y su detalle. */
          <>
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
          </>
        )}
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
