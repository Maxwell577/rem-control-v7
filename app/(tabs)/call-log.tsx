import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';

interface CallLogEntry {
  id: string;
  phoneNumber: string;
  name?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: string;
}

export default function CallLogTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const requestCallLog = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    setIsLoading(true);
    sendMessage({
      type: 'request_call_log',
      data: {}
    });

    // The actual call log data will come from the server response
    // Reset loading after timeout if no response
    setTimeout(() => {
      setIsLoading(false);
    }, 10000);
  };

  const getCallTypeIcon = (type: string) => {
    switch (type) {
      case 'incoming': return 'call';
      case 'outgoing': return 'call';
      case 'missed': return 'call-outline';
      default: return 'call';
    }
  };

  const getCallTypeColor = (type: string) => {
    switch (type) {
      case 'incoming': return '#10b981';
      case 'outgoing': return '#3b82f6';
      case 'missed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCallType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Call History</Text>
        <TouchableOpacity 
          style={[styles.refreshButton, !isConnected && styles.disabledButton]} 
          onPress={requestCallLog}
          disabled={!isConnected || isLoading}
        >
          <Ionicons 
            name={isLoading ? "refresh" : "sync"} 
            size={16} 
            color="#ffffff" 
            style={isLoading ? styles.spinning : {}}
          />
          <Text style={styles.refreshButtonText}>
            {isLoading ? 'Loading...' : 'Load Call Log'}
          </Text>
        </TouchableOpacity>
      </View>

      {!isConnected && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={styles.warningText}>
            Connect to server to access call history
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {callLog.length > 0 ? (
          <View style={styles.callLogList}>
            {callLog.map((call) => (
              <View key={call.id} style={styles.callItem}>
                <View style={styles.callInfo}>
                  <View style={[styles.callTypeIndicator, { backgroundColor: getCallTypeColor(call.type) }]}>
                    <Ionicons 
                      name={getCallTypeIcon(call.type) as any} 
                      size={16} 
                      color="#ffffff" 
                    />
                  </View>
                  <View style={styles.callDetails}>
                    <Text style={styles.callName}>
                      {call.name || call.phoneNumber}
                    </Text>
                    <Text style={styles.callNumber}>
                      {call.phoneNumber}
                    </Text>
                    <View style={styles.callMeta}>
                      <Text style={styles.callType}>
                        {formatCallType(call.type)}
                      </Text>
                      <Text style={styles.callDuration}>
                        {call.duration > 0 ? formatDuration(call.duration) : 'No duration'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.callTime}>
                  {new Date(call.timestamp).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="call-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Call History</Text>
            <Text style={styles.emptySubtitle}>
              {isConnected 
                ? 'Tap "Load Call Log" to fetch call history from your device'
                : 'Connect to server to access call history'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{callLog.length}</Text>
            <Text style={styles.statLabel}>Total Calls</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {callLog.filter(call => call.type === 'missed').length}
            </Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {callLog.filter(call => call.duration > 0).length}
            </Text>
            <Text style={styles.statLabel}>Answered</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  refreshButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#92400e',
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  callLogList: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  callItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callTypeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callDetails: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  callNumber: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  callMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  callType: {
    fontSize: 12,
    color: '#9ca3af',
    marginRight: 8,
  },
  callDuration: {
    fontSize: 12,
    color: '#9ca3af',
  },
  callTime: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  footer: {
    padding: 20,
  },
  statsCard: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
});