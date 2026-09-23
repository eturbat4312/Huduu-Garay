import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, BottomTabInset, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchNotifications, markNotificationRead } from '@/lib/api';
import { navigateForNotification } from '@/lib/notification-navigation';
import type { NotificationItem } from '@/types/api';

// ─── Notification icon by type ──────────────────────────────────────────────
function notifIcon(type: string): string {
  switch (type) {
    case 'booking_created':    return '📬';
    case 'booking_confirmed':  return '✅';
    case 'booking_cancelled':  return '❌';
    case 'host_approved':      return '🎉';
    case 'host_rejected':      return '⛔';
    case 'review':             return '⭐';
    case 'listing_published':  return '🏠';
    case 'listing_review':     return '📝';
    case 'admin_listing_review': return '🔎';
    case 'payment':            return '💳';
    case 'admin_support':      return '🆘';
    case 'support_reply':      return '💬';
    default:                   return '🔔';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Row ────────────────────────────────────────────────────────────────────
function NotifRow({
  item,
  C,
  onPress,
}: {
  item: NotificationItem;
  C: ColorPalette;
  onPress: (item: NotificationItem) => void;
}) {
  const unread = !item.is_read;
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: unread ? '#EFF6FF' : C.backgroundElement },
        unread && styles.rowUnread,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={styles.icon}>{notifIcon(item.type)}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.message, { color: C.text }, unread && { fontWeight: '600' }]}>
          {item.message}
        </Text>
        <Text style={[styles.date, { color: C.textSecondary }]}>{formatDate(item.created_at)}</Text>
      </View>
      {unread && <View style={styles.dot} />}
    </Pressable>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canTestInExpoGo = __DEV__ && Constants.appOwnership === 'expo';

  const load = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Мэдэгдэл ачаалахад алдаа гарлаа';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  // Screen-д focus орох бүрт дахин ачаалах
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('notifications:changed', () => {
      void load(true);
    });
    return () => subscription.remove();
  }, [load]);

  const handlePress = useCallback((item: NotificationItem) => {
    if (!item.is_read) {
      setItems((current) => current.map((entry) => (
        entry.id === item.id ? { ...entry, is_read: true } : entry
      )));
      markNotificationRead(item.id)
        .then(() => DeviceEventEmitter.emit('notifications:marked-read'))
        .catch(() => {
          setItems((current) => current.map((entry) => (
            entry.id === item.id ? { ...entry, is_read: false } : entry
          )));
        });
    }
    navigateForNotification(item);
  }, []);

  const testLocalNotification = useCallback(async () => {
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      Alert.alert('Мэдэгдлийн зөвшөөрөл', 'Төхөөрөмжийн тохиргооноос notification зөвшөөрнө үү.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Танайд Хоноё — туршилт',
        body: 'Expo Go дээр local notification амжилттай ажиллаж байна.',
        data: { type: 'local_test' },
      },
      trigger: null,
    });
  }, []);

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Text style={{ fontSize: 40 }}>🔔</Text>
          <ThemedText type="smallBold">Нэвтэрсний дараа мэдэгдлүүд харагдана</ThemedText>
          <Pressable
            onPress={() => router.push('/login' as never)}
            style={styles.loginBtn}
          >
            <Text style={styles.loginBtnText}>Нэвтрэх</Text>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Мэдэгдэл</ThemedText>
          {canTestInExpoGo && (
            <Pressable onPress={() => void testLocalNotification()} style={styles.testButton}>
              <Text style={styles.testButtonText}>Expo Go тест</Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.text} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 32 }}>⚠️</Text>
            <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.two, textAlign: 'center' }}>
              {error}
            </ThemedText>
            <Pressable onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Дахин оролдох</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => <NotifRow item={item} C={C} onPress={handlePress} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
            }
            contentContainerStyle={items.length === 0 && styles.emptyContainer}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ fontSize: 40 }}>🔔</Text>
                <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                  Одоогоор мэдэгдэл байхгүй байна
                </ThemedText>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.backgroundSelected }} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingBottom: BottomTabInset },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  emptyContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  testButton: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  testButtonText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  icon: { fontSize: 24, marginTop: 2 },
  rowBody: { flex: 1, gap: 4 },
  message: { fontSize: 14, lineHeight: 20 },
  date: { fontSize: 12 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#3B82F6', marginTop: 6,
  },
  loginBtn: {
    marginTop: Spacing.two,
    backgroundColor: '#16A34A',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  retryBtn: {
    marginTop: Spacing.two,
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
