import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
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

import MapPickerField from '@/components/map-picker-field';
import { Colors, Spacing } from '@/constants/theme';
import {
  deleteListingImage,
  fetchAmenities,
  fetchCategories,
  fetchListing,
  updateListing,
  uploadListingImages,
} from '@/lib/api';
import type { ListingAmenity, ListingCategory, ListingImage } from '@/types/api';

const formatPrice = (value: string) =>
  value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ─── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({
  value, onChange, min = 1, max = 30, color,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; color: string;
}) {
  return (
    <View style={S.stepperRow}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[S.stepBtn, { backgroundColor: value <= min ? '#E5E7EB' : '#16A34A' }]}>
        <Text style={[S.stepBtnText, { color: value <= min ? '#9CA3AF' : '#fff' }]}>−</Text>
      </Pressable>
      <Text style={[S.stepVal, { color }]}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[S.stepBtn, { backgroundColor: value >= max ? '#E5E7EB' : '#16A34A' }]}>
        <Text style={[S.stepBtnText, { color: value >= max ? '#9CA3AF' : '#fff' }]}>＋</Text>
      </Pressable>
    </View>
  );
}

// ─── Үндсэн дэлгэц ───────────────────────────────────────────────────────────
export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const inputBg = scheme === 'dark' ? '#1A1A1A' : '#F9FAFB';
  const borderCol = scheme === 'dark' ? '#374151' : '#D1D5DB';

  // ── Loading state ──
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState('');

  // ── Form fields ──
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

  // ── Category ──
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [catModalVisible, setCatModalVisible] = useState(false);

  // ── Amenities ──
  const [amenityOptions, setAmenityOptions] = useState<ListingAmenity[]>([]);
  const [amenityIds, setAmenityIds] = useState<number[]>([]);

  // ── Images ──
  const [existingImages, setExistingImages] = useState<ListingImage[]>([]);
  const [newImageUris, setNewImageUris] = useState<string[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  // ── Submit ──
  const [submitting, setSubmitting] = useState(false);

  // ── Data load ──
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchListing(id),
      fetchCategories(),
      fetchAmenities(),
    ])
      .then(([listing, cats, amenities]) => {
        // Pre-fill form
        setTitle(listing.title ?? '');
        setDescription(listing.description ?? '');
        setCity(listing.location_city ?? '');
        setDistrict(listing.location_district ?? '');
        setKhoroo(listing.location_khoroo ?? '');
        setExtra(listing.location_extra ?? '');
        setBuilding(listing.location_building ?? '');
        setApartment(listing.location_apartment ?? '');
        setLat(listing.location_lat ?? null);
        setLng(listing.location_lng ?? null);

        const rawPrice = Number(listing.price_per_night ?? 0);
        setPrice(rawPrice > 0 ? formatPrice(String(rawPrice)) : '');
        setBeds(listing.beds ?? 1);
        setMaxGuests(listing.max_guests ?? 1);
        setCategoryId(listing.category?.id ?? null);
        setAmenityIds(listing.amenities?.map((a) => a.id) ?? []);
        setExistingImages(listing.images ?? []);

        setCategories(cats);
        setAmenityOptions(amenities);
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : 'Мэдээлэл татахад алдаа гарлаа.');
      })
      .finally(() => setInitializing(false));
  }, [id]);

  // ── Helpers ──
  const plainPrice = Number(price.replace(/,/g, ''));

  const toggleAmenity = (aid: number) =>
    setAmenityIds((prev) =>
      prev.includes(aid) ? prev.filter((x) => x !== aid) : [...prev, aid],
    );

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Зөвшөөрөл', 'Зургийн сан руу хандах зөвшөөрөл шаардлагатай.');
      return;
    }
    const maxNew = 6 - existingImages.length - newImageUris.length;
    if (maxNew <= 0) {
      Alert.alert('Хязгаар', 'Нийт 6 хүртэл зураг байршуулж болно.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: maxNew,
    });
    if (result.canceled) return;
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validAssets = result.assets.filter((a) => !a.mimeType || ALLOWED_TYPES.includes(a.mimeType));
    if (validAssets.length < result.assets.length) {
      Alert.alert('Зөвшөөрөгдсөн формат', 'Зөвхөн JPEG, PNG, WebP зураг оруулна уу.');
    }
    setNewImageUris((prev) => [...prev, ...validAssets.map((a) => a.uri)].slice(0, 6));
  };

  const handleDeleteExistingImage = async (img: ListingImage) => {
    Alert.alert('Зураг устгах', 'Энэ зургийг устгах уу?', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах', style: 'destructive',
        onPress: async () => {
          setDeletingImageId(img.id);
          try {
            await deleteListingImage(img.id);
            setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
          } catch {
            Alert.alert('Алдаа', 'Зураг устгахад алдаа гарлаа.');
          } finally {
            setDeletingImageId(null);
          }
        },
      },
    ]);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Алдаа', 'Гарчиг оруулна уу.');
    if (!description.trim()) return Alert.alert('Алдаа', 'Тайлбар оруулна уу.');
    if (!city.trim() || !district.trim()) return Alert.alert('Алдаа', 'Хот/Аймаг болон Дүүрэг/Сум заавал бөглөнө үү.');
    if (!categoryId) return Alert.alert('Алдаа', 'Ангилал сонгоно уу.');
    if (!plainPrice || plainPrice <= 0) return Alert.alert('Алдаа', 'Зөв үнэ оруулна уу.');
    if (lat == null || lng == null) return Alert.alert('Алдаа', 'Газрын зураг дээр байршлаа тэмдэглэнэ үү.');

    setSubmitting(true);
    try {
      await updateListing(id!, {
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
        amenity_ids: amenityIds.length > 0 ? amenityIds : [],
      });

      if (newImageUris.length > 0) {
        await uploadListingImages(Number(id), newImageUris);
      }

      Alert.alert('✅ Амжилттай', 'Зар амжилттай шинэчлэгдлээ.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Алдаа', e.message ?? 'Зар шинэчлэхэд алдаа гарлаа.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const inp = [S.input, { backgroundColor: inputBg, borderColor: borderCol, color: C.text }];

  // ── Loading / error ──
  if (initializing) {
    return (
      <SafeAreaView style={[S.safe, { backgroundColor: C.background }]}>
        <View style={S.center}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={{ color: C.textSecondary, marginTop: 8 }}>Ачааллаж байна...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (initError) {
    return (
      <SafeAreaView style={[S.safe, { backgroundColor: C.background }]}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Text style={[S.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
        </Pressable>
        <View style={S.center}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
          <Text style={{ color: C.text, fontWeight: '600' }}>{initError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: C.background }]}>
      {/* ── Header ── */}
      <View style={[S.header, { borderBottomColor: borderCol }]}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Text style={[S.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
        </Pressable>
        <Text style={[S.headerTitle, { color: C.text }]}>Зар засах</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}>

        {/* ── Үндсэн мэдээлэл ── */}
        <View style={[S.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[S.sectionTitle, { color: C.text }]}>📄 Үндсэн мэдээлэл</Text>

          <Text style={[S.label, { color: C.textSecondary }]}>Гарчиг *</Text>
          <TextInput
            style={inp} value={title} onChangeText={setTitle}
            placeholder="Тухтай 2 өрөө байр" placeholderTextColor={C.textSecondary}
          />

          <Text style={[S.label, { color: C.textSecondary }]}>Тайлбар *</Text>
          <TextInput
            style={[...inp, S.textarea]} value={description} onChangeText={setDescription}
            placeholder="Байрны дэлгэрэнгүй тайлбар..." placeholderTextColor={C.textSecondary}
            multiline numberOfLines={4} textAlignVertical="top"
          />
        </View>

        {/* ── Байршил ── */}
        <View style={[S.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[S.sectionTitle, { color: C.text }]}>📍 Байршил</Text>

          <View style={S.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[S.label, { color: C.textSecondary }]}>Хот / Аймаг *</Text>
              <TextInput style={inp} value={city} onChangeText={setCity} placeholder="Улаанбаатар" placeholderTextColor={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.label, { color: C.textSecondary }]}>Дүүрэг / Сум *</Text>
              <TextInput style={inp} value={district} onChangeText={setDistrict} placeholder="Хан-Уул" placeholderTextColor={C.textSecondary} />
            </View>
          </View>

          <View style={S.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[S.label, { color: C.textSecondary }]}>Хороо / Баг</Text>
              <TextInput style={inp} value={khoroo} onChangeText={setKhoroo} placeholder="11-р хороо" placeholderTextColor={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.label, { color: C.textSecondary }]}>Хороолол / Нэмэлт</Text>
              <TextInput style={inp} value={extra} onChangeText={setExtra} placeholder="Нарны тойрог" placeholderTextColor={C.textSecondary} />
            </View>
          </View>

          <Text style={[S.label, { color: C.textSecondary }]}>Газрын зураг дээр байршил тэмдэглэх</Text>
          <MapPickerField
            lat={lat}
            lng={lng}
            onChange={(la, lo) => { setLat(la); setLng(lo); }}
            onMapFocus={() => setScrollEnabled(false)}
            onMapBlur={() => setScrollEnabled(true)}
          />

          <View style={[S.privateBox, { backgroundColor: scheme === 'dark' ? '#1A2700' : '#FEFCE8', borderColor: '#A16207' }]}>
            <Text style={{ color: '#A16207', fontWeight: '600', fontSize: 13, marginBottom: 6 }}>
              🔒 Захиалсны дараа харагдах
            </Text>
            <Text style={[S.label, { color: C.textSecondary }]}>Байр / Хаяг</Text>
            <TextInput style={inp} value={building} onChangeText={setBuilding} placeholder="15-р байр" placeholderTextColor={C.textSecondary} />
            <Text style={[S.label, { color: C.textSecondary }]}>Тоот</Text>
            <TextInput style={inp} value={apartment} onChangeText={setApartment} placeholder="42" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
          </View>
        </View>

        {/* ── Дэлгэрэнгүй ── */}
        <View style={[S.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[S.sectionTitle, { color: C.text }]}>🛏 Дэлгэрэнгүй</Text>

          <View style={S.stepperLine}>
            <Text style={[S.stepperLabel, { color: C.text }]}>Орны тоо</Text>
            <Stepper value={beds} onChange={setBeds} min={1} max={20} color={C.text} />
          </View>
          <View style={[S.separator, { backgroundColor: borderCol }]} />
          <View style={S.stepperLine}>
            <Text style={[S.stepperLabel, { color: C.text }]}>Зочдын тоо</Text>
            <Stepper value={maxGuests} onChange={setMaxGuests} min={1} max={30} color={C.text} />
          </View>
          <View style={[S.separator, { backgroundColor: borderCol }]} />

          {/* Ангилал */}
          <Text style={[S.label, { color: C.textSecondary, marginTop: Spacing.two }]}>Ангилал *</Text>
          <Pressable
            onPress={() => setCatModalVisible(true)}
            style={[S.selectBtn, { backgroundColor: inputBg, borderColor: borderCol }]}>
            <Text style={{ color: selectedCategory ? C.text : C.textSecondary, fontSize: 15 }}>
              {selectedCategory ? `${selectedCategory.icon ?? ''} ${selectedCategory.name}`.trim() : 'Ангилал сонгох...'}
            </Text>
            <Text style={{ color: C.textSecondary }}>›</Text>
          </Pressable>

          {/* Amenities */}
          {amenityOptions.length > 0 && (
            <>
              <Text style={[S.label, { color: C.textSecondary, marginTop: Spacing.three }]}>Тохиромж</Text>
              <View style={S.amenityGrid}>
                {amenityOptions.map((a) => {
                  const active = amenityIds.includes(a.id);
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => toggleAmenity(a.id)}
                      style={[
                        S.amenityChip,
                        { borderColor: active ? '#16A34A' : borderCol, backgroundColor: active ? '#DCFCE7' : inputBg },
                      ]}>
                      <Text style={{ fontSize: 13, color: active ? '#166534' : C.text }}>{a.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* ── Үнэ ── */}
        <View style={[S.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[S.sectionTitle, { color: C.text }]}>💰 Үнэ</Text>
          <Text style={[S.label, { color: C.textSecondary }]}>1 шөнийн үнэ (₮) *</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Text style={{ fontSize: 20, color: C.text }}>₮</Text>
            <TextInput
              style={[...inp, { flex: 1 }]}
              value={price}
              onChangeText={(v) => setPrice(formatPrice(v))}
              keyboardType="numeric"
              placeholder="150,000"
              placeholderTextColor={C.textSecondary}
            />
          </View>
        </View>

        {/* ── Зурагнууд ── */}
        <View style={[S.section, { backgroundColor: C.backgroundElement }]}>
          <Text style={[S.sectionTitle, { color: C.text }]}>📸 Зурагнууд</Text>

          {/* Одоо байгаа зурагнууд */}
          {existingImages.length > 0 && (
            <>
              <Text style={[S.label, { color: C.textSecondary }]}>Одоогийн зурагнууд</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: Spacing.two, paddingBottom: 4 }}>
                  {existingImages.map((img) => {
                    const uri = img.image.startsWith('http') ? img.image : `${img.image}`;
                    return (
                      <View key={img.id} style={S.imageWrap}>
                        <Image source={{ uri }} style={S.imageThumb} />
                        <Pressable
                          onPress={() => handleDeleteExistingImage(img)}
                          disabled={deletingImageId === img.id}
                          style={S.imageDeleteBtn}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                            {deletingImageId === img.id ? '...' : '✕'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}

          {/* Шинэ зурагнууд */}
          {newImageUris.length > 0 && (
            <>
              <Text style={[S.label, { color: C.textSecondary, marginTop: Spacing.two }]}>
                Нэмэх зурагнууд ({newImageUris.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: Spacing.two, paddingBottom: 4 }}>
                  {newImageUris.map((uri, i) => (
                    <View key={i} style={S.imageWrap}>
                      <Image source={{ uri }} style={S.imageThumb} />
                      <Pressable
                        onPress={() => setNewImageUris((prev) => prev.filter((_, idx) => idx !== i))}
                        style={S.imageDeleteBtn}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {existingImages.length + newImageUris.length < 6 && (
            <Pressable
              onPress={pickImages}
              style={[S.addImageBtn, { borderColor: borderCol, backgroundColor: inputBg }]}>
              <Text style={{ fontSize: 28 }}>📷</Text>
              <Text style={{ color: C.textSecondary, fontSize: 13 }}>
                Зураг нэмэх ({existingImages.length + newImageUris.length}/6)
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Submit ── */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            S.submitBtn,
            (pressed || submitting) && { opacity: 0.7 },
          ]}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={S.submitBtnText}>✅ Хадгалах</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* ── Category modal ── */}
      <Modal visible={catModalVisible} animationType="slide" transparent>
        <View style={S.modalOverlay}>
          <View style={[S.modalBox, { backgroundColor: C.background }]}>
            <Text style={[S.modalTitle, { color: C.text }]}>Ангилал сонгох</Text>
            <ScrollView>
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => { setCategoryId(cat.id); setCatModalVisible(false); }}
                  style={[
                    S.modalItem,
                    { borderBottomColor: borderCol },
                    categoryId === cat.id && { backgroundColor: '#DCFCE7' },
                  ]}>
                  <Text style={{ fontSize: 22 }}>{cat.icon ?? '🏠'}</Text>
                  <Text style={[S.modalItemText, { color: C.text }]}>{cat.name}</Text>
                  {categoryId === cat.id && <Text style={{ color: '#16A34A' }}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setCatModalVisible(false)} style={S.modalClose}>
              <Text style={S.modalCloseText}>Болих</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 64 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },
  section: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.one },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  input: {
    minHeight: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: Spacing.three, fontSize: 15,
  },
  textarea: { minHeight: 100, paddingTop: Spacing.two },
  row2: { flexDirection: 'row', gap: Spacing.two },
  privateBox: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  stepperLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two },
  stepperLabel: { fontSize: 15, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  stepVal: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  selectBtn: {
    minHeight: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: Spacing.three, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  amenityChip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addImageBtn: {
    minHeight: 80, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.one, marginTop: Spacing.two,
  },
  imageWrap: { position: 'relative' },
  imageThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#DDE7DF' },
  imageDeleteBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtn: {
    minHeight: 54, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: '#16A34A',
    marginTop: Spacing.two,
  },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.three },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalItemText: { flex: 1, fontSize: 16 },
  modalClose: {
    marginTop: Spacing.three, alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14,
  },
  modalCloseText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
