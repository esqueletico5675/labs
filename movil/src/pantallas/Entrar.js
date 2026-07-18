// ============================================================
//  PANTALLA: Entrar
// ============================================================
// Una sola tarea: identificarse. Primero eliges QUIÉN eres
// (dueño de carro o personal del taller), luego correo y contraseña.

import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useTema } from '../apariencia';
import { Boton, CajaError, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO, SOMBRA } from '../tema';

export default function Entrar() {
  const { entrarCliente, entrarTaller, registrarTaller } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [tipo, setTipo] = useState('cliente'); // 'cliente' | 'taller'
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Abrir cuenta de taller nuevo (registro self-service, como en el panel).
  const [registrando, setRegistrando] = useState(false);
  const [tallerNombre, setTallerNombre] = useState('');
  const [tallerEmail, setTallerEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');

  const tipos = [
    { id: 'cliente', etiqueta: '🚗 Dueño de carro' },
    { id: 'taller', etiqueta: '🔧 Personal del taller' },
  ];

  async function alPresionarEntrar() {
    setError(null);

    // Validamos ANTES de molestar al servidor, con mensajes concretos.
    if (!email.trim()) return setError('Escribe tu correo.');
    if (!clave) return setError('Escribe tu contraseña.');

    setEnviando(true);
    try {
      // Según quién eres, el login es distinto (portal vs JWT del taller).
      if (tipo === 'taller') {
        await entrarTaller(email, clave);
      } else {
        await entrarCliente(email, clave);
      }
      // Si funciona, App.js cambia de pantalla solo.
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function alPresionarRegistrar() {
    setError(null);
    if (tallerNombre.trim().length < 2) return setError('Escribe el nombre del taller.');
    if (!tallerEmail.trim()) return setError('Escribe el correo del taller.');
    if (adminNombre.trim().length < 2) return setError('Escribe tu nombre.');
    if (!email.trim()) return setError('Escribe tu correo.');
    if (clave.length < 6) return setError('La contraseña necesita al menos 6 caracteres.');

    setEnviando(true);
    try {
      await registrarTaller({
        taller_nombre: tallerNombre.trim(),
        taller_email: tallerEmail.trim().toLowerCase(),
        admin_nombre: adminNombre.trim(),
        admin_email: email.trim().toLowerCase(),
        admin_clave: clave,
      });
      // Si funciona, quedas logueado como administrador de una vez.
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {/* Quién soy y para qué sirve esta app, en una frase. */}
        <View style={[estilos.circuloLogo, SOMBRA]}>
          <Text style={{ fontSize: 44 }}>🔧</Text>
        </View>
        <Text style={estilos.titulo}>Taller Diésel</Text>
        <Text style={estilos.subtitulo}>
          Te avisamos cuándo le toca{'\n'}mantenimiento a tu carro
        </Text>

        {registrando ? (
          <Tarjeta style={{ padding: ESPACIO.l }}>
            <Text style={estilos.tituloForm}>Abrir cuenta del taller</Text>

            <Text style={estilos.etiqueta}>Nombre del taller</Text>
            <TextInput
              style={estilos.campo}
              value={tallerNombre}
              onChangeText={setTallerNombre}
              placeholder="Taller Diésel El Norte"
              placeholderTextColor={colores.textoSuave}
            />

            <Text style={estilos.etiqueta}>Correo del taller</Text>
            <TextInput
              style={estilos.campo}
              value={tallerEmail}
              onChangeText={setTallerEmail}
              placeholder="taller@correo.com"
              placeholderTextColor={colores.textoSuave}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={estilos.etiqueta}>Tu nombre</Text>
            <TextInput
              style={estilos.campo}
              value={adminNombre}
              onChangeText={setAdminNombre}
              placeholder="Pedro Gómez"
              placeholderTextColor={colores.textoSuave}
            />

            <Text style={estilos.etiqueta}>Tu correo (será tu usuario)</Text>
            <TextInput
              style={estilos.campo}
              value={email}
              onChangeText={setEmail}
              placeholder="ejemplo@correo.com"
              placeholderTextColor={colores.textoSuave}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={estilos.etiqueta}>Tu contraseña (mínimo 6 caracteres)</Text>
            <TextInput
              style={estilos.campo}
              value={clave}
              onChangeText={setClave}
              placeholder="••••••••"
              placeholderTextColor={colores.textoSuave}
              secureTextEntry
            />

            <CajaError mensaje={error} />

            <Boton
              titulo={enviando ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
              onPress={alPresionarRegistrar}
              deshabilitado={enviando}
            />
          </Tarjeta>
        ) : (
        <Tarjeta style={{ padding: ESPACIO.l }}>
          {/* ¿Quién eres? Dos botones grandes, el activo resaltado. */}
          <View style={estilos.filaTipos}>
            {tipos.map((t) => {
              const activo = tipo === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setTipo(t.id);
                    setError(null);
                  }}
                  style={[estilos.chipTipo, activo && estilos.chipTipoActivo]}
                >
                  <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>
                    {t.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={estilos.etiqueta}>Tu correo</Text>
          <TextInput
            style={estilos.campo}
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={colores.textoSuave}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={estilos.etiqueta}>Tu contraseña</Text>
          <TextInput
            style={estilos.campo}
            value={clave}
            onChangeText={setClave}
            placeholder="••••••••"
            placeholderTextColor={colores.textoSuave}
            secureTextEntry
          />

          <CajaError mensaje={error} />

          <Boton
            titulo={enviando ? 'Entrando…' : 'Entrar'}
            onPress={alPresionarEntrar}
            deshabilitado={enviando}
          />
        </Tarjeta>
        )}

        {/* El camino para el que llega perdido: siempre hay una salida. */}
        {!registrando && (
          <Text style={estilos.ayuda}>
            {tipo === 'cliente'
              ? '¿Primera vez o se te olvidó la contraseña?\nPídele a tu taller el enlace de acceso:\ndesde ahí creas tu contraseña.'
              : 'Usa el mismo correo y contraseña\ncon los que entras al panel del taller.'}
          </Text>
        )}

        {/* Taller nuevo: abrir cuenta (mismo registro del panel web). */}
        {(tipo === 'taller' || registrando) && (
          <Pressable
            onPress={() => {
              setRegistrando(!registrando);
              setError(null);
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={estilos.enlace}>
              {registrando ? '← Ya tengo cuenta, volver a entrar' : '¿Taller nuevo? Abre tu cuenta aquí'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Los estilos dependen de la paleta activa: se crean con ella.
function crearEstilos(c) {
  return StyleSheet.create({
    contenido: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: ESPACIO.l,
    },
    circuloLogo: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: c.primarioSuave,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    titulo: {
      color: c.texto,
      fontSize: LETRA.titulo,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: ESPACIO.m,
    },
    subtitulo: {
      color: c.textoSuave,
      fontSize: LETRA.normal,
      textAlign: 'center',
      marginTop: ESPACIO.s,
      marginBottom: ESPACIO.xl,
      lineHeight: 24,
    },
    filaTipos: {
      flexDirection: 'row',
      gap: ESPACIO.s,
      marginBottom: ESPACIO.l,
    },
    chipTipo: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      paddingVertical: ESPACIO.m,
      paddingHorizontal: ESPACIO.xs,
      alignItems: 'center',
      minHeight: 54,
      justifyContent: 'center',
      backgroundColor: c.fondo,
    },
    chipTipoActivo: {
      borderColor: c.primario,
      backgroundColor: c.primarioSuave,
    },
    chipTexto: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      textAlign: 'center',
    },
    chipTextoActivo: {
      color: c.texto,
    },
    etiqueta: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      marginBottom: ESPACIO.xs,
    },
    campo: {
      backgroundColor: c.fondo,
      borderWidth: 1,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      color: c.texto,
      fontSize: LETRA.normal,
      padding: ESPACIO.m,
      marginBottom: ESPACIO.m,
      minHeight: 52,
    },
    ayuda: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      textAlign: 'center',
      marginTop: ESPACIO.l,
      lineHeight: 22,
    },
    tituloForm: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '800',
      marginBottom: ESPACIO.m,
    },
    enlace: {
      color: c.primario,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: ESPACIO.m,
    },
  });
}
