import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';

export default function HostTermsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: C.backgroundSelected }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.text }]}>Хостын нөхцөл</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: C.text }]}>Хостын үйлчилгээний нөхцөл</Text>
          <Text style={[styles.date, { color: C.textSecondary }]}>Сүүлийн шинэчлэл: 2025 оны 1-р сар</Text>

          <Section title="1. Хост болох шаардлага" color={C.text} secondaryColor={C.textSecondary}>
            Хост болохын тулд та үнэн зөв мэдээлэл, иргэний үнэмлэхийн зураг болон өөрийн зургийг оруулан хүсэлт гаргана. Манай баг таны мэдээллийг шалгаж, 3-5 ажлын өдрийн дотор шийдвэрлэнэ.
          </Section>

          <Section title="2. Зар байршуулах дүрэм" color={C.text} secondaryColor={C.textSecondary}>
            Байр нь аюулгүй, цэвэр, зарын тайлбартай тохирсон байх ёстой. Хуурамч зураг, буруу байршил, бодит байдлаас ялгаатай мэдээлэл оруулахыг хориглоно.
          </Section>

          <Section title="3. Захиалгын хариуцлага" color={C.text} secondaryColor={C.textSecondary}>
            Хост нь баталгаажсан захиалгыг дур мэдэн цуцлахгүй байх үүрэгтэй. Цуцласан тохиолдолд зочид нэн даруй мэдэгдэх шаардлагатай бөгөөд энэ нь хостын үнэлгээнд нөлөөлнө.
          </Section>

          <Section title="4. Орлого ба комисс" color={C.text} secondaryColor={C.textSecondary}>
            Хост нь зарыг үнийн 90%-ийг авна (10% нь платформын үйлчилгээний хураамж). Орлогыг банкны дансанд шилжүүлэх хугацаа захиалга дуусснаас хойш 1-3 ажлын өдөр байна.
          </Section>

          <Section title="5. Хориглох зүйлс" color={C.text} secondaryColor={C.textSecondary}>
            Дараах зүйлийг хориглоно: хуурамч зар байршуулах, зочдоос нэмэлт хураамж авах, бичиг баримтгүй байр түрээслүүлэх, насанд хүрэгчдийн контент.
          </Section>

          <Section title="6. Платформын эрх" color={C.text} secondaryColor={C.textSecondary}>
            Дүрэм зөрчсөн тохиолдолд платформ нь зарыг идэвхгүй болгох, хостын эрхийг цуцлах эрхтэй. Мэдэгдэл болон гомдлыг tanaid.honoy1@gmail.com хаягаар хүлээн авна.
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, color, secondaryColor, children }: {
  title: string; color: string; secondaryColor: string; children: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: secondaryColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { minWidth: 64 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  date: { fontSize: 13, marginTop: -8 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionBody: { fontSize: 14, lineHeight: 22 },
});
