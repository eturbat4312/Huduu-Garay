import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';

export default function BookingSuccessScreen() {
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={[styles.title, { color: C.text }]}>Захиалга амжилттай!</Text>
          <Text style={[styles.sub, { color: C.textSecondary }]}>
            Таны захиалга баталгаажлаа. Түрээслүүлэгчийн холбоо барих мэдээллийг захиалгын дэлгэрэнгүйгээс харна уу.
          </Text>

          {booking_id && (
            <Pressable
              onPress={() => router.replace(`/booking/${booking_id}` as never)}
              style={styles.btn}>
              <Text style={styles.btnText}>Захиалгын дэлгэрэнгүй харах</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.replace('/(tabs)/bookings' as never)}
            style={[styles.btn, styles.secondaryBtn]}>
            <Text style={[styles.btnText, { color: C.text }]}>Бүх захиалгууд</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(tabs)/' as never)}
            style={styles.homeLink}>
            <Text style={[styles.homeLinkText, { color: C.textSecondary }]}>Нүүр хуудас →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.four, gap: Spacing.three,
  },
  emoji: { fontSize: 72 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: {
    width: '100%', backgroundColor: '#16A34A', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#D1D5DB' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  homeLink: { marginTop: 4 },
  homeLinkText: { fontSize: 14 },
});
