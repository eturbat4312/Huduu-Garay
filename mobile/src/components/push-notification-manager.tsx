import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

import { useAuth } from '@/context/auth';
import {
  markNotificationRead,
  registerPushDevice,
  REGISTERED_PUSH_TOKEN_KEY,
} from '@/lib/api';
import {
  navigateForNotification,
  type NotificationNavigationData,
} from '@/lib/notification-navigation';
import { getItem, setItem } from '@/lib/storage';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function registerForPushNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice || Constants.appOwnership === 'expo') {
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Мэдэгдэл',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo EAS projectId тохируулаагүй байна.');

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const previousToken = await getItem(REGISTERED_PUSH_TOKEN_KEY);
  await registerPushDevice({
    token,
    previous_token: previousToken && previousToken !== token ? previousToken : undefined,
    platform: Platform.OS as 'ios' | 'android',
  });
  await setItem(REGISTERED_PUSH_TOKEN_KEY, token);
}

let lastHandledResponseId: string | null = null;

async function handleResponse(response: Notifications.NotificationResponse) {
  const responseId = response.notification.request.identifier;
  if (lastHandledResponseId === responseId) return;
  lastHandledResponseId = responseId;

  const data = response.notification.request.content.data as NotificationNavigationData & {
    notification_id?: number | string;
  };
  if (data.notification_id) {
    try {
      await markNotificationRead(data.notification_id);
    } catch {}
  }
  DeviceEventEmitter.emit('notifications:changed');
  navigateForNotification(data);
}

export function PushNotificationManager() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      DeviceEventEmitter.emit('notifications:changed');
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => void handleResponse(response),
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    void registerForPushNotifications().catch((error) => {
      console.warn('Push notification registration failed', error);
    });

    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (!response) return;
      await handleResponse(response);
      await Notifications.clearLastNotificationResponseAsync();
    });
  }, [isAuthenticated]);

  return null;
}
