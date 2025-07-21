import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  status: string;
  error: string | null;
}

export function useDeviceConnection() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    status: 'Disconnected',
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = async (serverIP: string, serverPort: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (connectionState.isConnecting || connectionState.isConnected) {
        resolve(false);
        return;
      }

      setConnectionState(prev => ({
        ...prev,
        isConnecting: true,
        status: 'Connecting...',
        error: null,
      }));

      try {
        const wsUrl = `ws://${serverIP}:${serverPort}`;
        const ws = new WebSocket(wsUrl);
        
        const connectionTimeout = setTimeout(() => {
          ws.close();
          setConnectionState(prev => ({
            ...prev,
            isConnecting: false,
            status: 'Connection Failed',
            error: 'Connection timeout',
          }));
          resolve(false);
        }, 10000); // 10 second timeout

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          wsRef.current = ws;
          
          // Register device with server
          const deviceInfo = {
            type: 'register',
            data: {
              deviceId: Device.osInternalBuildId || `device-${Date.now()}`,
              deviceName: Device.deviceName || 'Unknown Device',
              brand: Device.brand || 'Unknown',
              model: Device.modelName || 'Unknown',
              platform: Device.osName || 'Unknown',
              systemVersion: Device.osVersion || 'Unknown',
            }
          };
          
          ws.send(JSON.stringify(deviceInfo));
          
          setConnectionState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            status: 'Connected',
            error: null,
          }));

          // Start heartbeat
          startHeartbeat();
          resolve(true);
        };

        ws.onclose = () => {
          clearTimeout(connectionTimeout);
          stopHeartbeat();
          wsRef.current = null;
          
          setConnectionState(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            status: 'Disconnected',
            error: null,
          }));
          resolve(false);
        };

        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', error);
          
          setConnectionState(prev => ({
            ...prev,
            isConnecting: false,
            status: 'Connection Failed',
            error: 'Failed to connect to server',
          }));
          resolve(false);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
          } catch (error) {
            console.error('Error parsing server message:', error);
          }
        };

      } catch (error) {
        setConnectionState(prev => ({
          ...prev,
          isConnecting: false,
          status: 'Connection Failed',
          error: 'Invalid server address',
        }));
        resolve(false);
      }
    });
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    setConnectionState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      status: 'Disconnected',
      error: null,
    }));
  };

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const handleServerMessage = (message: any) => {
    switch (message.type) {
      case 'pong':
        // Server responded to ping, connection is alive
        break;
      case 'request_location':
        handleLocationRequest();
        break;
      case 'request_contacts':
        handleContactsRequest();
        break;
      case 'request_files':
        handleFilesRequest();
        break;
      case 'browse_directory':
        handleDirectoryRequest(message.data);
        break;
      // Add more message handlers as needed
      default:
        console.log('Unhandled server message:', message);
    }
  };

  const handleLocationRequest = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        sendMessage({
          type: 'location_response',
          data: { error: 'Location permission denied' }
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      sendMessage({
        type: 'location_response',
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        }
      });
    } catch (error) {
      sendMessage({
        type: 'location_response',
        data: { error: error.message }
      });
    }
  };

  const handleContactsRequest = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        sendMessage({
          type: 'contacts_response',
          data: { error: 'Contacts permission denied' }
        });
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      sendMessage({
        type: 'contacts_response',
        data: data
      });
    } catch (error) {
      sendMessage({
        type: 'contacts_response',
        data: { error: error.message }
      });
    }
  };

  const handleFilesRequest = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        sendMessage({
          type: 'files_response',
          data: { error: 'Media library permission denied' }
        });
        return;
      }

      const assets = await MediaLibrary.getAssetsAsync({
        first: 100,
        mediaType: 'photo',
      });

      const files = assets.assets.map(asset => ({
        id: asset.id,
        filename: asset.filename,
        uri: asset.uri,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        modificationTime: asset.modificationTime,
        duration: asset.duration,
      }));

      sendMessage({
        type: 'files_response',
        data: files
      });
    } catch (error) {
      sendMessage({
        type: 'files_response',
        data: { error: error.message }
      });
    }
  };

  const handleDirectoryRequest = async (data: any) => {
    try {
      // For mobile, we'll browse media library by type
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        sendMessage({
          type: 'directory_response',
          data: { error: 'Media library permission denied' }
        });
        return;
      }

      const assets = await MediaLibrary.getAssetsAsync({
        first: 50,
        mediaType: 'photo',
      });

      const files = assets.assets.map(asset => ({
        name: asset.filename,
        type: 'file',
        size: 0, // Size not available in MediaLibrary
        path: asset.uri,
        isDirectory: false,
        lastModified: asset.modificationTime,
      }));

      sendMessage({
        type: 'directory_response',
        data: {
          files: files,
          currentPath: data.path || '/media'
        }
      });
    } catch (error) {
      sendMessage({
        type: 'directory_response',
        data: { error: error.message }
      });
    }
  };

  const reconnect = async (serverIP: string, serverPort: string) => {
    if (connectionState.isConnecting) return false;
    
    setConnectionState(prev => ({
      ...prev,
      status: 'Reconnecting...',
      error: null,
    }));

    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return connect(serverIP, serverPort);
  };
  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    ...connectionState,
    connect,
    disconnect,
    reconnect,
    sendMessage,
  };
}