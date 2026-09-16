/**
 * MapPickerField — Зарын байршил сонгох component
 *
 * Website-ийн LocationField.tsx-тай ижил UX:
 *   • MapView дээр дарж pin тавих
 *   • Draggable marker (чирч байршил өөрчлөх)
 *   • MapTiler geocoding хайлт
 *   • "📍 Миний байршил" — device GPS
 *   • onChange(lat, lng) callback
 */

import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

// Улаанбаатарын төв
const UB_CENTER = { latitude: 47.918, longitude: 106.917 };
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

type GeoFeature = {
  id: string;
  place_name: string;
  center?: [number, number];
};

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  onMapFocus?: () => void;
  onMapBlur?: () => void;
};

export default function MapPickerField({ lat, lng, onChange, onMapFocus, onMapBlur }: Props) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];

  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    lat != null && lng != null ? { latitude: lat, longitude: lng } : null,
  );
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  // Parent-аас lat/lng өөрчлөгдвөл pin шинэчлэх
  useEffect(() => {
    if (lat != null && lng != null) {
      // Async-аар ачаалсан parent coordinate-ийг editable local marker-тэй синк хийнэ.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPin({ latitude: lat, longitude: lng });
    }
  }, [lat, lng]);

  // MapTiler geocoding хайлт (debounce 300ms)
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&language=mn`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data?.features ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const handleQueryChange = (value: string) => {
    setQ(value);
    if (!value.trim()) setResults([]);
  };

  const placePin = (latitude: number, longitude: number) => {
    const coord = { latitude, longitude };
    setPin(coord);
    onChange(latitude, longitude);
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      400,
    );
  };

  const pickResult = (f: GeoFeature) => {
    const [lng2, lat2] = f.center ?? [];
    if (lat2 == null || lng2 == null) return;
    placePin(lat2, lng2);
    setQ(f.place_name);
    setResults([]);
  };

  const handleMyLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      placePin(loc.coords.latitude, loc.coords.longitude);
    } catch {}
    setLocLoading(false);
  };

  const handleClear = () => {
    setPin(null);
    setQ('');
    setResults([]);
  };

  return (
    <View style={styles.container}>
      {/* ─── Хайлтын талбар ─── */}
      <View style={styles.searchWrap}>
        <TextInput
          value={q}
          onChangeText={handleQueryChange}
          placeholder="Хот, дүүрэг, гудамж хайх..."
          placeholderTextColor={C.textSecondary}
          style={[styles.searchInput, { borderColor: C.backgroundSelected, color: C.text, backgroundColor: C.background }]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching && (
          <ActivityIndicator style={styles.searchSpinner} size="small" color={C.textSecondary} />
        )}
      </View>

      {/* ─── Geocoding үр дүн ─── */}
      {results.length > 0 && (
        <View style={[styles.resultsList, { backgroundColor: C.background, borderColor: C.backgroundSelected }]}>
          <FlatList
            data={results}
            keyExtractor={(f) => f.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pickResult(item)}
                style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: C.backgroundElement }]}>
                <ThemedText type="small" numberOfLines={2}>{item.place_name}</ThemedText>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* ─── Map ─── */}
      <View
        style={styles.mapWrap}
        onTouchStart={onMapFocus}
        onTouchEnd={onMapBlur}
        onTouchCancel={onMapBlur}>
        <MapView
          ref={mapRef}
          mapType="none"
          style={styles.map}
          initialRegion={{
            ...(pin ?? UB_CENTER),
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            placePin(latitude, longitude);
            setResults([]);
          }}>
          <UrlTile
            urlTemplate={`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
            maximumZ={19}
            flipY={false}
            tileSize={256}
            zIndex={0}
          />
          {pin && (
            <Marker
              coordinate={pin}
              pinColor="#16A34A"
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                placePin(latitude, longitude);
              }}
            />
          )}
        </MapView>

        {/* Map дээр дарах заавар */}
        {!pin && (
          <View style={styles.mapHint} pointerEvents="none">
            <ThemedText type="small" style={styles.mapHintText}>
              📍 Газрын зураг дээр дарж байршил тэмдэглэнэ үү
            </ThemedText>
          </View>
        )}
      </View>

      {/* ─── Товчнууд ─── */}
      <View style={styles.btnRow}>
        <Pressable
          onPress={handleMyLocation}
          disabled={locLoading}
          style={({ pressed }) => [
            styles.btn,
            { borderColor: C.backgroundSelected, backgroundColor: pressed ? C.backgroundElement : C.background },
          ]}>
          {locLoading
            ? <ActivityIndicator size="small" color={C.textSecondary} />
            : <ThemedText type="small">📍 Миний байршил</ThemedText>
          }
        </Pressable>

        {pin && (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.btn,
              { borderColor: C.backgroundSelected, backgroundColor: pressed ? C.backgroundElement : C.background },
            ]}>
            <ThemedText type="small">❌ Цэвэрлэх</ThemedText>
          </Pressable>
        )}
      </View>

      {/* ─── Тэмдэглэгдсэн координат ─── */}
      {pin && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.coordText}>
          📌 {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  searchWrap: { position: 'relative' },
  searchInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingRight: 36,
    fontSize: 15,
  },
  searchSpinner: {
    position: 'absolute',
    right: 10,
    top: 12,
  },
  resultsList: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 200,
    overflow: 'hidden',
  },
  resultItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D7DAE0',
  },
  mapWrap: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7DAE0',
  },
  map: { width: '100%', height: '100%' },
  mapHint: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mapHintText: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    color: '#374151',
    overflow: 'hidden',
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  btn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
  },
  coordText: {
    textAlign: 'center',
  },
});
