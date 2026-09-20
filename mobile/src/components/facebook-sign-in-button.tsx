import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { facebookError, facebookRequest, prepareFacebook, wasFacebookCallbackHandled } from '@/lib/facebook';

export function FacebookSignInButton({ intent = 'login' }: { intent?: 'login' | 'connect' }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    facebookRequest<{ enabled: boolean }>('config').then(data => {
      if (active) setEnabled(data.enabled);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!enabled || Platform.OS === 'web') return null;
  async function start() {
    if (busy) return;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      setError('Facebook нэвтрэлтийг хөгжүүлэлтийн эсвэл дэлгүүрийн апп дээр ашиглана.'); return;
    }
    setBusy(true); setError('');
    try {
      const url = await prepareFacebook(intent);
      const result = await WebBrowser.openAuthSessionAsync(url, 'tanaidhonoy://facebook-callback');
      if (result.type === 'success') {
        const returned = new URL(result.url);
        const code = returned.searchParams.get('code');
        if (returned.protocol !== 'tanaidhonoy:' || returned.hostname !== 'facebook-callback' || !code) throw new Error('Нэвтрэх холбоос буруу байна.');
        if (wasFacebookCallbackHandled(code)) return;
        router.replace(`/facebook-callback?code=${encodeURIComponent(code)}` as Href);
      }
    } catch (err) { setError(facebookError(err)); }
    finally { setBusy(false); }
  }
  return <View style={styles.wrapper}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={start} style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.65 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.label}>{intent === 'connect' ? 'Facebook холбох' : 'Facebook-ээр үргэлжлүүлэх'}</ThemedText>}
    </Pressable>
    {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrapper: { gap: 8, marginVertical: 8 },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#1877F2', padding: 12 },
  label: { color: '#fff', fontSize: 16 },
  error: { color: '#DC2626', fontSize: 14 },
});
