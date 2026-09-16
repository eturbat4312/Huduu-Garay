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

export default function TermsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: C.backgroundSelected }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.text }]}>Үйлчилгээний нөхцөл</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: C.text }]}>Үйлчилгээний нөхцөл ба Нууцлалын бодлого</Text>
          <Text style={[styles.date, { color: C.textSecondary }]}>Сүүлийн шинэчлэл: 2025 оны 1-р сар</Text>

          <Section title="1. Ерөнхий заалтууд" color={C.text} secondaryColor={C.textSecondary}>
            Тanaid Honoy платформыг ашигласнаар та энэхүү үйлчилгээний нөхцөлийг бүрэн зөвшөөрсөнд тооцогдоно. Хэрэв та нөхцөлтэй санал нийлэхгүй бол платформыг ашиглахгүй байхыг хүсье.
          </Section>

          <Section title="2. Хэрэглэгчийн эрх үүрэг" color={C.text} secondaryColor={C.textSecondary}>
            Хэрэглэгч нь бодит мэдээлэл оруулах, бусад хэрэглэгчдэд хүндэтгэлтэй хандах үүрэгтэй. Хуурамч мэдээлэл оруулах, платформыг буруугаар ашиглах нь бүртгэлийг хаах үндэслэл болно.
          </Section>

          <Section title="3. Захиалга ба Төлбөр" color={C.text} secondaryColor={C.textSecondary}>
            Захиалга хийх үед нийт дүнгийн 10% үйлчилгээний хураамж нэмэгдэнэ. Захиалгыг цуцлах нөхцөл нь зарын нөхцлөөс хамаарна. QPay системээр баталгаажсан захиалга буцааж татах боломжгүй.
          </Section>

          <Section title="4. Хостын хариуцлага" color={C.text} secondaryColor={C.textSecondary}>
            Хост нь байрны талаар үнэн зөв мэдээлэл оруулах, захиалагдсан хугацаанд байрыг боломжтой байлгах үүрэгтэй. Хуурамч зар, буруу зургаар хэрэглэгчийг төөрөгдүүлэхийг хориглоно.
          </Section>

          <Section title="5. Нууцлал" color={C.text} secondaryColor={C.textSecondary}>
            Таны хувийн мэдээлэл нь зөвхөн платформын үйл ажиллагаанд ашиглагдана. Гуравдагч этгээдэд дамжуулахгүй. Дэлгэрэнгүй мэдээллийг нууцлалын бодлогоос харна уу.
          </Section>

          <Section title="6. Маргаан шийдвэрлэх" color={C.text} secondaryColor={C.textSecondary}>
            Хэрэглэгч болон хостын хооронд маргаан гарвал платформын дэмжлэгийн баг зуучлагч үүрэг гүйцэтгэнэ. tanaid.honoy1@gmail.com хаягаар холбогдоно уу.
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
