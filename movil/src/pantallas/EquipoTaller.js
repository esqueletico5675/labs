// ============================================================
//  PANTALLA: Equipo del taller (SOLO ADMIN)
// ============================================================
// Ver quiénes tienen acceso y crear nuevos usuarios. El rol decide:
// el admin ve/toca todo; el mecánico registra ingresos y clientes
// pero no toca reglas, equipo ni enlaces (lo impone el backend).

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import { Boton, CajaError, Cargando, Campo, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO } from '../tema';

export default function EquipoTaller() {
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState(null);

  // Formulario de nuevo usuario.
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState('mecanico');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      setUsuarios(await api.listarUsuarios(sesion.jwt, sesion.tallerId));
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  async function guardar() {
    setError(null);
    if (!nombre.trim()) return setError('Escribe el nombre.');
    if (!correo.trim()) return setError('Escribe el correo.');
    if (clave.length < 6) return setError('La contraseña necesita al menos 6 caracteres.');
    setGuardando(true);
    try {
      await api.crearUsuario(sesion.jwt, sesion.tallerId, {
        nombre: nombre.trim(),
        email: correo.trim().toLowerCase(),
        clave,
        rol,
      });
      setNombre(''); setCorreo(''); setClave(''); setRol('mecanico');
      setCreando(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!usuarios && !error) return <Cargando mensaje="Buscando el equipo…" />;

  const roles = [
    { id: 'mecanico', etiqueta: '🔧 Mecánico' },
    { id: 'admin', etiqueta: '👑 Administrador' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={estilos.explicacion}>
        El mecánico registra ingresos, clientes y vehículos. El administrador
        además maneja reglas, equipo y enlaces de clientes.
      </Text>

      <CajaError mensaje={error} />

      {!creando && (
        <View style={{ marginBottom: ESPACIO.m }}>
          <Boton titulo="➕ Nuevo usuario" onPress={() => setCreando(true)} />
        </View>
      )}

      {creando && (
        <Tarjeta>
          <Text style={estilos.tituloForm}>Nuevo usuario</Text>
          <Campo etiqueta="Nombre *" valor={nombre} alCambiar={setNombre} placeholder="Pedro Gómez" />
          <Campo
            etiqueta="Correo *"
            valor={correo}
            alCambiar={setCorreo}
            placeholder="pedro@tallernorte.co"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Campo
            etiqueta="Contraseña * (mínimo 6 caracteres)"
            valor={clave}
            alCambiar={setClave}
            placeholder="••••••••"
            secureTextEntry
          />

          <Text style={estilos.pregunta}>Su rol:</Text>
          <View style={estilos.filaRoles}>
            {roles.map((r) => {
              const activo = rol === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setRol(r.id)}
                  style={[estilos.chipRol, activo && estilos.chipRolActivo]}
                >
                  <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>
                    {r.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Boton
            titulo={guardando ? 'Guardando…' : 'Crear usuario'}
            onPress={guardar}
            deshabilitado={guardando}
          />
          <Pressable onPress={() => setCreando(false)} style={{ marginTop: ESPACIO.m }}>
            <Text style={estilos.cancelar}>Cancelar</Text>
          </Pressable>
        </Tarjeta>
      )}

      {(usuarios || []).map((u) => (
        <Tarjeta key={u.id}>
          <View style={estilos.filaUsuario}>
            <Text style={{ fontSize: 26 }}>{u.rol === 'admin' ? '👑' : '🔧'}</Text>
            <View style={{ flex: 1, marginLeft: ESPACIO.m }}>
              <Text style={estilos.nombre}>{u.nombre}</Text>
              <Text style={estilos.datos}>
                {u.email}  ·  {u.rol === 'admin' ? 'Administrador' : 'Mecánico'}
              </Text>
            </View>
          </View>
        </Tarjeta>
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
    explicacion: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      lineHeight: 20,
      marginBottom: ESPACIO.m,
      marginLeft: ESPACIO.xs,
    },
    tituloForm: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '800',
      marginBottom: ESPACIO.m,
    },
    pregunta: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      marginBottom: ESPACIO.s,
    },
    filaRoles: {
      flexDirection: 'row',
      gap: ESPACIO.s,
      marginBottom: ESPACIO.m,
    },
    chipRol: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      paddingVertical: ESPACIO.m,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
      backgroundColor: c.fondo,
    },
    chipRolActivo: {
      borderColor: c.primario,
      backgroundColor: c.primarioSuave,
    },
    chipTexto: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      fontWeight: '700',
    },
    chipTextoActivo: {
      color: c.texto,
    },
    cancelar: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      textAlign: 'center',
    },
    filaUsuario: {
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
  });
}
