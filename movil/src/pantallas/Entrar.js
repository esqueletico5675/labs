// ============================================================
//  PANTALLA: Entrar
// ============================================================
// Una sola tarea: identificarse. Dos campos, un botón, cero ruido.
// v3: los estilos se crean con la paleta activa (claro u oscuro).

import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTema } from '../apariencia';
import { Boton, CajaError, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO, SOMBRA } from '../tema';

export default function Entrar() {
  const { entrar } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function alPresionarEntrar() {
    setError(null);

    // Validamos ANTES de molestar al servidor, con mensajes concretos.
    if (!email.trim()) return setError('Escribe tu correo.');
    if (!clave) return setError('Escribe tu contraseña.');

    setEnviando(true);
    try {
      await entrar(email, clave); // si funciona, App.js cambia de pantalla solo
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

        <Tarjeta style={{ padding: ESPACIO.l }}>
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

        {/* El camino para el que llega perdido: siempre hay una salida. */}
        <Text style={estilos.ayuda}>
          ¿Primera vez o se te olvidó la contraseña?{'\n'}
          Pídele a tu taller el enlace de acceso:{'\n'}desde ahí creas tu contraseña.
        </Text>
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
  });
}
