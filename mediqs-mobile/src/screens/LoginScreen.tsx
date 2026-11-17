// ======================================================
// Pantalla de login (src/screens/LoginScreen.tsx)
// El paciente ingresa con el EMAIL que tiene cargado en el
// hospital y su número de DNI. En el primer ingreso el
// backend le crea la cuenta automáticamente. La sesión queda
// persistida en el dispositivo y se registra el push.
// ======================================================
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, getErrorMessage, type SessionUser } from '../api';
import { base, colors } from '../theme';

export default function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !dni.trim()) {
      setError('Completá tu email y tu DNI.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      onLogin(await auth.login(email.trim(), dni.trim()));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[base.screen, { justifyContent: 'center', padding: 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[base.title, { fontSize: 32 }]}>MediQs</Text>
      <Text style={[base.subtitle, { marginBottom: 24 }]}>
        Ingresá con el email que diste en el hospital y tu DNI
      </Text>

      <View style={{ gap: 12 }}>
        <TextInput
          style={base.input}
          placeholder="Email"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={base.input}
          placeholder="DNI (sin puntos)"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
          value={dni}
          onChangeText={setDni}
          onSubmitEditing={() => void submit()}
        />

        {error && <Text style={base.error}>{error}</Text>}

        <TouchableOpacity style={base.button} onPress={() => void submit()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={base.buttonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>

      <Text style={[base.meta, { textAlign: 'center', marginTop: 24 }]}>
        ¿No podés ingresar? Verificá en recepción que tu email esté bien cargado.
      </Text>
    </KeyboardAvoidingView>
  );
}
