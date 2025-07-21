import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';

export default function ConnectionTab() {
  const [serverIP, setServerIP] = useState('192.168.1.100');
  const [serverPort, setServerPort] = useState('3000');
  const [autoConnect, setAutoConnect] = useState(false);
  
  const { isConnected, isConnecting, status, error, connect, disconnect } = useDeviceConnection();

  useEffect(() => {
    loadConnectionSettings();
  }, []);

  useEffect(() => {
    // Auto-reconnect logic
    const handleAutoReconnect = async () => {
      if (autoConnect && !isConnected && !isConnecting && serverIP && serverPort) {
        console.log('Attempting auto-reconnect...');
        await reconnect(serverIP, serverPort);
      }
    };

    // Check for auto-reconnect every 10 seconds
    const reconnectInterval = setInterval(handleAutoReconnect, 10000);

    return () => clearInterval(reconnectInterval);
  }, [autoConnect, isConnected, isConnecting, serverIP, serverPort, reconnect]);

  const loadConnectionSettings = async () => {
    try {
      const savedIP = await AsyncStorage.getItem('serverIP');
      const savedPort = await AsyncStorage.getItem('serverPort');
      const savedAutoConnect = await AsyncStorage.getItem('autoConnect');
      
      if (savedIP) setServerIP(savedIP);
      if (savedPort) setServerPort(savedPort);
      if (savedAutoConnect) setAutoConnect(JSON.parse(savedAutoConnect));
    } catch (error) {
      console.error('Error loading connection settings:', error);
    }
  };

  const saveConnectionSettings = async () => {
    try {
      await AsyncStorage.setItem('serverIP', serverIP);
      await AsyncStorage.setItem('serverPort', serverPort);
      await AsyncStorage.setItem('autoConnect', JSON.stringify(autoConnect));
    } catch (error) {
      console.error('Error saving connection settings:', error);
    }
  };

  const validateInputs = () => {
    if (!serverIP.trim()) {
      Alert.alert('Error', 'Please enter a server IP address');
      return false;
    }
    
    if (!serverPort.trim()) {
      Alert.alert('Error', 'Please enter a server port');
      return false;
    }
    
    const portNum = parseInt(serverPort);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert('Error', 'Please enter a valid port number (1-65535)');
      return false;
    }
    
    return true;
  };

  const connectToServer = async () => {
    if (!validateInputs()) return;
    
    try {
      // Save settings before connecting
      await saveConnectionSettings();
      
      const success = await connect(serverIP, serverPort);
      
      if (success) {
        Alert.alert('Success', `Connected to ${serverIP}:${serverPort}`);
      } else {
        Alert.alert('Connection Error', error || 'Failed to connect to server. Please check your settings and try again.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server. Please check your settings and try again.');
    }
  };

  const disconnectFromServer = () => {
    disconnect();
    Alert.alert('Disconnected', 'Connection to server has been closed');
  };

  const getStatusColor = () => {
    if (isConnected) return '#10b981';
    if (isConnecting) return '#f59e0b';
    return '#ef4444';
  };

  const getStatusIcon = () => {
    if (isConnected) return 'checkmark-circle';
    if (isConnecting) return 'time';
    return 'close-circle';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="wifi" size={32} color="#2563eb" />
          <Text style={styles.title}>Remote Connection</Text>
        </View>
        <Text style={styles.subtitle}>Connect to your remote device server</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons 
            name={getStatusIcon()} 
            size={24} 
            color={getStatusColor()} 
          />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {status}
          </Text>
        </View>
        {isConnected && (
          <Text style={styles.connectedInfo}>
            Connected to {serverIP}:{serverPort}
          </Text>
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Server Configuration</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Server IP Address</Text>
          <TextInput
            style={styles.input}
            value={serverIP}
            onChangeText={setServerIP}
            placeholder="192.168.1.100"
            placeholderTextColor="#9ca3af"
            editable={!isConnected}
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
            editable={!isConnected}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.switchGroup}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Auto Connect</Text>
            <Text style={styles.switchDescription}>
              Automatically connect when app starts
            </Text>
          </View>
          <Switch
            value={autoConnect}
            onValueChange={setAutoConnect}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={autoConnect ? '#2563eb' : '#f3f4f6'}
          />
        </View>
      </View>

      <View style={styles.actionButtons}>
        {!isConnected ? (
          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.connectingButton]}
            onPress={connectToServer}
            disabled={isConnecting}
          >
            <Ionicons 
              name={isConnecting ? "hourglass" : "link"} 
              size={20} 
              color="#ffffff" 
            />
            <Text style={styles.buttonText}>
              {isConnecting ? 'Connecting...' : 'Connect to Server'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={disconnectFromServer}
          >
            <Ionicons name="unlink" size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#6b7280" />
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>Connection Instructions</Text>
          <Text style={styles.infoDescription}>
            1. Make sure the server is running on your computer{'\n'}
            2. Enter the server's IP address and port{'\n'}
            3. Tap "Connect to Server" to establish connection
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
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  connectedInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  switchDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  actionButtons: {
    marginBottom: 20,
  },
  connectButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  connectingButton: {
    backgroundColor: '#6b7280',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});