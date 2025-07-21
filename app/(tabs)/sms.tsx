import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceConnection } from '@/hooks/useDeviceConnection';

interface SMSMessage {
  id: string;
  address: string;
  body: string;
  date: string;
  type: 'inbox' | 'sent';
  read: boolean;
}

export default function SMSTab() {
  const { isConnected, sendMessage } = useDeviceConnection();
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<SMSMessage[]>([]);

  useEffect(() => {
    filterMessages();
  }, [messages, searchQuery]);

  const filterMessages = () => {
    if (!searchQuery.trim()) {
      setFilteredMessages(messages);
      return;
    }

    const filtered = messages.filter(message => 
      message.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.address.includes(searchQuery)
    );
    setFilteredMessages(filtered);
  };

  const requestSMS = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    setIsLoading(true);
    sendMessage({
      type: 'request_sms',
      data: {}
    });

    // The actual SMS data will come from the server response
    // Reset loading after timeout if no response
    setTimeout(() => {
      setIsLoading(false);
    }, 10000);
  };

  const shareSMS = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    if (messages.length === 0) {
      Alert.alert('Error', 'No messages to share');
      return;
    }

    sendMessage({
      type: 'sms_backup',
      data: messages
    });

    Alert.alert('Success', `${messages.length} messages shared with server`);
  };

  const markAsRead = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, read: true } : msg
      )
    );
  };

  const deleteMessage = (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
            Alert.alert('Success', 'Message deleted');
          },
        },
      ]
    );
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SMS Messages</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={[styles.actionButton, !isConnected && styles.disabledButton]} 
          onPress={requestSMS}
          disabled={isLoading || !isConnected}
        >
          <Ionicons name={isLoading ? "refresh" : "sync"} size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>
            {isLoading ? 'Loading...' : 'Load Messages'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shareButton, (!isConnected || messages.length === 0) && styles.disabledButton]} 
          onPress={shareSMS}
          disabled={!isConnected || messages.length === 0}
        >
          <Ionicons name="share" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Share All</Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <ScrollView style={styles.messagesList}>
        {filteredMessages.length > 0 ? (
          <View style={styles.messagesContainer}>
            {filteredMessages.map((message) => (
              <TouchableOpacity 
                key={message.id} 
                style={[
                  styles.messageItem,
                  !message.read && styles.unreadMessage
                ]}
                onPress={() => !message.read && markAsRead(message.id)}
              >
                <View style={styles.messageHeader}>
                  <View style={styles.messageInfo}>
                    <View style={[
                      styles.messageTypeIndicator,
                      { backgroundColor: message.type === 'sent' ? '#2563eb' : '#10b981' }
                    ]}>
                      <Ionicons 
                        name={message.type === 'sent' ? "arrow-up" : "arrow-down"} 
                        size={12} 
                        color="#ffffff" 
                      />
                    </View>
                    
                    <View style={styles.senderInfo}>
                      <Text style={styles.senderNumber}>
                        {formatPhoneNumber(message.address)}
                      </Text>
                      <Text style={styles.messageTime}>
                        {new Date(message.date).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.messageActions}>
                    {!message.read && (
                      <View style={styles.unreadDot} />
                    )}
                    
                    <TouchableOpacity 
                      style={styles.actionIcon}
                      onPress={() => deleteMessage(message.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <Text style={styles.messageBody} numberOfLines={3}>
                  {message.body}
                </Text>
                
                <View style={styles.messageFooter}>
                  <Text style={styles.messageType}>
                    {message.type === 'sent' ? 'Sent' : 'Received'}
                  </Text>
                  {message.type === 'inbox' && !message.read && (
                    <Text style={styles.unreadLabel}>Unread</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Messages</Text>
            <Text style={styles.emptySubtitle}>
              {isLoading 
                ? 'Loading messages...'
                : 'Tap "Load Messages" to fetch SMS from device'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Results</Text>
            <Text style={styles.emptySubtitle}>
              No messages match your search query
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Stats Footer */}
      {messages.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{messages.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {messages.filter(m => m.type === 'inbox').length}
              </Text>
              <Text style={styles.statLabel}>Received</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {messages.filter(m => m.type === 'sent').length}
              </Text>
              <Text style={styles.statLabel}>Sent</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {messages.filter(m => !m.read).length}
              </Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
          </View>
        </View>
      )}
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
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unreadMessage: {
    backgroundColor: '#f0f9ff',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  messageTypeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  senderInfo: {
    flex: 1,
  },
  senderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  messageTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  actionIcon: {
    padding: 4,
  },
  messageBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageType: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  unreadLabel: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
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
    lineHeight: 20,
  },
  footer: {
    padding: 20,
  },
  statsContainer: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
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