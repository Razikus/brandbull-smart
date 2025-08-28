import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';


// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)


  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: '443024442162-ond2ppjh8504iqukgp8dsso6kl69sla3.apps.googleusercontent.com',
    });
  }, []);

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })
    if (error) Alert.alert('Błąd logowania', error.message)
    setLoading(false)
  }

  async function signUpWithEmail() {
    setLoading(true)
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    })
    if (error) Alert.alert('Błąd rejestracji', error.message)
    if (!session) Alert.alert('Sprawdź email', 'Sprawdź swoją skrzynkę pocztową w celu weryfikacji!')
    setLoading(false)
  }

  async function signInWithGoogle() {
  setGoogleLoading(true);
  
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    
    if (userInfo.data?.idToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      });
      
      if (error) {
        Alert.alert('Błąd logowania', error.message);
      }
    } else {
      throw new Error('Brak tokenu ID!');
    }
  } catch (error) {
    console.error(error);
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // Użytkownik anulował
    } else if (error.code === statusCodes.IN_PROGRESS) {
      // Logowanie w toku
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      Alert.alert('Błąd', 'Google Play Services niedostępne');
    } else {
      Alert.alert('Błąd', 'Problem z logowaniem Google');
    }
  } finally {
    setGoogleLoading(false);
  }
}

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header with BrandBull Smart branding */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoBrandBull}>BRANDBULL</Text>
            <Text style={styles.logoSmart}>SMART</Text>
          </View>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Utwórz nowe konto' : 'Zaloguj się do aplikacji'}
          </Text>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="email@address.com"
              placeholderTextColor="#666666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Hasło</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Twoje hasło"
              placeholderTextColor="#666666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (loading || googleLoading || !email || !password) && styles.disabledButton
            ]}
            onPress={isSignUp ? signUpWithEmail : signInWithEmail}
            disabled={loading || googleLoading || !email || !password}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? "Rejestrowanie..." : "Logowanie..."}
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? "Zarejestruj się" : "Zaloguj się"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>lub</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              (googleLoading || loading) && styles.disabledButton
            ]}
            onPress={signInWithGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#333333" size="small" />
                <Text style={styles.googleButtonText}>Łączę z Google...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>
                  {isSignUp ? 'Zarejestruj się przez Google' : 'Zaloguj się przez Google'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Action Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, (loading || googleLoading) && styles.disabledButton]}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading || googleLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {isSignUp ? "Masz już konto? Zaloguj się" : "Nie masz konta? Zarejestruj się"}
            </Text>
          </TouchableOpacity>

        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerSubtext}>
            Brandbull Smart - nowoczesne rozwiązania IoT
          </Text>
        </View>
      </ScrollView>
      
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoBrandBull: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  logoSmart: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff4444',
    letterSpacing: 2,
    marginTop: -4,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    marginTop: 12,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
  },

  // Google Button styles
  googleButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285f4',
    marginRight: 12,
  },
  googleButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '600',
  },

  // Divider styles
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    color: '#666666',
    fontSize: 14,
    paddingHorizontal: 16,
  },

  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 50,
  },
  secondaryButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  footerText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
  },
  footerSubtext: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});