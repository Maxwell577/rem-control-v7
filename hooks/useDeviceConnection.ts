import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';

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
        // Handle location request from server
        break;
      case 'request_contacts':
        // Handle contacts request from server
        break;
      // Add more message handlers as needed
      default:
        console.log('Unhandled server message:', message);
    }
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
    sendMessage,
  };
}