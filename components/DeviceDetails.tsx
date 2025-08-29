import { createApiClient, DeviceEvents, DeviceInfo } from '@/lib/client';
import { useFocusEffect } from '@react-navigation/native';
import { AlarmSmoke, AlertTriangle, Battery, ChevronRight, Settings, Signal, TestTube, Wifi, WifiOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './AuthContext';

const API_BASE_URL = 'https://bbsmart.smarthelmet.pl';

interface DeviceParam {
  uuid?: string;
  id?: string;
  name: string;
}

// Screen: Device Details with Tabs
function DeviceDetailsScreen({ route, navigation }: any) {
  const { device } = route.params;
  const { session } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'events' | 'system'>('events');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch device info and events
  const fetchDeviceData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!session) {
        throw new Error('Brak sesji użytkownika');
      }

      const apiClient = createApiClient(API_BASE_URL, session);
      
      // Fetch device info and events in parallel
      const [infoResponse, eventsResponse] = await Promise.all([
        apiClient.getDeviceInfo(device.uuid || device.id),
        apiClient.getDeviceLogs(device.uuid || device.id)
      ]);
      
      setDeviceInfo(infoResponse);
      setDeviceEvents(eventsResponse);
      
    } catch (err) {
      console.error('Failed to fetch device data:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych urządzenia');
    } finally {
      setLoading(false);
    }
  };


  useFocusEffect(
    useCallback(() => {
      fetchDeviceData();
    }, [device.uuid, device.id, session])
  );

  useEffect(() => {
    fetchDeviceData();
  }, [device.uuid, device.id, session]);

  const getEventIcon = (eventName: string) => {
    switch (eventName.toLowerCase()) {
      case 'alarmtest':
        return <TestTube size={20} color="#22c55e" />;
      case 'smokealarm':
        return <AlertTriangle size={20} color="#ff4444" />;
      case 'batterylow':
        return <Battery size={20} color="#f59e0b" />;
      default:
        return <AlarmSmoke size={20} color="#cccccc" />;
    }
  };

  const getSystemEventIcon = (propertyName: string) => {
    if (propertyName.includes('Battery')) {
      return <Battery size={20} color="#22c55e" />;
    }
    if (propertyName.includes('RSSI') || propertyName.includes('DeviceINFO')) {
      return <Signal size={20} color="#3b82f6" />;
    }
    if (propertyName.includes('Version') || propertyName.includes('Certification')) {
      return <Settings size={20} color="#8b5cf6" />;
    }
    return <TestTube size={20} color="#cccccc" />;
  };

  const formatEventName = (eventName: string) => {
    switch (eventName.toLowerCase()) {
      case 'alarmtest':
        return 'Test alarmu';
      case 'smokealarm':
        return 'Alarm dymu';
      case 'batterylow':
        return 'Niski poziom baterii';
      default:
        return eventName;
    }
  };

  const formatPropertyName = (properties: Record<string, unknown>) => {
    const keys = Object.keys(properties);
    if (keys.includes('BatteryPercentage')) {
      return `Bateria: ${properties.BatteryPercentage}%`;
    }
    if (keys.includes('RSSI')) {
      return `Siła sygnału: ${properties.RSSI} dBm`;
    }
    if (keys.includes('Version')) {
      return `Wersja oprogramowania: ${properties.Version}`;
    }
    if (keys.includes('UnderVoltError')) {
      return `Błąd podnapięcia: ${properties.UnderVoltError === 0 ? 'Brak' : 'Wykryto'}`;
    }
    if (keys.includes('CertificationType')) {
      return `Typ certyfikacji: ${properties.CertificationType}`;
    }
    // For complex properties like DeviceINFO, show summary
    if (keys.includes('DeviceINFO')) {
      const info = properties.DeviceINFO as { IP?: string; DBM?: number };
      return `Informacje urządzenia: IP ${info?.IP || 'N/A'}, Sygnał ${info?.DBM || 'N/A'} dBm`;
    }
    
    // Fallback: show first key-value pair
    if (keys.length > 0) {
      return `${keys[0]}: ${JSON.stringify(properties[keys[0]])}`;
    }
    
    return 'Zdarzenie systemowe';
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Nieznana data';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return `Dzisiaj, ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Wczoraj, ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays < 7) {
        return `${diffDays} dni temu`;
      } else {
        return date.toLocaleDateString('pl-PL');
      }
    } catch {
      return 'Nieprawidłowa data';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff4444" />
          <Text style={styles.loadingText}>Ładowanie danych urządzenia...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchDeviceData}>
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Device Header */}
      <View style={styles.deviceDetailsHeader}>
        <View style={styles.deviceIconContainer}>
          <AlarmSmoke size={48} color="#ff4444" />
          {deviceInfo?.state === 'online' ? (
            <Wifi size={20} color="#22c55e" style={styles.statusIcon} />
          ) : (
            <WifiOff size={20} color="#ef4444" style={styles.statusIcon} />
          )}
        </View>
        <Text style={styles.deviceDetailsName}>
          {deviceInfo?.name || device.name}
        </Text>
        <View style={[
          styles.statusBadge,
          deviceInfo?.state === 'online' ? styles.statusOnline : styles.statusOffline
        ]}>
          <Text style={styles.statusText}>
            {deviceInfo?.state === 'online' ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
            Zdarzenia ({deviceEvents?.events?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'system' && styles.activeTab]}
          onPress={() => setActiveTab('system')}
        >
          <Text style={[styles.tabText, activeTab === 'system' && styles.activeTabText]}>
            System ({deviceEvents?.properties?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.contentContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'events' ? (
          // Events Tab
          <View style={styles.section}>
            {deviceEvents?.events && deviceEvents.events.length > 0 ? (
              <View style={styles.eventsContainer}>
                {deviceEvents.events.map((event, index) => (
                  <View key={index} style={styles.eventCard}>
                    <View style={styles.eventIcon}>
                      {getEventIcon(event.name)}
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventMessage}>
                        {formatEventName(event.name)}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatTimestamp(event.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <TestTube size={48} color="#666666" />
                <Text style={styles.emptyTitle}>Brak zdarzeń</Text>
                <Text style={styles.emptySubtitle}>
                  To urządzenie nie ma jeszcze żadnych zarejestrowanych zdarzeń
                </Text>
              </View>
            )}
          </View>
        ) : (
          // System Tab
          <View style={styles.section}>
            {deviceEvents?.properties && deviceEvents.properties.length > 0 ? (
              <View style={styles.eventsContainer}>
                {deviceEvents.properties.map((prop, index) => (
                  <View key={index} style={styles.eventCard}>
                    <View style={styles.eventIcon}>
                      {getSystemEventIcon(JSON.stringify(prop.properties))}
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventMessage}>
                        {formatPropertyName(prop.properties)}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatTimestamp(prop.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Settings size={48} color="#666666" />
                <Text style={styles.emptyTitle}>Brak danych systemowych</Text>
                <Text style={styles.emptySubtitle}>
                  Brak zarejestrowanych danych systemowych dla tego urządzenia
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  // Loading and Error States
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

  // Device Header
  deviceDetailsHeader: {
    alignItems: 'center',
    padding: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  deviceIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  statusIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#000000',
    borderRadius: 10,
    padding: 2,
  },
  deviceDetailsName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Tab Navigation
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  activeTab: {
    backgroundColor: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#ff4444',
  },
  tabText: {
    fontSize: 14,
    color: '#cccccc',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Content
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20, // Add bottom padding to ensure settings button is visible
  },
  section: {
    padding: 20,
  },
  
  // Events
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // Settings Section
  settingsSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
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
});

export default DeviceDetailsScreen;