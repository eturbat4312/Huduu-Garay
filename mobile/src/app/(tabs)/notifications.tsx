import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { Colors, Spacing, BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchNotifications, markNotificationsRead } from '@/lib/api';
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
    case 'payment':            return '💳';
    default:                   return '🔔';
  }
}

// ─── Navigate on tap ────────────────────────────────────────────────────────
function handleNotifPress(item: NotificationItem) {
  if (item.related_booking) {
    if (item.type === 'booking_created' || item.type === 'admin_booking') {
      router.push('/host-bookings' as never);
    } else {
      router.push('/bookings' as never);
    }
  } else if (item.related_listing) {
    router.push(`/listings/${item.related_listing}` as never);
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Row ────────────────────────────────────────────────────────────────────
function NotifRow({ item, C }: { item: NotificationItem; C: (typeof Colors)['light'] }) {
  const unread = !item.is_read;
  const tappable = !!(item.related_booking || item.related_listing);
  return (
    <Pressable
      onPress={() => handleNotifPress(item)}
      disabled={!tappable}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: unread ? '#EFF6FF' : C.backgroundElement },
        unread && styles.rowUnread,
        pressed && tappable && { opacity: 0.75 },
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

  const load = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data);
      // Бүгдийг уншсан гэж тэмдэглэнэ
      await markNotificationsRead().catch(() => {});
      DeviceEventEmitter.emit('notifications:marked-read');
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

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Text style={{ fontSize: 40 }}>🔔</Text>
          <ThemedText type="defaultSemiBold">Нэвтэрсний дараа мэдэгдлүүд харагдана</ThemedText>
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
            renderItem={({ item }) => <NotifRow item={item} C={C} />}
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
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
