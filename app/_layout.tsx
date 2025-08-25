import { useFonts } from 'expo-font';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

import Auth from '@/components/Auth';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import MainApp from '@/components/MainApp';
import { ActivityIndicator, View } from 'react-native';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#0a0a0a' 
      }}>
        <ActivityIndicator size="large" color="#ff4444" />
      </View>
    );
  }

  // Show auth screen if not logged in
  if (!session) {
    return <Auth />;
  }

  // Show main app if logged in
  return <MainApp />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });


  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
