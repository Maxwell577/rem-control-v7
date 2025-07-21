import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';

export default function ConnectionTab() {
  const [serverIP, setServerIP] = useState('');
  const [serverPort, setServerPort] = useState('3000');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [deviceName, setDeviceName] = useState('');
  
  const { 
    isConnected, 
    connectionStatus, 
    connect, 
    disconnect 
  } = useDeviceConnection(serverIP, serverPort, autoReconnect);

  useEffect(() => {
    loadSavedSettings();
    generateDeviceName();
  }, []);

  const generateDeviceName = () => {
    if (!deviceName) {
      const platform = Platform.OS === 'ios' ? 'iPhone' : 'Android';
      const randomId = Math.random().toString(36).substring(2, 8);
      setDeviceName(`${platform}-${randomId}`);
    }
  };

  const loadSavedSettings = async () => {
    try {
      const savedIP = await AsyncStorage.getItem('serverIP');
      const savedPort = await AsyncStorage.getItem('serverPort');
      const savedAutoReconnect = await AsyncStorage.getItem('autoReconnect');
      const savedDeviceName = await AsyncStorage.getItem('deviceName');
      
      if (savedIP) setServerIP(savedIP);
      if (savedPort) setServerPort(savedPort);
      if (savedAutoReconnect) setAutoReconnect(JSON.parse(savedAutoReconnect));
      if (savedDeviceName) setDeviceName(savedDeviceName);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('serverIP', serverIP);
      await AsyncStorage.setItem('serverPort', serverPort);
      await AsyncStorage.setItem('autoReconnect', JSON.stringify(autoReconnect));
      await AsyncStorage.setItem('deviceName', deviceName);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleConnect = async () => {
    if (!serverIP.trim()) {
      Alert.alert('Error', 'Please enter a valid server IP address');
      return;
    }
    
    if (!deviceName.trim()) {
      Alert.alert('Error', 'Please enter a device name');
      return;
    }

    await saveSettings();
    connect(deviceName);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'disconnected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Remote Control Client</Text>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{connectionStatus}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Remote Management System</Text>
        <Text style={styles.infoDescription}>
          This app connects your device to a remote management server, allowing authorized control and monitoring from a web interface.
        </Text>
        <View style={styles.featuresList}>
          <Text style={styles.featureItem}>• Remote screen mirroring</Text>
          <Text style={styles.featureItem}>• File system access</Text>
          <Text style={styles.featureItem}>• Device information monitoring</Text>
          <Text style={styles.featureItem}>• Secure WebSocket connection</Text>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Device Name</Text>
          <TextInput
            style={styles.input}
            value={deviceName}
            onChangeText={setDeviceName}
            placeholder="Enter device name (e.g., Phone-1)"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Server IP Address</Text>
          <TextInput
            style={styles.input}
            value={serverIP}
            onChangeText={setServerIP}
            placeholder="Enter your VM IP (e.g., 192.168.1.100)"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Server Port</Text>
          <TextInput
            style={styles.input}
            value={serverPort}
            onChangeText={setServerPort}
            placeholder="3000"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>Auto Reconnect</Text>
          <Switch
            value={autoReconnect}
            onValueChange={setAutoReconnect}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={autoReconnect ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isConnected ? styles.disconnectButton : styles.connectButton]}
          onPress={isConnected ? handleDisconnect : handleConnect}
        >
          <Text style={styles.buttonText}>
            {isConnected ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>

        {connectionStatus === 'connecting' && (
          <Text style={styles.connectingText}>
            Connecting to {serverIP}:{serverPort}...
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#2563eb',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  connectingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
  },
});
        )}
      </View>

      <View style={styles.connectionStatus}>
        <Text style={styles.connectionLabel}>Connection Status</Text>
        <View style={styles.connectionDetails}>
          <View style={[styles.connectionDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.connectionText}>
            {isConnected ? 'Connected and ready for remote control' : 'Disconnected - Connect to enable remote features'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  featuresList: {
    marginTop: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#2563eb',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  connectingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
  },
  connectionStatus: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 20,
  },
  connectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  connectionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
});