// ============================================================
//  PANTALLA: Entrar
// ============================================================
// Una sola tarea: identificarse. Dos campos, un botón, cero ruido.
// Si algo falla, el error se explica en cristiano dentro de la pantalla.

import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Boton, CajaError } from '../componentes';
import { useSesion } from '../sesion';
import { COLORES, ESPACIO, LETRA } from '../tema';

export default function Entrar() {
  const { entrar } = useSesion();
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
      style={{ flex: 1, backgroundColor: COLORES.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {/* Quién soy y para qué sirve esta app, en una frase. */}
        <Text style={estilos.logo}>🔧</Text>
        <Text style={estilos.titulo}>Taller Diésel</Text>
        <Text style={estilos.subtitulo}>
          Te avisamos cuándo le toca mantenimiento a tu carro
        </Text>

        <View style={estilos.formulario}>
          <Text style={estilos.etiqueta}>Tu correo</Text>
          <TextInput
            style={estilos.campo}
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={COLORES.textoSuave}
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
            placeholderTextColor={COLORES.textoSuave}
            secureTextEntry
          />

          <CajaError mensaje={error} />

          <Boton
            titulo={enviando ? 'Entrando…' : 'Entrar'}
            onPress={alPresionarEntrar}
            deshabilitado={enviando}
          />
        </View>

        {/* El camino para el que llega perdido: siempre hay una salida. */}
        <Text style={estilos.ayuda}>
          ¿Primera vez o se te olvidó la contraseña?{'\n'}
          Pídele a tu taller el enlace de acceso: desde ahí creas tu contraseña.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: ESPACIO.l,
  },
  logo: {
    fontSize: 56,
    textAlign: 'center',
  },
  titulo: {
    color: COLORES.texto,
    fontSize: LETRA.titulo,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: ESPACIO.s,
  },
  subtitulo: {
    color: COLORES.textoSuave,
    fontSize: LETRA.normal,
    textAlign: 'center',
    marginTop: ESPACIO.s,
    marginBottom: ESPACIO.xl,
    lineHeight: 24,
  },
  formulario: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: ESPACIO.l,
  },
  etiqueta: {
    color: COLORES.texto,
    fontSize: LETRA.pequena,
    fontWeight: '600',
    marginBottom: ESPACIO.xs,
  },
  campo: {
    backgroundColor: COLORES.fondo,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    color: COLORES.texto,
    fontSize: LETRA.normal,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
    minHeight: 52,
  },
  ayuda: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    textAlign: 'center',
    marginTop: ESPACIO.l,
    lineHeight: 22,
  },
});
