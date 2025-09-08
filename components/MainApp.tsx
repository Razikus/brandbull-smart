import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { AlarmSmoke, AlertTriangle, ChevronRight, LogOut, Plus, Save, Search, Settings, Smartphone, TestTube, Trash2, User } from 'lucide-react-native';
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
import DeviceDetailsScreen from './DeviceDetails';

import { createApiClient, eFlara } from '@/lib/client';
import { PermissionsAndroid, Platform } from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';


const API_BASE_URL = 'https://bbsmart.smarthelmet.pl';


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

    navigation.replace('DeviceConfiguration', {
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


function DeviceConfigurationScreen({ route, navigation }: any) {
  const { device, wifiConfig } = route.params;
  const [configStep, setConfigStep] = useState(0);
  const [configSteps, setConfigSteps] = useState<string[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [error, setError] = useState('');

  const { session } = useAuth();

  useEffect(() => {
    return () => {
      console.log('DeviceConfigurationScreen unmounting, stopping configuration');
      HeimanBluetooth.stopConfiguration();
    };
  }, []);


  useEffect(() => {
    updateStepDisplay(0);
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
      console.log("Removing listeners");
      stepListener.remove();
      errorListener.remove();
    };
  }, []);

  const updateStepDisplay = (step: number) => {
    const steps: string[] = [];
    if(step >= 0) steps.push('Wyszukiwanie urządzenia...');
    if (step >= 1) steps.push('Łączenie z urządzeniem...');
    if (step >= 2) steps.push('Wysyłanie danych WiFi...');
    if (step >= 3) steps.push('Urządzenie łączy się z siecią...');
    if (step >= 4) {
      steps.push('Urządzenie podłączone do sieci');
      steps.push('Rejestrowanie w systemie...');
    }
    
    setConfigSteps(steps);

    // Handle final success step
    if (step >= 4) { // STEP_DEVICE_CONNECT_NET_SUCCEED
      handleDeviceRegistration();
    }
  };

  const handleDeviceRegistration = async () => {
    try {
      console.log('Registering device in external system...');



      const apiClient = createApiClient(API_BASE_URL, session);
      const registrationData = {
        deviceName: device.mac,
        productID: device.productId,
      };
      const response = await apiClient.registerDevice(registrationData);
      
      setConfigSteps(prev => [...prev, 'Urządzenie zarejestrowane pomyślnie!']);
      
      setTimeout(() => {
        Alert.alert(
          'Sukces!',
          `Urządzenie ${device.name} zostało skonfigurowane i zarejestrowane.`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DevicesList' }],
                });
              }
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
      // sleep for one seond
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Device configuration:', config);

      HeimanBluetooth.configureDevice(config);
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
      console.log('Discovered device:', device);
      
      setFoundDevicesMap(prev => {
        if (prev.has(device.mac)) {
          console.log('Device already exists, skipping:', device.mac);
          return prev;
        }
        
        const newDevice = {
          id: device.mac,
          name: `Czujnik ${device.mac.slice(-4)}`,
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
      console.log("Removing device listener");
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
      let res = await HeimanBluetooth.stopDiscovery();
      console.log("STOP", res)
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
    await stopScanning();
    navigation.replace('WiFiConfig', { device });
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


interface DeviceParam {
  uuid?: string;
  id?: string;
  name: string;
}


function DeviceSettingsScreen({ route, navigation }: any) {
  const { device } = route.params;
  const { session } = useAuth();
  const [eFlaraEnabled, setEFlaraEnabled] = useState(false);
  const [homeAddress, setHomeAddress] = useState('');
  const [deviceName, setDeviceName] = useState(device.name || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [renamingSaving, setRenamingSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const loadDeviceInfo = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!session) {
        throw new Error('Brak sesji użytkownika');
      }

      const apiClient = createApiClient(API_BASE_URL, session);
      const deviceInfo = await apiClient.getDeviceInfo(device.uuid || device.id);
      
      // Load existing device name
      if (deviceInfo.name) {
        setDeviceName(deviceInfo.name);
      }
      
      // Load existing eFlara configuration
      if (deviceInfo.eFlara) {
        setEFlaraEnabled(deviceInfo.eFlara.enabled);
        setHomeAddress(deviceInfo.eFlara.address || '');
      }
      
    } catch (err) {
      console.error('Failed to load device info:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać informacji o urządzeniu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeviceInfo();
  }, [device.uuid, device.id, session]);

  const handleRename = async () => {
    const trimmedName = deviceName.trim();
    
    if (!trimmedName) {
      Alert.alert('Błąd', 'Nazwa urządzenia nie może być pusta');
      return;
    }
    
    if (trimmedName.length < 1 || trimmedName.length > 30) {
      Alert.alert('Błąd', 'Nazwa urządzenia musi mieć od 1 do 30 znaków');
      return;
    }

    try {
      setRenamingSaving(true);
      
      if (!session) {
        throw new Error('Brak sesji użytkownika');
      }

      const apiClient = createApiClient(API_BASE_URL, session);
      await apiClient.renameDevice(device.uuid || device.id, {
        name: trimmedName
      });
      
      Alert.alert('Sukces', 'Nazwa urządzenia została zmieniona');
      
      // Update the device object in navigation params to reflect the new name
      navigation.setParams({
        device: {
          ...device,
          name: trimmedName
        }
      });
      
    } catch (err) {
      console.error('Failed to rename device:', err);
      
      let errorMessage = 'Nie udało się zmienić nazwy urządzenia';
      if (err instanceof Error) {
        if (err.message.includes('NAME_LENGTH_INVALID')) {
          errorMessage = 'Nazwa urządzenia musi mieć od 1 do 30 znaków';
        } else if (err.message.includes('DEVICE_NOT_FOUND')) {
          errorMessage = 'Urządzenie nie zostało znalezione';
        } else {
          errorMessage = err.message;
        }
      }
      
      Alert.alert('Błąd', errorMessage);
    } finally {
      setRenamingSaving(false);
    }
  };

  const handleSave = async () => {
    if (eFlaraEnabled && !homeAddress.trim()) {
      Alert.alert('Błąd', 'Podaj adres domowy aby włączyć eFlara');
      return;
    }

    try {
      setSaving(true);
      
      if (!session) {
        throw new Error('Brak sesji użytkownika');
      }

      const config: eFlara = {
        address: homeAddress.trim(),
        enabled: eFlaraEnabled
      };
      
      const apiClient = createApiClient(API_BASE_URL, session);
      await apiClient.setEFlaraConfig(device.uuid || device.id, config);
      
      Alert.alert('Sukces', 'Ustawienia eFlara zostały zapisane');
      
    } catch (err) {
      console.error('Failed to save eFlara config:', err);
      Alert.alert(
        'Błąd', 
        err instanceof Error ? err.message : 'Nie udało się zapisać ustawień eFlara'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff4444" />
          <Text style={styles.loadingText}>Ładowanie ustawień...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color="#ff4444" />
          <Text style={styles.errorTitle}>Błąd ładowania</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDeviceInfo}>
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Ustawienia urządzenia</Text>
        <Text style={styles.settingsSubtitle}>{deviceName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nazwa urządzenia</Text>
        
        <View style={styles.renameRow}>
          <TextInput
            style={[styles.textInput, styles.renameInput]}
            placeholder="Wprowadź nazwę urządzenia"
            placeholderTextColor="#666666"
            value={deviceName}
            onChangeText={setDeviceName}
            editable={!renamingSaving}
            maxLength={30}
          />
          <TouchableOpacity 
            style={[styles.renameButton, renamingSaving && styles.disabledButton]} 
            onPress={handleRename}
            disabled={renamingSaving}
          >
            {renamingSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Save size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
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
            disabled={saving}
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
                editable={!saving}
              />
            </View>

            {/* eFlara Status */}
            <View style={styles.eFlaraStatus}>
              <AlertTriangle size={20} color={homeAddress.trim() ? "#22c55e" : "#f59e0b"} />
              <Text style={styles.eFlaraStatusText}>
                {homeAddress.trim() 
                  ? `eFlara będzie włączona dla adresu: ${homeAddress.trim()}`
                  : 'Podaj adres domowy aby aktywować eFlara'
                }
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.disabledButton]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Save size={20} color="#ffffff" />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? 'Zapisywanie...' : 'Zapisz ustawienia eFlara'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Save button when eFlara is disabled */}
        {!eFlaraEnabled && (
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.disabledButton]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Save size={20} color="#ffffff" />
            )}
            <Text style={styles.saveButtonText}>
              {saving ? 'Zapisywanie...' : 'Zapisz ustawienia eFlara'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function DevicesScreen({ navigation }: any) {
  const [loadedDevices, setLoadedDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { session } = useAuth();

  const handleAddDevice = () => {
    navigation.navigate('AddDevice');
  };

  const handleDevicePress = (device: any) => {
    navigation.navigate('DeviceDetails', { device });
  };

  // Fetch devices from API
  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!session) {
        throw new Error('Brak sesji użytkownika');
      }

      const apiClient = createApiClient(API_BASE_URL, session);

      const apiDevices = await apiClient.listDevices();
      
      // Transform API response to match UI expectations
      const transformedDevices = apiDevices.map((apiDevice, index) => ({
        id: apiDevice.internal_uuid,
        name: apiDevice.name ? apiDevice.name : `Czujnik ${apiDevice.internal_uuid.slice(-4)}`,
        status: 'online', // Default status since API doesn't provide this
        lastActivity: 'Nieznana', // Default since API doesn't provide this
        productId: apiDevice.product_id,
        uuid: apiDevice.internal_uuid,
        createdAt: apiDevice.created_at,
      }));

      setLoadedDevices(transformedDevices);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać urządzeń');
    } finally {
      setLoading(false);
    }
  };

  // Load devices when component mounts or session changes
  useEffect(() => {
    if (session) {
      fetchDevices();
    }
  }, [session]);

  // Refresh function
  const handleRefresh = () => {
    fetchDevices();
  };

  useFocusEffect(
    useCallback(() => {
      if (session) {
        fetchDevices();
      }
    }, [session])
  );

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

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff4444" />
          <Text style={styles.loadingText}>Ładowanie urządzeń...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color="#ff4444" />
          <Text style={styles.errorTitle}>Błąd ładowania</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Devices List */}
      {!loading && !error && loadedDevices.length > 0 && (
        <ScrollView style={styles.devicesScrollContainer}>
          <View style={styles.devicesContainer}>
            {loadedDevices.map((device) => (
              <TouchableOpacity 
                key={device.uuid} // Use UUID as key for uniqueness
                style={styles.deviceCard}
                onPress={() => handleDevicePress(device)}
              >
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceHeader}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <View style={[
                      styles.statusBadge, 
                      device.status === 'online' ? styles.statusOnline : styles.statusOffline
                    ]}>
                      <Text style={styles.statusText}>{device.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.deviceActivity}>
                    Dodano: {new Date(device.createdAt).toLocaleDateString('pl-PL')}
                  </Text>
                  <Text style={styles.deviceId}>ID: {device.uuid.substring(0,8)}</Text>
                </View>
                <View style={styles.deviceIcon}>
                  <AlarmSmoke size={24} color="#ff4444" />
                </View>
                <ChevronRight size={20} color="#666666" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Empty State */}
      {!loading && !error && loadedDevices.length === 0 && (
        <View style={styles.emptyState}>
          <Smartphone size={64} color="#666666" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Brak urządzeń</Text>
          <Text style={styles.emptySubtitle}>Dodaj swoje pierwsze urządzenie Brandbull Smart</Text>
        </View>
      )}
    </View>
  );
}

function AccountSettingsScreen({ navigation }: any) {
  const { signOut, session } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Usuń konto',
      'Czy na pewno chcesz usunąć swoje konto? Ta operacja jest nieodwracalna i spowoduje usunięcie wszystkich Twoich danych i urządzeń.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { 
          text: 'Usuń konto', 
          style: 'destructive',
          onPress: confirmDeleteAccount
        }
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeleting(true);
      
      if (!session) {
        throw new Error('Brak sesji użytkownika');
      }

      const apiClient = createApiClient(API_BASE_URL, session);
      await apiClient.deleteAccount();
      
      Alert.alert(
        'Konto usunięte',
        'Twoje konto zostało pomyślnie usunięte.',
        [
          {
            text: 'OK',
            onPress: () => signOut()
          }
        ]
      );
      
    } catch (err) {
      console.error('Failed to delete account:', err);
      Alert.alert(
        'Błąd', 
        err instanceof Error ? err.message : 'Nie udało się usunąć konta'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.settingsHeader}>
        <Text style={styles.settingsTitle}>Ustawienia konta</Text>
        <Text style={styles.settingsSubtitle}>Zarządzaj swoim kontem użytkownika</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zarządzanie kontem</Text>
        
        <TouchableOpacity 
          style={[styles.deleteAccountButton, deleting && styles.disabledButton]} 
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Trash2 size={20} color="#ffffff" />
          )}
          <Text style={styles.deleteAccountButtonText}>
            {deleting ? 'Usuwanie konta...' : 'Usuń konto'}
          </Text>
        </TouchableOpacity>

        <View style={styles.warningContainer}>
          <AlertTriangle size={16} color="#f59e0b" />
          <Text style={styles.warningText}>
            Usunięcie konta jest nieodwracalne. Wszystkie Twoje dane i urządzenia zostaną trwale usunięte.
          </Text>
        </View>
      </View>
    </ScrollView>
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

      <Stack.Screen 
        name="AccountSettings" 
        component={AccountSettingsScreen}
        options={{ headerShown: false }}
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
          onPress={() => {
            // Navigate to the DevicesList screen within the Devices stack
            props.navigation.navigate('Devices', { 
              screen: 'DevicesList' 
            });
            // Or alternatively, close the drawer and reset the stack
            props.navigation.closeDrawer();
          }}
        >
          <Smartphone size={20} color="#ffffff" style={styles.drawerItemIcon} />
          <Text style={styles.drawerItemText}>Twoje urządzenia</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.drawerItem}
          onPress={() => {
            props.navigation.navigate('Devices', { 
              screen: 'AccountSettings' 
            });
            props.navigation.closeDrawer();
          }}
        >
          <User size={20} color="#ffffff" style={styles.drawerItemIcon} />
          <Text style={styles.drawerItemText}>Ustawienia konta</Text>
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
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  renameInput: {
    flex: 1,
  },
  renameButton: {
    backgroundColor: '#ff4444',
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#cccccc',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  statusOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  deviceId: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
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
  deleteAccountButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteAccountButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});