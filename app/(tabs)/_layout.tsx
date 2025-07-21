import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Connection',
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
        }}
      />
      <Tabs.Screen
        name="gps"
        options={{
          title: 'GPS',
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: 'Files',
        }}
      />
      <Tabs.Screen
        name="sms"
        options={{
          title: 'SMS',
        }}
      />
      <Tabs.Screen
        name="call-log"
        options={{
          title: 'Call Log',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}