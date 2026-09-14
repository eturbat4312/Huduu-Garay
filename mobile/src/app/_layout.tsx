import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppShell from '@/components/app-shell';
import { AuthProvider } from '@/context/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AppShell>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="listing/[id]"
              options={{
                headerShown: true,
                title: 'Дэлгэрэнгүй',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="checkout"
              options={{
                headerShown: true,
                title: 'Захиалга',
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="login"
              options={{
                headerShown: true,
                title: 'Нэвтрэх',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="signup"
              options={{
                headerShown: true,
                title: 'Бүртгүүлэх',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="become-host"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="edit-profile"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="my-listings"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="host-bookings"
              options={{ headerShown: false }}
            />
          </Stack>
        </AppShell>
      </AuthProvider>
    </ThemeProvider>
  );
}
