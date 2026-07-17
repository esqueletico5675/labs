// ============================================================
//  PANTALLA: Clientes (para el PERSONAL del taller)
// ============================================================
// Buscar, crear y abrir clientes. Al crear, el consentimiento de
// datos es OBLIGATORIO (Habeas Data, Ley 1581): sin la casilla
// marcada, el backend responde 422 y aquí ni lo intentamos.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import { Boton, CajaError, Cargando, Casilla, Campo, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO } from '../tema';

export default function ClientesTaller({ navigation }) {
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [clientes, setClientes] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  // Formulario de "nuevo cliente" (abre y cierra).
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      setClientes(await api.listarClientes(sesion.jwt, sesion.tallerId));
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  async function alRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function guardarCliente() {
    setError(null);
    if (!nombre.trim()) return setError('Escribe el nombre del cliente.');
    if (!consentimiento) {
      return setError(
        'Falta el consentimiento: el cliente debe autorizar el tratamiento de sus datos (Ley 1581).'
      );
    }
    setGuardando(true);
    try {
      await api.crearCliente(sesion.jwt, sesion.tallerId, {
        nombre: nombre.trim(),
        email: correo.trim() || null,
        telefono: telefono.trim() || null,
        consentimiento: true,
      });
      // Limpio el formulario y recargo la lista.
      setNombre(''); setCorreo(''); setTelefono(''); setConsentimiento(false);
      setCreando(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!clientes && !error) return <Cargando mensaje="Buscando los clientes…" />;

  const texto = busqueda.trim().toLowerCase();
  const filtrados = (clientes || []).filter(
    (c) =>
      !texto ||
      c.nombre.toLowerCase().includes(texto) ||
      (c.email || '').toLowerCase().includes(texto) ||
      (c.telefono || '').includes(texto)
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={colores.primario} />
      }
    >
      {/* Buscador simple: por nombre, correo o teléfono. */}
      <TextInput
        style={estilos.buscador}
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="🔍 Buscar cliente…"
        placeholderTextColor={colores.textoSuave}
        autoCorrect={false}
      />

      {!creando && (
        <View style={{ marginBottom: ESPACIO.m }}>
          <Boton titulo="➕ Nuevo cliente" onPress={() => setCreando(true)} />
        </View>
      )}

      {creando && (
        <Tarjeta>
          <Text style={estilos.tituloForm}>Nuevo cliente</Text>
          <Campo etiqueta="Nombre *" valor={nombre} alCambiar={setNombre} placeholder="Carlos Pérez" />
          <Campo
            etiqueta="Correo (será su usuario en la app)"
            valor={correo}
            alCambiar={setCorreo}
            placeholder="carlos@correo.co"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Campo
            etiqueta="Teléfono"
            valor={telefono}
            alCambiar={setTelefono}
            placeholder="3001234567"
            keyboardType="phone-pad"
          />
          <Casilla
            texto="El cliente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012 — Habeas Data). Obligatorio."
            activo={consentimiento}
            alCambiar={setConsentimiento}
          />
          <CajaError mensaje={error} />
          <Boton
            titulo={guardando ? 'Guardando…' : 'Guardar cliente'}
            onPress={guardarCliente}
            deshabilitado={guardando}
          />
          <Pressable onPress={() => setCreando(false)} style={{ marginTop: ESPACIO.m }}>
            <Text style={estilos.cancelar}>Cancelar</Text>
          </Pressable>
        </Tarjeta>
      )}

      {!creando && <CajaError mensaje={error} />}

      {filtrados.length === 0 && clientes && (
        <Tarjeta>
          <Text style={estilos.vacio}>
            {texto ? 'Ningún cliente coincide con la búsqueda.' : '👥\n\nAún no hay clientes.\nCrea el primero con el botón de arriba.'}
          </Text>
        </Tarjeta>
      )}

      {filtrados.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => navigation.navigate('ClienteDetalle', { clienteId: c.id, nombre: c.nombre })}
        >
          {({ pressed }) => (
            <Tarjeta style={{ opacity: pressed ? 0.85 : 1 }}>
              <View style={estilos.filaCliente}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nombre}>{c.nombre}</Text>
                  <Text style={estilos.datos}>
                    {[c.telefono, c.email].filter(Boolean).join('  ·  ') || 'Sin datos de contacto'}
                  </Text>
                </View>
                <Text style={estilos.flecha}>›</Text>
              </View>
            </Tarjeta>
          )}
        </Pressable>
      ))}
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
    buscador: {
      backgroundColor: c.tarjeta,
      borderRadius: RADIO.campo,
      borderWidth: 1,
      borderColor: c.borde,
      color: c.texto,
      fontSize: LETRA.normal,
      padding: ESPACIO.m,
      minHeight: 52,
      marginBottom: ESPACIO.m,
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
    filaCliente: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    nombre: {
      color: c.texto,
      fontSize: LETRA.normal,
      fontWeight: '700',
    },
    datos: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      marginTop: 2,
    },
    flecha: {
      color: c.textoSuave,
      fontSize: 30,
      fontWeight: '300',
    },
    vacio: {
      color: c.texto,
      fontSize: LETRA.normal,
      textAlign: 'center',
      lineHeight: 26,
    },
  });
}
