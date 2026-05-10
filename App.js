import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CustomAlertProvider } from './src/context/CustomAlertContext';
import { COLORS } from './src/theme/theme';
import { Package, Truck, User } from 'lucide-react-native';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PickupScreen from './src/screens/PickupScreen';
import DeliveryScreen from './src/screens/DeliveryScreen';
import ReportIssueScreen from './src/screens/ReportIssueScreen';
import ThirdPartyDispatchScreen from './src/screens/ThirdPartyDispatchScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import IssueChatScreen from './src/screens/IssueChatScreen';
import LiveChatBot from './src/components/LiveChatBot';

import { SafeAreaProvider } from 'react-native-safe-area-context';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => (
  <Tab.Navigator 
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: { 
        backgroundColor: COLORS.card,
        borderTopColor: 'rgba(148, 163, 184, 0.1)',
        paddingBottom: 5,
        height: 60
      },
      tabBarIcon: ({ color, size }) => {
        if (route.name === 'Collections') return <Package color={color} size={size} />;
        if (route.name === 'Deliveries') return <Truck color={color} size={size} />;
        if (route.name === 'Profile') return <User color={color} size={size} />;
      },
    })}
  >
    <Tab.Screen name="Collections" component={HomeScreen} />
    <Tab.Screen name="Deliveries" component={DeliveryScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const Navigation = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.background } }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Pickup" component={PickupScreen} />
            <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
            <Stack.Screen name="ThirdPartyDispatch" component={ThirdPartyDispatchScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="IssueChat" component={IssueChatScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <CustomAlertProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Navigation />
          <LiveChatBot />
        </AuthProvider>
      </CustomAlertProvider>
    </SafeAreaProvider>
  );
}
