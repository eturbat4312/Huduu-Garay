import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import {
  createAvailabilityBulk,
  createListing,
  fetchAmenities,
  fetchCategories,
  uploadListingImages,
  type ListingCreatePayload,
} from '@/lib/api';
import type { ListingAmenity, ListingCategory } from '@/types/api';
import MapPickerField from '@/components/map-picker-field';

// ─── Stepper компонент ────────────────────────────────────────────────────────
function Stepper({
  value,
  onChange,
  min = 1,
  max = 30,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  color: string;
}) {
  return (
    <View style={stepperStyles.row}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[stepperStyles.btn, { backgroundColor: value <= min ? '#E5E7EB' : '#16A34A' }]}>
        <Text style={[stepperStyles.btnText, { color: value <= min ? '#9CA3AF' : '#fff' }]}>−</Text>
      </Pressable>
      <Text style={[stepperStyles.val, { color }]}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[stepperStyles.btn, { backgroundColor: value >= max ? '#E5E7EB' : '#16A34A' }]}>
        <Text style={[stepperStyles.btnText, { color: value >= max ? '#9CA3AF' : '#fff' }]}>＋</Text>
      </Pressable>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  val: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
});

// ─── Энгийн Calendar компонент ────────────────────────────────────────────────
function MonthCalendar({
  year,
  month,
  selected,
  onToggle,
  textColor,
  bgSelected,
}: {
  year: number;
  month: number;
  selected: Set<string>;
  onToggle: (d: string) => void;
  textColor: string;
  bgSelected: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthNames = [
    '1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
    '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар',
  ];

  return (
    <View>
      <Text style={{ color: textColor, fontWeight: '700', marginBottom: 8, fontSize: 15 }}>
        {year} · {monthNames[month]}
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {['Да','Мя','Лх','Пү','Ба','Бя','Ня'].map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>{d}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={{ width: `${100 / 7}%` }} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dateObj = new Date(year, month, day);
          const isPast = dateObj < today;
          const isSel = selected.has(dateStr);
          return (
            <Pressable
              key={dateStr}
              disabled={isPast}
              onPress={() => onToggle(dateStr)}
              style={{
                width: `${100 / 7}%`,
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 2,
              }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSel ? '#16A34A' : 'transparent',
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isSel ? '700' : '400',
                    color: isPast ? '#D1D5DB' : isSel ? '#fff' : textColor,
                  }}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Үндсэн хуудас ────────────────────────────────────────────────────────────
export default function CreateListingScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const inputBg = scheme === 'dark' ? '#1A1A1A' : '#F9FAFB';
  const borderCol = scheme === 'dark' ? '#374151' : '#D1D5DB';

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [khoroo, setKhoroo] = useState('');
  const [extra, setExtra] = useState('');
  const [building, setBuilding] = useState('');
  const [apartment, setApartment] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [price, setPrice] = useState('');
  const [beds, setBeds] = useState(1);
  const [maxGuests, setMaxGuests] = useState(1);

  // ─── Category ───────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [catModalVisible, setCatModalVisible] = useState(false);

  // ─── Amenities ───────────────────────────────────────────────────────────────
  const [amenityOptions, setAmenityOptions] = useState<ListingAmenity[]>([]);
  const [amenityIds, setAmenityIds] = useState<number[]>([]);

  // ─── Images ─────────────────────────────────────────────────────────────────
  const [imageUris, setImageUris] = useState<string[]>([]);

  // ─── Available dates ─────────────────────────────────────────────────────────
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // ─── Submit ──────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!categoryId) {
      return;
    }

    let active = true;
    fetchAmenities(categoryId)
      .then((options) => {
        if (!active) return;
        setAmenityOptions(options);
        const allowedIds = new Set(options.map((option) => option.id));
        setAmenityIds((current) => current.filter((id) => allowedIds.has(id)));
      })
      .catch(() => {
        if (active) setAmenityOptions([]);
      });

    return () => {
      active = false;
    };
  }, [categoryId]);

  const amenityGroups = [
    {
      key: 'amenity',
      label: 'Тохижилт, үйлчилгээ',
      options: amenityOptions.filter((option) => option.amenity_type === 'amenity'),
    },
    {
      key: 'activity',
      label: 'Үйл ажиллагаа',
      options: amenityOptions.filter((option) => option.amenity_type === 'activity'),
    },
  ].filter((group) => group.options.length > 0);

  // ─── Image picker ─────────────────────────────────────────────────────────────
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Зөвшөөрөл', 'Зургийн сан руу хандах зөвшөөрөл шаардлагатай.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6 - imageUris.length,
    });
    if (result.canceled) return;
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validAssets = result.assets.filter((a) => !a.mimeType || ALLOWED_TYPES.includes(a.mimeType));
    if (validAssets.length < result.assets.length) {
      Alert.alert('Зөвшөөрөгдсөн формат', 'Зөвхөн JPEG, PNG, WebP зураг оруулна уу.');
    }
    setImageUris((prev) => [...prev, ...validAssets.map((a) => a.uri)].slice(0, 6));
  };

  // ─── Toggle amenity ──────────────────────────────────────────────────────────
  const toggleAmenity = (id: number) => {
    setAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ─── Toggle date ─────────────────────────────────────────────────────────────
  const toggleDate = (d: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  // ─── Price format ────────────────────────────────────────────────────────────
  const formatPrice = (val: string) =>
    val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const plainPrice = Number(price.replace(/,/g, ''));

  // ─── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Алдаа', 'Гарчиг оруулна уу.');
    if (!description.trim()) return Alert.alert('Алдаа', 'Тайлбар оруулна уу.');
    if (!city.trim() || !district.trim()) return Alert.alert('Алдаа', 'Хот/Аймаг болон Дүүрэг/Сум заавал бөглөнө үү.');
    if (!categoryId) return Alert.alert('Алдаа', 'Ангилал сонгоно уу.');
    if (!plainPrice || plainPrice <= 0) return Alert.alert('Алдаа', 'Зөв үнэ оруулна уу.');
    if (lat == null || lng == null) return Alert.alert('Алдаа', 'Газрын зураг дээр байршлаа тэмдэглэнэ үү.');

    setSubmitting(true);
    try {
      const payload: ListingCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        location_city: city.trim(),
        location_district: district.trim(),
        location_khoroo: khoroo.trim() || undefined,
        location_extra: extra.trim() || undefined,
        location_building: building.trim() || undefined,
        location_apartment: apartment.trim() || undefined,
        location_lat: lat ?? undefined,
        location_lng: lng ?? undefined,
        price_per_night: plainPrice,
        beds,
        max_guests: maxGuests,
        category_id: categoryId,
        amenity_ids: amenityIds.length > 0 ? amenityIds : undefined,
      };

      const listing = await createListing(payload);

      if (imageUris.length > 0) {
        await uploadListingImages(listing.id, imageUris);
      }

      const dates = Array.from(selectedDates);
      if (dates.length > 0) {
        await createAvailabilityBulk(listing.id, dates);
      }

      Alert.alert(
        'Амжилттай илгээлээ',
        `"${listing.title}" зар админы хяналтад орлоо. Батлагдсаны дараа нийтэд харагдана.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Алдаа', e.message ?? 'Зар үүсгэхэд алдаа гарлаа.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const inp = [styles.input, { backgroundColor: inputBg, borderColor: borderCol, color: C.text }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderCol }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.text }]}>Зар нэмэх</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}>

        {/* ── Үндсэн мэдээлэл ── */}
        <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>📄 Үндсэн мэдээлэл</Text>

          <Text style={[styles.label, { color: C.textSecondary }]}>Гарчиг *</Text>
          <TextInput
            style={inp}
            placeholder="Тухтай 2 өрөө байр Баянгол дүүрэгт"
            placeholderTextColor={C.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />

          <Text style={[styles.label, { color: C.textSecondary }]}>Тайлбар *</Text>
          <TextInput
            style={[...inp, styles.textarea]}
            placeholder="Байрны тухай дэлгэрэнгүй мэдээлэл..."
            placeholderTextColor={C.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={[styles.label, { color: C.textSecondary }]}>Шөнийн үнэ (₮) *</Text>
          <TextInput
            style={inp}
            placeholder="80,000"
            placeholderTextColor={C.textSecondary}
            value={price}
            onChangeText={(t) => setPrice(formatPrice(t))}
            keyboardType="numeric"
          />
        </View>

        {/* ── Байршил ── */}
        <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>📍 Байршил</Text>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Хот / Аймаг *</Text>
              <TextInput
                style={inp}
                placeholder="Улаанбаатар"
                placeholderTextColor={C.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Дүүрэг / Сум *</Text>
              <TextInput
                style={inp}
                placeholder="Хан-Уул"
                placeholderTextColor={C.textSecondary}
                value={district}
                onChangeText={setDistrict}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Хороо / Баг</Text>
              <TextInput
                style={inp}
                placeholder="11-р хороо"
                placeholderTextColor={C.textSecondary}
                value={khoroo}
                onChangeText={setKhoroo}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Хороолол / Нэмэлт</Text>
              <TextInput
                style={inp}
                placeholder="Нарны тойрог"
                placeholderTextColor={C.textSecondary}
                value={extra}
                onChangeText={setExtra}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: C.textSecondary }]}>Газрын зураг дээр байршил тэмдэглэх</Text>
          <MapPickerField
            lat={lat}
            lng={lng}
            onChange={(la, lo) => { setLat(la); setLng(lo); }}
            onMapFocus={() => setScrollEnabled(false)}
            onMapBlur={() => setScrollEnabled(true)}
          />

          <View style={[styles.privateBox, { backgroundColor: scheme === 'dark' ? '#1A2700' : '#FEFCE8', borderColor: '#A16207' }]}>
            <Text style={{ color: '#A16207', fontWeight: '600', fontSize: 13, marginBottom: 6 }}>
              🔒 Захиалсны дараа харагдах
            </Text>
            <Text style={[styles.label, { color: C.textSecondary }]}>Байр / Хаяг</Text>
            <TextInput
              style={inp}
              placeholder="15-р байр"
              placeholderTextColor={C.textSecondary}
              value={building}
              onChangeText={setBuilding}
            />
            <Text style={[styles.label, { color: C.textSecondary }]}>Тоот</Text>
            <TextInput
              style={inp}
              placeholder="42"
              placeholderTextColor={C.textSecondary}
              value={apartment}
              onChangeText={setApartment}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ── Дэлгэрэнгүй ── */}
        <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>🛏 Дэлгэрэнгүй</Text>

          <View style={styles.stepperRow}>
            <Text style={[styles.stepperLabel, { color: C.text }]}>Орны тоо</Text>
            <Stepper value={beds} onChange={setBeds} min={1} max={20} color={C.text} />
          </View>

          <View style={[styles.separator, { backgroundColor: borderCol }]} />

          <View style={styles.stepperRow}>
            <Text style={[styles.stepperLabel, { color: C.text }]}>Зочдын тоо</Text>
            <Stepper value={maxGuests} onChange={setMaxGuests} min={1} max={30} color={C.text} />
          </View>

          <View style={[styles.separator, { backgroundColor: borderCol }]} />

          {/* Ангилал */}
          <Text style={[styles.label, { color: C.textSecondary, marginTop: Spacing.two }]}>Ангилал *</Text>
          <Pressable
            onPress={() => setCatModalVisible(true)}
            style={[styles.selectBtn, { backgroundColor: inputBg, borderColor: borderCol }]}>
            <Text style={{ color: selectedCategory ? C.text : C.textSecondary, fontSize: 15 }}>
              {selectedCategory ? selectedCategory.name : 'Ангилал сонгох...'}
            </Text>
            <Text style={{ color: C.textSecondary }}>›</Text>
          </Pressable>
        </View>

        {/* ── Тохижилт ба үйл ажиллагаа ── */}
        {amenityOptions.length > 0 && (
          <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Тохижилт ба үйл ажиллагаа</Text>
            {amenityGroups.map((group) => (
              <View key={group.key} style={styles.amenityGroup}>
                <Text style={[styles.amenityGroupTitle, { color: C.textSecondary }]}>
                  {group.label}
                </Text>
                <View style={styles.amenityGrid}>
                  {group.options.map((option) => {
                    const selected = amenityIds.includes(option.id);
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => toggleAmenity(option.id)}
                        style={[
                          styles.amenityChip,
                          {
                            backgroundColor: selected ? '#16A34A' : inputBg,
                            borderColor: selected ? '#16A34A' : borderCol,
                          },
                        ]}>
                        <Text style={{ color: selected ? '#fff' : C.text, fontSize: 13 }}>
                          {option.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Зурагнууд ── */}
        <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>🖼 Зурагнууд</Text>
          <Text style={[styles.sublabel, { color: C.textSecondary }]}>Хамгийн ихдээ 6 зураг оруулах боломжтой.</Text>

          {imageUris.length < 6 && (
            <Pressable onPress={pickImages} style={[styles.addImageBtn, { borderColor: borderCol }]}>
              <Text style={{ fontSize: 28, color: '#16A34A' }}>＋</Text>
              <Text style={[styles.addImageText, { color: C.textSecondary }]}>Зураг нэмэх</Text>
            </Pressable>
          )}

          {imageUris.length > 0 && (
            <View style={styles.imageGrid}>
              {imageUris.map((uri, i) => (
                <View key={uri + i} style={styles.imageWrap}>
                  <Image source={{ uri }} style={styles.imageThumb} />
                  <Pressable
                    onPress={() => setImageUris((prev) => prev.filter((_, idx) => idx !== i))}
                    style={styles.removeImageBtn}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Боломжит огнооны хуваарь ── */}
        <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>📅 Боломжит огнооны хуваарь</Text>
          <Text style={[styles.sublabel, { color: C.textSecondary }]}>
            Зочдод захиалах боломжтой өдрүүдийг сонгоно уу. ({selectedDates.size} өдөр сонгосон)
          </Text>

          <View style={styles.calNav}>
            <Pressable onPress={prevMonth} style={styles.calNavBtn}>
              <Text style={{ color: C.text, fontSize: 18 }}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={nextMonth} style={styles.calNavBtn}>
              <Text style={{ color: C.text, fontSize: 18 }}>›</Text>
            </Pressable>
          </View>

          <MonthCalendar
            year={calYear}
            month={calMonth}
            selected={selectedDates}
            onToggle={toggleDate}
            textColor={C.text}
            bgSelected={C.backgroundSelected}
          />
        </View>

        {/* ── Submit ── */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitBtn, { opacity: submitting ? 0.6 : 1 }]}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>🚀 Зар нийтлэх</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Category Modal */}
      <Modal
        visible={catModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCatModalVisible(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: C.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: borderCol }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Ангилал сонгох</Text>
            <Pressable onPress={() => setCatModalVisible(false)}>
              <Text style={{ color: '#16A34A', fontSize: 16 }}>Хаах</Text>
            </Pressable>
          </View>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => {
                setCategoryId(cat.id);
                setAmenityOptions([]);
                setAmenityIds([]);
                setCatModalVisible(false);
              }}
              style={[
                styles.catItem,
                {
                  backgroundColor: categoryId === cat.id ? '#DCFCE7' : C.background,
                  borderBottomColor: borderCol,
                },
              ]}>
              <Text style={{ color: C.text, fontSize: 16 }}>{cat.name}</Text>
              {categoryId === cat.id && <Text style={{ color: '#16A34A' }}>✓</Text>}
            </Pressable>
          ))}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  backBtn: { width: 64 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 40 },

  section: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.one },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sublabel: { fontSize: 12, marginBottom: Spacing.two },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: Spacing.two,
  },
  textarea: { height: 100, textAlignVertical: 'top' },

  row2: { flexDirection: 'row', gap: Spacing.two },

  privateBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    marginTop: Spacing.one,
  },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  stepperLabel: { fontSize: 15, fontWeight: '600' },
  separator: { height: 1, marginVertical: Spacing.one },

  selectBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  amenityGroup: { gap: Spacing.one, marginTop: Spacing.one },
  amenityGroupTitle: { fontSize: 13, fontWeight: '700' },
  amenityChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  addImageBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  addImageText: { fontSize: 14 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  imageWrap: { position: 'relative' },
  imageThumb: { width: 96, height: 96, borderRadius: 10 },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calNav: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  calNavBtn: { padding: Spacing.two },

  submitBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
});
