import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Linking, Pressable, Text, TextInput, View, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import { ApiError, fetchBookingMessages, readBookingMessages, sendBookingMessage, type BookingMessage } from '@/lib/api';
import type { BookingDetail } from '@/types/api';

export function BookingContact({ booking, host = false }: { booking: BookingDetail; host?: boolean }) {
  const C = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const retry = useRef<{ body: string; id: string } | null>(null);
  const allowed = booking.can_contact && !blocked;
  const phone = host ? booking.phone_number : booking.host_phone;

  useFocusEffect(useCallback(() => {
    if (!open || !allowed) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let after = 0;
    const poll = async () => {
      try {
        const data = await fetchBookingMessages(booking.id, after);
        if (!active) return;
        setError('');
        if (data.messages.length) {
          after = data.messages[data.messages.length - 1].id;
          setMessages(prev => [...new Map([...prev, ...data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id));
          await readBookingMessages(booking.id, after);
        }
        if (active) timer = setTimeout(poll, data.has_more ? 50 : 5000);
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && [403, 404].includes(e.status)) { setBlocked(true); setMessages([]); return; }
        setError('Мессеж татаж чадсангүй. Дахин оролдоно уу.');
        timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [open, allowed, booking.id]));

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    if (retry.current?.body !== text) retry.current = { body: text, id: randomUUID() };
    setSending(true);
    try {
      const sent = await sendBookingMessage(booking.id, text, retry.current.id);
      setMessages(prev => [...new Map([...prev, sent].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id));
      setBody(''); retry.current = null; setError('');
    } catch { setError('Илгээж чадсангүй. Бичсэн мессежээ дахин илгээнэ үү.'); }
    finally { setSending(false); }
  }

  if (!allowed) return <Text style={{ color: C.textSecondary }}>Чат, утас нь төлбөр төлөгдөж, захиалга баталгаажсаны дараа нээгдэнэ.</Text>;
  return <View style={{ backgroundColor: C.backgroundElement, padding: 16, borderRadius: 16, gap: 12 }}>
    <Text style={{ color: C.text, fontWeight: '700' }}>{host ? 'Зочинтой холбогдох' : 'Түрээслүүлэгчтэй холбогдох'}</Text>
    <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ backgroundColor: '#15803d', padding: 14, borderRadius: 10 }}><Text style={{ color: 'white' }}>Мессеж бичих{!open && booking.unread_message_count ? ` (${booking.unread_message_count})` : ''}</Text></Pressable>
    {phone && <Pressable accessibilityRole="button" onPress={() => { void Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`).catch(() => setError('Залгах боломжгүй байна.')); }}><Text style={{ color: C.text, paddingVertical: 8 }}>Залгах · {phone}</Text></Pressable>}
    {open && <>
      <Text style={{ color: C.textSecondary }}>Захиалга #{booking.id} · {booking.check_in} — {booking.check_out}</Text>
      {!messages.length && <Text style={{ color: C.textSecondary }}>Одоогоор мессеж алга.</Text>}
      {messages.map(m => <View key={m.id} style={{ alignSelf: m.is_mine ? 'flex-end' : 'flex-start', maxWidth: '90%', backgroundColor: C.backgroundSelected, padding: 12, borderRadius: 10 }}><Text selectable style={{ color: C.text }}>{m.body}</Text><Text style={{ color: C.textSecondary, fontSize: 11, marginTop: 4 }}>{new Date(m.created_at).toLocaleString()}</Text></View>)}
      <TextInput accessibilityLabel="Мессеж" multiline maxLength={2000} editable={!sending} value={body} onChangeText={setBody} placeholder="Мессежээ бичнэ үү…" placeholderTextColor={C.textSecondary} style={{ color: C.text, borderColor: C.textSecondary, borderWidth: 1, borderRadius: 10, minHeight: 80, padding: 12 }} />
      <Pressable accessibilityRole="button" disabled={sending || !body.trim()} onPress={() => void send()} style={{ padding: 14, borderRadius: 10, backgroundColor: '#15803d', opacity: sending || !body.trim() ? 0.5 : 1 }}><Text style={{ color: 'white' }}>{sending ? 'Илгээж байна…' : 'Илгээх'}</Text></Pressable>
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#DC2626' }}>{error}</Text>}
  </View>;
}
