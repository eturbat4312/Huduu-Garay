import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { FacebookSignInButton } from '@/components/facebook-sign-in-button';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  fetchFavorites,
  fetchMyBookings,
  resolveMediaUrl,
} from '@/lib/api';

// ─── Үндсэн дэлгэц ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isLoading, isAuthenticated, user, logout } = useAuth();
  const [googleError, setGoogleError] = useState('');
  const [bookingCount, setBookingCount] = useState<number | null>(null);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Статистик татах
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchMyBookings()
      .then((data) => setBookingCount(data.length))
      .catch(() => setBookingCount(0));
    fetchFavorites()
      .then((data) => setFavoriteCount(data.length))
      .catch(() => setFavoriteCount(0));
  }, [isAuthenticated]);

  // ── Ачаалж байна ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Нэвтрээгүй хэрэглэгч ─────────────────────────────────────────────────
  if (!isAuthenticated || !user) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, { paddingBottom: BottomTabInset }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Гарчиг */}
            <Text style={[styles.pageTitle, { color: C.text }]}>Профайл</Text>

            {/* Зочны тавтай морил */}
            <View style={[styles.guestHero, { backgroundColor: C.backgroundElement }]}>
              <View style={[styles.guestAvatar, { backgroundColor: C.backgroundSelected }]}>
                <Text style={{ fontSize: 40 }}>👤</Text>
              </View>
              <Text style={[styles.guestTitle, { color: C.text }]}>Тавтай морил!</Text>
              <Text style={[styles.guestSub, { color: C.textSecondary }]}>
                Нэвтрэн орж захиалга хийх, дуртайдаа нэмэх боломжтой болно.
              </Text>
            </View>

            {/* Товчнууд */}
            <View style={styles.guestButtons}>
              <Pressable
                onPress={() => router.push('/login')}
                style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              >
                <Text style={styles.btnPrimaryText}>Нэвтрэх</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/signup')}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  { borderColor: '#16A34A' },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.btnSecondaryText, { color: '#16A34A' }]}>Бүртгүүлэх</Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: C.backgroundSelected }]} />
                <Text style={[styles.dividerText, { color: C.textSecondary }]}>эсвэл</Text>
                <View style={[styles.dividerLine, { backgroundColor: C.backgroundSelected }]} />
              </View>

              <GoogleSignInButton
                label="Google-ээр нэвтрэх"
                onError={(msg) => setGoogleError(msg)}
              />
              <FacebookSignInButton />
              {googleError ? (
                <Text style={styles.errorText}>{googleError}</Text>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Нэвтэрсэн хэрэглэгч ──────────────────────────────────────────────────
  const avatarUrl = resolveMediaUrl(user.avatar);
  const displayName = user.full_name || user.username;
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hostAppStatus = user.host_application_status;
  const hostStatusLabel: Record<string, string> = {
    pending: '⏳ Хүлээгдэж байна',
    approved: '✅ Баталгаажсан',
    rejected: '❌ Татгалзсан',
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { paddingBottom: BottomTabInset }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── Гарчиг мөр ── */}
          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: C.text }]}>Профайл</Text>
          </View>

          {/* ── Аватар + нэр ── */}
          <View style={styles.heroSection}>
            {/* Аватар */}
            <View style={[styles.avatarWrapper, { backgroundColor: C.backgroundSelected }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>

            {/* Нэр, email */}
            <Text style={[styles.heroName, { color: C.text }]}>{displayName}</Text>
            <Text style={[styles.heroEmail, { color: C.textSecondary }]}>{user.email}</Text>

            {/* Хост badge */}
            {user.is_host && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>🏠 Хост</Text>
              </View>
            )}

            {user.facebook_connected
              ? <Text style={{ color: '#16A34A', marginVertical: 8 }}>✓ Facebook холбогдсон</Text>
              : <FacebookSignInButton intent="connect" />}

            {/* Профайл засах */}
            <Pressable
              onPress={() => router.push('/edit-profile' as never)}
              style={({ pressed }) => [
                styles.editBtn,
                { borderColor: C.backgroundSelected },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.editBtnText, { color: C.text }]}>✏️  Профайл засах</Text>
            </Pressable>
          </View>

          {/* ── Статистик ── */}
          <View style={[styles.statsRow, { backgroundColor: C.backgroundElement }]}>
            <StatBox
              label="Захиалга"
              value={bookingCount}
              icon="🗓"
              color={C.text}
              subColor={C.textSecondary}
            />
            <View style={[styles.statDivider, { backgroundColor: C.backgroundSelected }]} />
            <StatBox
              label="Дуртай"
              value={favoriteCount}
              icon="❤️"
              color={C.text}
              subColor={C.textSecondary}
            />
          </View>

          {/* ── Нэмэлт мэдээлэл ── */}
          {(user.phone || user.bio) ? (
            <View style={[styles.infoCard, { backgroundColor: C.backgroundElement }]}>
              {user.phone ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📞</Text>
                  <Text style={[styles.infoText, { color: C.text }]}>{user.phone}</Text>
                </View>
              ) : null}
              {user.bio ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📝</Text>
                  <Text style={[styles.infoText, { color: C.textSecondary }]}>{user.bio}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Миний хэсэг ── */}
          <MenuSection title="Миний" color={C.textSecondary}>
            <MenuRow
              icon="🗓"
              label="Миний захиалгууд"
              badge={bookingCount ?? undefined}
              color={C.text}
              borderColor={C.backgroundSelected}
              onPress={() => router.push('/(tabs)/bookings' as never)}
            />
            <MenuRow
              icon="❤️"
              label="Дуртай газрууд"
              badge={favoriteCount ?? undefined}
              color={C.text}
              borderColor={C.backgroundSelected}
              onPress={() => router.push('/(tabs)/favorites' as never)}
            />
            <MenuRow
              icon="❓"
              label="Тусламж"
              color={C.text}
              borderColor={C.backgroundSelected}
              onPress={() => router.push('/support' as never)}
              isLast
            />
          </MenuSection>

          {/* ── Хост хэсэг ── */}
          {user.is_host ? (
            <MenuSection title="Хост" color={C.textSecondary}>
              <MenuRow
                icon="➕"
                label="Зар нэмэх"
                color="#16A34A"
                borderColor={C.backgroundSelected}
                onPress={() => router.push('/create-listing' as never)}
              />
              <MenuRow
                icon="🏡"
                label="Миний зарууд"
                color={C.text}
                borderColor={C.backgroundSelected}
                onPress={() => router.push('/my-listings' as never)}
              />
              <MenuRow
                icon="📋"
                label="Хостын захиалгууд"
                color={C.text}
                borderColor={C.backgroundSelected}
                onPress={() => router.push('/host-bookings' as never)}
                isLast
              />
            </MenuSection>
          ) : (
            <MenuSection title="Түрээслүүлэгч болох" color={C.textSecondary}>
              <MenuRow
                icon="✨"
                label={
                  hostAppStatus
                    ? hostStatusLabel[hostAppStatus] ?? 'Өргөдөл илгээсэн'
                    : 'Өргөдөл илгээх'
                }
                color={hostAppStatus === 'pending' ? '#D97706' : C.text}
                borderColor={C.backgroundSelected}
                onPress={() => {
                  router.push('/become-host' as never);
                }}
                isLast
              />
            </MenuSection>
          )}

          {/* ── Гарах ── */}
          <Pressable
            onPress={async () => {
              if (loggingOut) return;
              setLoggingOut(true);
              try { await logout(); }
              finally { setLoggingOut(false); }
            }}
            style={({ pressed }) => [
              styles.logoutBtn,
              { borderColor: C.backgroundSelected },
              pressed && styles.pressed,
            ]}
          >
            {loggingOut ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <Text style={styles.logoutText}>Гарах</Text>
            )}
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Дэд компонентууд ─────────────────────────────────────────────────────────

function StatBox({
  icon, label, value, color, subColor,
}: {
  icon: string; label: string; value: number | null; color: string; subColor: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>
        {value === null ? '—' : value}
      </Text>
      <Text style={[styles.statLabel, { color: subColor }]}>{label}</Text>
    </View>
  );
}

function MenuSection({
  title, children, color,
}: {
  title: string; children: React.ReactNode; color: string;
}) {
  return (
    <View style={styles.menuSection}>
      <Text style={[styles.menuSectionTitle, { color }]}>{title}</Text>
      <View style={styles.menuCard}>{children}</View>
    </View>
  );
}

function MenuRow({
  icon, label, badge, color, borderColor, onPress, isLast = false,
}: {
  icon: string; label: string; badge?: number;
  color: string; borderColor: string;
  onPress: () => void; isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      {badge !== undefined && badge > 0 ? (
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={{ color, fontSize: 18, opacity: 0.4 }}>›</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: Spacing.five },

  // Гарчиг
  pageTitle: { fontSize: 28, fontWeight: '700', marginTop: Spacing.three, marginBottom: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Зочны харагдац
  guestHero: {
    borderRadius: 16, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  guestAvatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  guestTitle: { fontSize: 20, fontWeight: '700' },
  guestSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  guestButtons: { gap: Spacing.two },

  // Товч
  btnPrimary: {
    height: 50, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16A34A',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    height: 50, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 },

  // Хуваагч
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' },

  // Аватар / Hero
  heroSection: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  avatarWrapper: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#16A34A' },
  heroName: { fontSize: 22, fontWeight: '700' },
  heroEmail: { fontSize: 14 },
  hostBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  hostBadgeText: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  editBtn: {
    marginTop: 4, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: Spacing.three, paddingVertical: 8,
  },
  editBtnText: { fontSize: 14, fontWeight: '600' },

  // Статистик
  statsRow: {
    flexDirection: 'row', borderRadius: 16,
    marginBottom: Spacing.three, overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, gap: 2 },
  statDivider: { width: 1, marginVertical: Spacing.three },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12 },

  // Нэмэлт мэдээлэл
  infoCard: {
    borderRadius: 16, padding: Spacing.three,
    gap: Spacing.two, marginBottom: Spacing.three,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  infoIcon: { fontSize: 16, marginTop: 1 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Меню
  menuSection: { marginBottom: Spacing.three },
  menuSectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.one, paddingHorizontal: 4 },
  menuCard: { borderRadius: 16, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.three, paddingVertical: 16,
    gap: Spacing.two,
  },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  badgeWrap: {
    backgroundColor: '#16A34A', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    marginRight: 4,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Гарах
  logoutBtn: {
    height: 52, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  logoutText: { color: '#DC2626', fontSize: 16, fontWeight: '600' },
});
