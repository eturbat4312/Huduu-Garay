import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { hostCancelBooking } from '@/lib/api';
import type { BookingDetail } from '@/types/api';

export function HostCancellationAction({ booking, onChange }: {
  booking: BookingDetail;
  onChange: (booking: BookingDetail) => void;
}) {
  const C = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const cancellation = booking.host_cancellation;

  async function cancelBooking() {
    if (!accepted || !reason.trim() || !cancellation?.allowed || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      onChange(await hostCancelBooking(
        booking.id,
        cancellation.policy_version,
        reason,
      ));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Цуцлах хүсэлтийг баталгаажуулж чадсангүй. Дахин оролдоно уу.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!cancellation?.allowed) {
    return booking.status === 'confirmed' && !booking.guest_cancelled_at && cancellation?.blocked_reason
      ? <Text style={[styles.paragraph, { color: C.textSecondary }]}>{cancellation.blocked_reason}</Text>
      : null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setAccepted(false);
          setReason('');
          setError('');
          setOpen(true);
        }}
        style={styles.openButton}
      >
        <Text style={styles.dangerText}>Захиалга цуцлах</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!busy) setOpen(false); }}
      >
        <SafeAreaView style={styles.overlay}>
          <KeyboardAvoidingView
            style={styles.keyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: C.background }]}>
              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text accessibilityRole="header" style={[styles.title, { color: C.text }]}>Захиалга цуцлах уу?</Text>
                <Text style={[styles.paragraph, { color: C.textSecondary }]}>Захиалга #{booking.id}: {booking.listing.title}</Text>
                {cancellation.policy.map((paragraph) => (
                  <Text key={paragraph} style={[styles.paragraph, { color: C.text }]}>{paragraph}</Text>
                ))}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => { setOpen(false); router.push('/host-terms'); }}
                  disabled={busy}
                >
                  <Text style={[styles.paragraph, { color: C.text, textDecorationLine: 'underline' }]}>Түрээслүүлэгчийн нөхцөл</Text>
                </Pressable>
                <Text style={[styles.paragraph, { color: C.text }]}>Цуцлах шалтгаан</Text>
                <TextInput
                  accessibilityLabel="Цуцлах шалтгаан"
                  value={reason}
                  onChangeText={setReason}
                  editable={!busy}
                  multiline
                  maxLength={1000}
                  placeholder="Жишээ: байранд яаралтай засвар хийх шаардлагатай болсон"
                  placeholderTextColor={C.textSecondary}
                  style={[styles.input, { color: C.text, borderColor: C.textSecondary }]}
                />
                <Text style={[styles.counter, { color: C.textSecondary }]}>{reason.length}/1000</Text>
                <View style={styles.checkbox}>
                  <Switch
                    accessibilityLabel="Цуцлалтын нөхцөл болон зочинд 100% буцаалт олгохыг зөвшөөрлөө."
                    value={accepted}
                    onValueChange={setAccepted}
                    disabled={busy}
                  />
                  <Text style={[styles.paragraph, { flex: 1, color: C.text }]}>Цуцлалтын нөхцөл болон зочинд 100% буцаалт олгохыг зөвшөөрлөө.</Text>
                </View>
                {error ? <Text accessibilityRole="alert" style={styles.dangerText}>{error}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={!accepted || !reason.trim() || busy}
                  accessibilityState={{ disabled: !accepted || !reason.trim() || busy }}
                  onPress={cancelBooking}
                  style={[styles.confirmButton, (!accepted || !reason.trim() || busy) && styles.disabled]}
                >
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
                  <Text style={styles.confirmText}>{busy ? 'Цуцалж байна...' : 'Цуцлалтыг батлах'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)} style={styles.keepButton}>
                  <Text style={[styles.paragraph, { color: C.text, textAlign: 'center' }]}>Захиалгаа хадгалах</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  openButton: { minHeight: 48, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#B91C1C', alignItems: 'center' },
  dangerText: { color: '#B91C1C', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: '#00000066', padding: 16 },
  keyboard: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { width: '100%', maxWidth: 520, maxHeight: '100%', borderRadius: 8 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  paragraph: { fontSize: 14, lineHeight: 22 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: 6, padding: 12, textAlignVertical: 'top', fontSize: 14 },
  counter: { marginTop: -12, textAlign: 'right', fontSize: 12 },
  checkbox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 },
  confirmButton: { minHeight: 48, padding: 12, backgroundColor: '#B91C1C', borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  keepButton: { minHeight: 44, justifyContent: 'center', padding: 8 },
  disabled: { opacity: 0.5 },
});
