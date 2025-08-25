import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { AlarmSmoke, AlertTriangle, ChevronRight, LogOut, MapPin, Plus, Save, Search, Settings, Smartphone, TestTube } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './AuthContext';

import { createApiClient } from '@/lib/client';
import { PermissionsAndroid, Platform } from 'react-native';
const API_BASE_URL = 'http://192.168.100.28:8000';

const { HeimanBluetooth } = NativeModules;
const heimanEmitter = new NativeEventEmitter(HeimanBluetooth);

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// Screen: WiFi Configuration
function WiFiConfigScreen({ route, navigation }: any) {
  const { device } = route.params;
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);

  const handleConfigure = async () => {
    if (!ssid.trim()) {
      Alert.alert('Błąd', 'Podaj nazwę sieci WiFi');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Błąd', 'Podaj hasło sieci WiFi');
      return;
    }

    navigation.navigate('DeviceConfiguration', {
      device,
      wifiConfig: { ssid: ssid.trim(), password: password.trim() }
    });
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Konfiguracja WiFi</Text>
        <Text style={styles.settingsSubtitle}>{device.name}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nazwa sieci (SSID)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Wprowadź nazwę sieci WiFi"
            placeholderTextColor="#666666"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Hasło sieci</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Wprowadź hasło WiFi"
            placeholderTextColor="#666666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleConfigure}
          disabled={isConfiguring}
        >
          <Settings size={20} color="#ffffff" />
          <Text style={styles.saveButtonText}>Konfiguruj urządzenie</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}


// Screen: Device Configuration Process
function DeviceConfigurationScreen({ route, navigation }: any) {
  const { device, wifiConfig } = route.params;
  const [configStep, setConfigStep] = useState(0);
  const [configSteps, setConfigSteps] = useState<string[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [error, setError] = useState('');

  const { session } = useAuth();

  useEffect(() => {
    const stepListener = heimanEmitter.addListener('onConfigStep', (data: { step: number, stepName: string }) => {
      console.log(`Configuration step: ${data.stepName} (${data.step})`);
      setConfigStep(data.step);
      updateStepDisplay(data.step);
    });

    const errorListener = heimanEmitter.addListener('onConfigError', (data: { code: number, message: string }) => {
      console.log('Configuration error:', data);
      setError(data.message);
      setIsConfiguring(false);
    });

    return () => {
      stepListener.remove();
      errorListener.remove();
    };
  }, []);

  const updateStepDisplay = (step: number) => {
    const steps: string[] = [];
    
    if (step >= 1) steps.push('Łączenie z urządzeniem...');
    if (step >= 2) steps.push('Wysyłanie danych WiFi...');
    if (step >= 3) steps.push('Urządzenie łączy się z siecią...');
    if (step >= 4) {
      steps.push('Urządzenie podłączone do sieci');
      steps.push('Rejestrowanie w systemie...');
    }
    
    setConfigSteps(steps);

    // Handle final success step
    if (step === 4) { // STEP_DEVICE_CONNECT_NET_SUCCEED
      handleDeviceRegistration();
    }
  };

  const handleDeviceRegistration = async () => {
    try {
      // TODO: Replace with actual API call
      console.log('Registering device in external system...');
      
      // Placeholder for external API registration
      // const registrationData = {
      //   deviceMac: device.mac,
      //   productId: device.productId,
      //   deviceName: device.name,
      //   userId: 'current-user-id', // Get from auth context
      //   registrationTime: new Date().toISOString()
      // };



      const apiClient = createApiClient(API_BASE_URL, session);
      const registrationData = {
        deviceName: device.mac,
        productID: device.productId,
      };
      console.log(registrationData)
      const response = await apiClient.registerDevice(registrationData);
      console.log('Device registered successfully:', response);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Device registered successfully:', registrationData);
      
      setConfigSteps(prev => [...prev, 'Urządzenie zarejestrowane pomyślnie!']);
      
      setTimeout(() => {
        Alert.alert(
          'Sukces!',
          `Urządzenie ${device.name} zostało skonfigurowane i zarejestrowane.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('DevicesList')
            }
          ]
        );
      }, 1500);

    } catch (error) {
      console.error('Device registration failed:', error);
      setError('Nie udało się zarejestrować urządzenia w systemie');
      setIsConfiguring(false);
    }
  };

  const startConfiguration = async () => {
    try {
      console.log('Ensuring discovery is stopped before config...');
      await HeimanBluetooth.stopDiscovery();
      const config = {
        productId: device.productId,
        deviceMac: device.mac,
        ssid: wifiConfig.ssid,
        password: wifiConfig.password,
        hostUrl: "https://spapi.heiman.cn", // Stałe wartości
        mqttUrl: "spmqtt.heiman.cn:1884"
      };
      console.log('Device configuration:', config);

      await HeimanBluetooth.configureDevice(config);
    } catch (error) {
      console.error('Configuration failed:', error);
      setError(`Konfiguracja nie powiodła się: ${error}`);
      setIsConfiguring(false);
    }
  };

  useEffect(() => {
    startConfiguration();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Konfiguracja urządzenia</Text>
        <Text style={styles.settingsSubtitle}>{device.name}</Text>
      </View>

      {error ? (
        <View style={styles.section}>
          <View style={styles.eFlaraStatus}>
            <AlertTriangle size={20} color="#ff4444" />
            <Text style={styles.eFlaraStatusText}>{error}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.rescanButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.rescanButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.eventsContainer}>
            {configSteps.map((step, index) => (
              <View key={index} style={styles.eventCard}>
                <View style={styles.eventIcon}>
                  {index === configSteps.length - 1 && isConfiguring ? (
                    <ActivityIndicator size="small" color="#ff4444" />
                  ) : (
                    <TestTube size={20} color="#22c55e" />
                  )}
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventMessage}>{step}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const requestBluetoothPermissions = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    
    const allGranted = permissions.every(
      permission => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      Alert.alert(
        'Brak uprawnień',
        'Aplikacja potrzebuje uprawnień Bluetooth do skanowania urządzeń. Przejdź do ustawień i przyznaj uprawnienia ręcznie.'
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
};

function AddDeviceScreen({ navigation }: any) {
  const [foundDevicesMap, setFoundDevicesMap] = useState<Map<string, any>>(new Map());

  const foundDevices = Array.from(foundDevicesMap.values());

  useEffect(() => {
    const deviceListener = heimanEmitter.addListener('onDeviceDiscovered', (device: any) => {
      console.log('Device discovered:', device);
      
      setFoundDevicesMap(prev => {
        if (prev.has(device.mac)) {
          console.log('Device already exists, skipping:', device.mac);
          return prev;
        }
        
        const newDevice = {
          id: device.mac,
          name: `Czujnik ${device.productId.slice(-4)}`,
          signal: 'Unknown',
          battery: 'Unknown', 
          type: 'smoke',
          productId: device.productId,
          mac: device.mac
        };

        const newMap = new Map(prev);
        newMap.set(device.mac, newDevice);
        return newMap;
      });
    });

    return () => {
      deviceListener.remove();
    };
  }, []);

  const startScanning = async () => {
    try {
      const hasPermissions = await requestBluetoothPermissions();
      if (!hasPermissions) return;
      
      setFoundDevicesMap(new Map());
      console.log('Starting device discovery...');
      
      await HeimanBluetooth.startDiscovery();
    } catch (error) {
      console.error('Failed to start scanning:', error);
      Alert.alert('Błąd', `Nie udało się uruchomić skanowania: ${error}`);
    }
  };

  const stopScanning = async () => {
    try {
      await HeimanBluetooth.stopDiscovery();
      console.log("STOP")
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('Failed to stop scanning:', error);
    }
  };

  // Start scanning when component mounts
  useEffect(() => {
    startScanning();
    
    // Stop scanning when component unmounts
    return () => {
      stopScanning();
    };
  }, []);

  const handleDeviceSelect = async (device: any) => {
    // Stop scanning when device is selected
    await stopScanning();
    navigation.navigate('WiFiConfig', { device });
  };

  return (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#000000" />
    
    {/* Fixed Header */}
    <View style={styles.resultsHeader}>
      <Text style={styles.resultsTitle}>Skanowanie urządzeń</Text>
      <Text style={styles.resultsSubtitle}>
        {foundDevices.length > 0 
          ? `Znaleziono ${foundDevices.length} urządzeń. Kliknij aby wybrać.`
          : 'Szukam urządzeń Brandbull Smart w pobliżu...'
        }
      </Text>
    </View>

    {/* Content Area */}
    {foundDevices.length === 0 ? (
      /* Empty State - Scanning */
      <View style={styles.scanningContainer}>
        <View style={styles.scanningContent}>
          <Search size={64} color="#ff4444" />
          <ActivityIndicator size="large" color="#ff4444" style={styles.scanningSpinner} />
          <Text style={styles.scanningSubtitle}>
            Urządzenia pojawią się tutaj automatycznie
          </Text>
        </View>
      </View>
    ) : (
      /* Results List */
      <ScrollView style={styles.devicesScrollContainer}>
        <View style={styles.devicesContainer}>
          {foundDevices.map((device) => (
            <TouchableOpacity
              key={device.mac} // Use MAC as key to ensure uniqueness
              style={styles.foundDeviceCard}
              onPress={() => handleDeviceSelect(device)}
            >
              <View style={styles.deviceSelectionContent}>
                <View style={styles.deviceIconContainer}>
                  <AlarmSmoke size={24} color="#ff4444" />
                </View>
                
                <View style={styles.deviceDetailsContent}>
                  <Text style={styles.foundDeviceName}>{device.name}</Text>
                  <View style={styles.deviceInfoRow}>
                    <Text style={styles.deviceInfoText}>MAC: {device.mac}</Text>
                  </View>
                  <View style={styles.deviceInfoRow}>
                    <Text style={styles.deviceInfoText}>ID: {device.productId}</Text>
                  </View>
                </View>

                <ChevronRight size={20} color="#666666" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    )}
  </View>
  );
}

// Screen: Device Details
function DeviceDetailsScreen({ route, navigation }: any) {
  const { device } = route.params;
  
  const mockEvents = [
    { id: 1, type: 'smoke', message: 'Wykryto dym', time: '14:30', date: '22.06.2025' },
    { id: 2, type: 'test', message: 'Testowy alarm', time: '10:15', date: '21.06.2025' },
    { id: 3, type: 'test', message: 'Test miesięczny', time: '09:00', date: '01.06.2025' },
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'smoke':
        return <AlertTriangle size={20} color="#ff4444" />;
      case 'test':
        return <TestTube size={20} color="#22c55e" />;
      default:
        return <AlarmSmoke size={20} color="#cccccc" />;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Device Header */}
      <View style={styles.deviceDetailsHeader}>
        <AlarmSmoke size={48} color="#ff4444" />
        <Text style={styles.deviceDetailsName}>{device.name}</Text>
        <Text style={styles.deviceDetailsActivity}>Ostatnia aktywność: {device.lastActivity}</Text>
      </View>

      {/* Recent Events Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ostatnie zdarzenia</Text>
        <View style={styles.eventsContainer}>
          {mockEvents.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventIcon}>
                {getEventIcon(event.type)}
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventMessage}>{event.message}</Text>
                <Text style={styles.eventTime}>{event.date} o {event.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('DeviceSettings', { device })}
        >
          <Settings size={24} color="#ffffff" />
          <Text style={styles.settingsButtonText}>Ustawienia</Text>
          <ChevronRight size={20} color="#cccccc" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Screen: Device Settings
function DeviceSettingsScreen({ route }: any) {
  const { device } = route.params;
  const [eFlaraEnabled, setEFlaraEnabled] = useState(false);
  const [homeAddress, setHomeAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const handleSave = () => {
    Alert.alert('Sukces', 'Ustawienia zostały zapisane');
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Ustawienia urządzenia</Text>
        <Text style={styles.settingsSubtitle}>{device.name}</Text>
      </View>

      {/* eFlara Communication Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Komunikacja z eFlara</Text>
        
        <View style={styles.switchContainer}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Włącz eFlara</Text>
            <Text style={styles.switchDescription}>Automatyczne powiadomienia służb ratunkowych</Text>
          </View>
          <Switch
            value={eFlaraEnabled}
            onValueChange={setEFlaraEnabled}
            trackColor={{ false: '#333333', true: '#ff4444' }}
            thumbColor={eFlaraEnabled ? '#ffffff' : '#cccccc'}
          />
        </View>

        {eFlaraEnabled && (
          <>
            {/* Home Address */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Adres Domowy</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ul. Przykładowa 123, 43-100 Tychy"
                placeholderTextColor="#666666"
                value={homeAddress}
                onChangeText={setHomeAddress}
                multiline
              />
            </View>

            {/* GPS Coordinates */}
            <View style={styles.coordinatesContainer}>
              <Text style={styles.inputLabel}>
                <MapPin size={16} color="#cccccc" /> Współrzędne GPS
              </Text>
              <View style={styles.coordinatesRow}>
                <View style={styles.coordinateInput}>
                  <Text style={styles.coordinateLabel}>Szerokość</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="50.1234"
                    placeholderTextColor="#666666"
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.coordinateInput}>
                  <Text style={styles.coordinateLabel}>Długość</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="19.1234"
                    placeholderTextColor="#666666"
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* eFlara Status */}
            <View style={styles.eFlaraStatus}>
              <AlertTriangle size={20} color="#22c55e" />
              <Text style={styles.eFlaraStatusText}>
                Komunikacja z eFlara została włączona. W razie wykrycia dymu - odpowiedni pierwsi ratownicy zostaną poinformowani.
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Save size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Zapisz ustawienia</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// Screen: Twoje urządzenia
function DevicesScreen({ navigation }: any) {
  const [loadedDevices, setLoadedDevices] = useState<any[]>([]);
  const handleAddDevice = () => {
    navigation.navigate('AddDevice');
  };

  const handleDevicePress = (device: any) => {
    navigation.navigate('DeviceDetails', { device });
  };

  // Mock data - czujniki dymu
  const mockDevices = [
    { id: 1, name: 'Czujnik dymu - Kuchnia', status: 'online', lastActivity: '2 min temu' },
    { id: 2, name: 'Czujnik dymu - Salon', status: 'online', lastActivity: '5 min temu' },
    { id: 3, name: 'Czujnik dymu - Sypialnia', status: 'offline', lastActivity: '2 godz. temu' },
    { id: 4, name: 'Czujnik temperatury - Garaż', status: 'online', lastActivity: '1 min temu' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Twoje urządzenia</Text>
        <Text style={styles.headerSubtitle}>Zarządzaj swoimi czujnikami Brandbull Smart</Text>
      </View>

      {/* Add Device Button */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <Plus size={20} color="#ffffff" style={styles.buttonIcon} />
          <Text style={styles.addButtonText}>Dodaj urządzenie</Text>
        </TouchableOpacity>
      </View>

      {/* Devices List */}
      <View style={styles.devicesContainer}>
        {mockDevices.map((device) => (
          <TouchableOpacity 
            key={device.id} 
            style={styles.deviceCard}
            onPress={() => handleDevicePress(device)}
          >
            <View style={styles.deviceInfo}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>{device.name}</Text>
              </View>
              <Text style={styles.deviceActivity}>Ostatnia aktywność: {device.lastActivity}</Text>
            </View>
            <View style={styles.deviceIcon}>
              <AlarmSmoke size={24} color="#ff4444" />
            </View>
            <ChevronRight size={20} color="#666666" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Empty State (if no devices) */}
      {mockDevices.length === 0 && (
        <View style={styles.emptyState}>
          <Smartphone size={64} color="#666666" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Brak urządzeń</Text>
          <Text style={styles.emptySubtitle}>Dodaj swoje pierwsze urządzenie Brandbull Smart</Text>
        </View>
      )}
    </View>
  );
}

// Stack Navigator for Devices
function DevicesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="DevicesList" 
        component={DevicesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="AddDevice" 
        component={AddDeviceScreen}
        options={{
          title: 'Dodaj urządzenie',
          headerShown: true,
          headerBackTitle: 'Wróć',
        }}
      />
      <Stack.Screen 
        name="WiFiConfig" 
        component={WiFiConfigScreen}
        options={{ title: 'Konfiguracja WiFi', headerBackTitle: 'Wróć' }}
      />
      <Stack.Screen 
        name="DeviceConfiguration" 
        component={DeviceConfigurationScreen}
        options={{ title: 'Konfiguracja', headerBackTitle: 'Wróć' }}
      />
      <Stack.Screen 
        name="DeviceDetails" 
        component={DeviceDetailsScreen}
        options={({ route }: any) => ({
          title: route.params?.device?.name || 'Szczegóły urządzenia',
          headerBackTitle: 'Wróć',
        })}
      />
      <Stack.Screen 
        name="DeviceSettings" 
        component={DeviceSettingsScreen}
        options={{
          title: 'Ustawienia urządzenia',
          headerBackTitle: 'Wróć',
        }}
      />
    </Stack.Navigator>
  );
}

// Custom Drawer Content
function CustomDrawerContent(props: any) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert(
      'Wyloguj się',
      'Czy na pewno chcesz się wylogować?',
      [
        { text: 'Anuluj', style: 'cancel' },
        { 
          text: 'Wyloguj', 
          style: 'destructive',
          onPress: () => signOut()
        }
      ]
    );
  };

  return (
    <View style={styles.drawerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Drawer Header */}
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerLogoBrandBull}>BRANDBULL</Text>
        <Text style={styles.drawerLogoSmart}>SMART</Text>
        <Text style={styles.drawerSubtitle}>Panel użytkownika</Text>
      </View>

      {/* Menu Items */}
      <View style={styles.drawerMenu}>
        <TouchableOpacity 
          style={styles.drawerItem}
          onPress={() => props.navigation.navigate('Devices')}
        >
          <Smartphone size={20} color="#ffffff" style={styles.drawerItemIcon} />
          <Text style={styles.drawerItemText}>Twoje urządzenia</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.drawerItem, styles.drawerItemDanger]}
          onPress={handleSignOut}
        >
          <LogOut size={20} color="#ff4444" style={styles.drawerItemIcon} />
          <Text style={[styles.drawerItemText, styles.drawerItemDangerText]}>Wyloguj</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.drawerFooter}>
        <Text style={styles.drawerFooterText}>Brandbull Smart v1.0</Text>
        <Text style={styles.drawerFooterSubtext}>Nowoczesne rozwiązania IoT</Text>
      </View>
    </View>
  );
}

// Main App Component
export default function MainApp() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerStyle: {
          backgroundColor: '#000000',
          width: 280,
        },
      }}
    >
      <Drawer.Screen 
        name="Devices" 
        component={DevicesStackNavigator}
        options={{
          title: 'Brandbull Smart',
          headerTitle: 'Brandbull Smart',
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  // Header styles
  header: {
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#cccccc',
  },

  // Add button styles
  addButtonContainer: {
    padding: 20,
  },
  addButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Devices list styles
  devicesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  deviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  deviceActivity: {
    fontSize: 14,
    color: '#cccccc',
  },
  deviceIcon: {
    marginLeft: 16,
    marginRight: 8,
  },

  // Device Details styles
  deviceDetailsHeader: {
    alignItems: 'center',
    padding: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  deviceDetailsName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
  },
  deviceDetailsActivity: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 8,
  },

  // Section styles
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },

  // Events styles
  eventsContainer: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  eventIcon: {
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: '#cccccc',
  },

  // Settings styles
  settingsButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 12,
    flex: 1,
  },

  // Settings Screen styles
  settingsHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingsSubtitle: {
    fontSize: 14,
    color: '#cccccc',
  },

  // Switch styles
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#cccccc',
  },

  // Input styles
  inputContainer: {
    marginBottom: 20,
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
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 48,
  },

  // Coordinates styles
  coordinatesContainer: {
    marginBottom: 20,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
  },
  coordinateLabel: {
    color: '#cccccc',
    fontSize: 14,
    marginBottom: 8,
  },

  // eFlara status styles
  eFlaraStatus: {
    backgroundColor: '#1a1a1a',
    // borderColor: '#ff4444',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 20,
  },
  eFlaraStatusText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },

  // Save button styles
  saveButton: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Scanning styles
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanningContent: {
    alignItems: 'center',
  },
  scanningTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 12,
  },
  scanningSubtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  scanningSpinner: {
    marginTop: 20,
  },

  // Results styles
  resultsHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
  },

  // Found devices styles
  foundDeviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333333',
  },
  selectedDeviceCard: {
    borderColor: '#ff4444',
    backgroundColor: '#1f1616',
  },
  deviceSelectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIconContainer: {
    marginRight: 16,
  },
  deviceDetailsContent: {
    flex: 1,
  },
  foundDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceInfoText: {
    fontSize: 14,
    color: '#cccccc',
    marginLeft: 6,
  },
  selectionIndicator: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Add selected button styles
  addSelectedButton: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addSelectedButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Rescan button styles
  rescanButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ff4444',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Drawer styles
  drawerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  drawerHeader: {
    padding: 30,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    alignItems: 'center',
  },
  drawerLogoBrandBull: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  drawerLogoSmart: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff4444',
    letterSpacing: 1,
    marginTop: -4,
  },
  drawerSubtitle: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 8,
  },
  drawerMenu: {
    flex: 1,
    paddingTop: 20,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  drawerItemDanger: {
    marginTop: 'auto',
    marginBottom: 20,
    borderBottomWidth: 0,
  },
  drawerItemIcon: {
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  drawerItemText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  drawerItemDangerText: {
    color: '#ff4444',
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    alignItems: 'center',
  },
  drawerFooterText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  drawerFooterSubtext: {
    fontSize: 11,
    color: '#555555',
    marginTop: 2,
  },
  devicesScrollContainer: {
    flex: 1,
  },
});