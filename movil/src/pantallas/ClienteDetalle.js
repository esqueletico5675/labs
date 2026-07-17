// ============================================================
//  PANTALLA: Detalle de un cliente (para el PERSONAL del taller)
// ============================================================
// Todo lo del cliente en un solo lugar: sus datos (editables), el
// enlace secreto de su portal (compartir / regenerar), sus vehículos
// (abrir o crear) y, para el admin, la supresión Habeas Data.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import * as api from '../api';
import { URL_BASE } from '../api';
import { useTema } from '../apariencia';
import { Boton, CajaError, Cargando, Campo, Placa, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, formatearKm } from '../tema';

export default function ClienteDetalle({ route, navigation }) {
  const { clienteId } = route.params;
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);
  const esAdmin = sesion.rol === 'admin';

  const [cliente, setCliente] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario de datos del cliente (se rellena al cargar).
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [editando, setEditando] = useState(false);

  // Formulario de "nuevo vehículo".
  const [creandoVehiculo, setCreandoVehiculo] = useState(false);
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [km, setKm] = useState('');

  async function cargar() {
    setError(null);
    try {
      const c = await api.obtenerCliente(sesion.jwt, sesion.tallerId, clienteId);
      setCliente(c);
      setNombre(c.nombre);
      setCorreo(c.email || '');
      setTelefono(c.telefono || '');
      // Sus vehículos: pedimos todos los del taller y filtramos los suyos.
      const todos = await api.listarVehiculos(sesion.jwt, sesion.tallerId);
      setVehiculos(todos.filter((v) => v.cliente_id === clienteId));
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [clienteId])
  );

  async function guardarDatos() {
    setError(null);
    if (!nombre.trim()) return setError('El nombre no puede quedar vacío.');
    setGuardando(true);
    try {
      await api.actualizarCliente(sesion.jwt, sesion.tallerId, clienteId, {
        nombre: nombre.trim(),
        email: correo.trim() || null,
        telefono: telefono.trim() || null,
      });
      setEditando(false);
      setMensaje('Datos guardados ✅');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Comparte el enlace del portal por WhatsApp/SMS/lo que el celular tenga.
  async function compartirEnlace(regenerado) {
    setError(null);
    try {
      const r = regenerado
        ? await api.regenerarToken(sesion.jwt, sesion.tallerId, clienteId)
        : await api.enlacePortal(sesion.jwt, sesion.tallerId, clienteId);
      await Share.share({
        message:
          `Hola ${r.cliente}, este es tu acceso al portal del taller ` +
          `(no lo compartas con nadie): ${URL_BASE}${r.ruta}`,
      });
    } catch (e) {
      setError(e.message);
    }
  }

  function confirmarRegenerar() {
    Alert.alert(
      '¿Regenerar el enlace?',
      'El enlace anterior dejará de funcionar al instante. Úsalo si se filtró o el cliente perdió el celular.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, regenerar', style: 'destructive', onPress: () => compartirEnlace(true) },
      ]
    );
  }

  function confirmarSupresion() {
    Alert.alert(
      '¿Suprimir los datos personales?',
      'Esto es IRREVERSIBLE (Habeas Data, Ley 1581): se borran nombre, correo, teléfono y su acceso al portal. El historial técnico de los vehículos se conserva anónimo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, suprimir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.suprimirDatos(sesion.jwt, sesion.tallerId, clienteId);
              navigation.goBack();
            } catch (e) {
              setError(e.message);
            }
          },
        },
      ]
    );
  }

  async function guardarVehiculo() {
    setError(null);
    if (!placa.trim()) return setError('Escribe la placa del vehículo.');
    setGuardando(true);
    try {
      await api.crearVehiculo(sesion.jwt, sesion.tallerId, {
        cliente_id: clienteId,
        placa: placa.trim().toUpperCase(),
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        anio: anio ? parseInt(anio, 10) : null,
        km_actual: km ? parseInt(km.replace(/\D/g, ''), 10) : 0,
      });
      setPlaca(''); setMarca(''); setModelo(''); setAnio(''); setKm('');
      setCreandoVehiculo(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!cliente && !error) return <Cargando mensaje="Abriendo el cliente…" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <CajaError mensaje={error} />
      {mensaje && <Text style={estilos.exito}>{mensaje}</Text>}

      {/* --- Datos del cliente --- */}
      {cliente && (
        <>
          <Text style={estilos.seccion}>Datos del cliente</Text>
          <Tarjeta>
            {!editando ? (
              <>
                <Text style={estilos.nombre}>{cliente.nombre}</Text>
                <Text style={estilos.dato}>
                  {[cliente.telefono, cliente.email].filter(Boolean).join('  ·  ') ||
                    'Sin datos de contacto'}
                </Text>
                <View style={{ marginTop: ESPACIO.m }}>
                  <Boton titulo="✏️ Editar datos" onPress={() => setEditando(true)} />
                </View>
              </>
            ) : (
              <>
                <Campo etiqueta="Nombre *" valor={nombre} alCambiar={setNombre} />
                <Campo
                  etiqueta="Correo"
                  valor={correo}
                  alCambiar={setCorreo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Campo
                  etiqueta="Teléfono"
                  valor={telefono}
                  alCambiar={setTelefono}
                  keyboardType="phone-pad"
                />
                <Boton
                  titulo={guardando ? 'Guardando…' : 'Guardar cambios'}
                  onPress={guardarDatos}
                  deshabilitado={guardando}
                />
                <Pressable onPress={() => setEditando(false)} style={{ marginTop: ESPACIO.m }}>
                  <Text style={estilos.cancelar}>Cancelar</Text>
                </Pressable>
              </>
            )}
          </Tarjeta>

          {/* --- Enlace del portal --- */}
          <Text style={estilos.seccion}>Acceso del cliente a su app</Text>
          <Tarjeta>
            <Text style={estilos.dato}>
              El enlace secreto le permite al cliente entrar a su portal y crear
              su contraseña. Compártelo SOLO con él.
            </Text>
            <View style={{ marginTop: ESPACIO.m, gap: ESPACIO.s }}>
              <Boton titulo="📤 Compartir enlace del portal" onPress={() => compartirEnlace(false)} />
              {esAdmin && (
                <Pressable onPress={confirmarRegenerar} style={estilos.botonSuave}>
                  <Text style={estilos.botonSuaveTexto}>🔄 Regenerar enlace (anula el anterior)</Text>
                </Pressable>
              )}
            </View>
          </Tarjeta>

          {/* --- Vehículos --- */}
          <Text style={estilos.seccion}>Vehículos ({vehiculos.length})</Text>
          {vehiculos.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => navigation.navigate('VehiculoTaller', { vehiculo: v })}
            >
              {({ pressed }) => (
                <Tarjeta style={{ opacity: pressed ? 0.85 : 1 }}>
                  <View style={estilos.filaVehiculo}>
                    <Placa texto={v.placa} />
                    <View style={{ flex: 1, marginLeft: ESPACIO.m }}>
                      <Text style={estilos.dato}>
                        {[v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || 'Sin descripción'}
                      </Text>
                      <Text style={estilos.datoSuave}>{formatearKm(v.km_actual)} km registrados</Text>
                    </View>
                    <Text style={estilos.flecha}>›</Text>
                  </View>
                </Tarjeta>
              )}
            </Pressable>
          ))}

          {!creandoVehiculo ? (
            <Boton titulo="➕ Nuevo vehículo" onPress={() => setCreandoVehiculo(true)} />
          ) : (
            <Tarjeta>
              <Text style={estilos.tituloForm}>Nuevo vehículo</Text>
              <Campo etiqueta="Placa *" valor={placa} alCambiar={setPlaca} placeholder="NKR123" autoCapitalize="characters" />
              <Campo etiqueta="Marca" valor={marca} alCambiar={setMarca} placeholder="Chevrolet" />
              <Campo etiqueta="Modelo" valor={modelo} alCambiar={setModelo} placeholder="NKR" />
              <Campo etiqueta="Año" valor={anio} alCambiar={setAnio} placeholder="2020" keyboardType="numeric" />
              <Campo etiqueta="Kilometraje actual" valor={km} alCambiar={setKm} placeholder="85000" keyboardType="numeric" />
              <Boton
                titulo={guardando ? 'Guardando…' : 'Guardar vehículo'}
                onPress={guardarVehiculo}
                deshabilitado={guardando}
              />
              <Pressable onPress={() => setCreandoVehiculo(false)} style={{ marginTop: ESPACIO.m }}>
                <Text style={estilos.cancelar}>Cancelar</Text>
              </Pressable>
            </Tarjeta>
          )}

          {/* --- Zona delicada (solo admin) --- */}
          {esAdmin && (
            <>
              <Text style={estilos.seccion}>Zona delicada</Text>
              <Pressable onPress={confirmarSupresion} style={estilos.botonPeligro}>
                <Text style={estilos.botonPeligroTexto}>
                  🗑️ Suprimir datos personales (Habeas Data)
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
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
    seccion: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: ESPACIO.l,
      marginBottom: ESPACIO.s,
      marginLeft: ESPACIO.xs,
    },
    nombre: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '800',
    },
    dato: {
      color: c.texto,
      fontSize: LETRA.pequena,
      lineHeight: 20,
      marginTop: 4,
    },
    datoSuave: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      marginTop: 2,
    },
    exito: {
      color: c.alDia,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      marginBottom: ESPACIO.s,
      marginLeft: ESPACIO.xs,
    },
    tituloForm: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '800',
      marginBottom: ESPACIO.m,
    },
    cancelar: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      textAlign: 'center',
    },
    filaVehiculo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    flecha: {
      color: c.textoSuave,
      fontSize: 30,
      fontWeight: '300',
    },
    botonSuave: {
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: 14,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ESPACIO.m,
    },
    botonSuaveTexto: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontWeight: '700',
    },
    botonPeligro: {
      backgroundColor: c.vencidoFondo,
      borderRadius: 14,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ESPACIO.m,
    },
    botonPeligroTexto: {
      color: c.vencido,
      fontSize: LETRA.pequena,
      fontWeight: '800',
    },
  });
}
