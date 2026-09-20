import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FacebookSignInButton } from '@/components/facebook-sign-in-button';
import { useAuth } from '@/context/auth';
import { connectFacebook } from '@/lib/api';
import { clearFacebookPending, facebookError, facebookRequest, getFacebookPending, type FacebookPending } from '@/lib/facebook';

export default function FacebookConnectScreen() {
  const { user, isLoading, acceptFacebookSession, logout, refresh } = useAuth();
  const [pending, setPending] = useState<FacebookPending | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    getFacebookPending().then(value => { if (active) { setPending(value); setReady(true); } });
    return () => { active = false; };
  }, []));

  async function act(action: 'connect' | 'send-code' | 'register') {
    if (!pending || busy) return;
    setBusy(true); setError('');
    try {
      if (action === 'connect') { await connectFacebook(pending.pending_token); await refresh(); }
      else if (action === 'send-code') {
        await facebookRequest('send-code', { pending_token: pending.pending_token });
        setSent(true); return;
      } else {
        const data = await facebookRequest<{ access: string; refresh: string }>('register', {
          pending_token: pending.pending_token, confirm_new_account: true, email_code: code,
        });
        await acceptFacebookSession(data);
      }
      await clearFacebookPending();
      router.replace('/(tabs)/profile');
    } catch (err) { setError(facebookError(err)); }
    finally { setBusy(false); }
  }
  return <ThemedView style={styles.container}><SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="title">Facebook холбох</ThemedText>
      {!ready || isLoading ? <ActivityIndicator /> : !pending ? <>
        <ThemedText>Холбох хүсэлт дууссан байна. Facebook-ээр дахин эхлүүлнэ үү.</ThemedText>
        <FacebookSignInButton intent={user ? 'connect' : 'login'} />
        <Pressable onPress={() => router.replace('/login')}><ThemedText style={styles.link}>Нэвтрэх хуудас руу буцах</ThemedText></Pressable>
      </> : <>
        <ThemedText>Facebook: {pending.name || 'Таны Facebook'}{pending.email ? ` · ${pending.email}` : ''}</ThemedText>
        {user ? <>
          <ThemedText>{user.email || user.username} аккаунтдаа энэ Facebook-ийг холбох уу? Захиалга, хадгалсан зүйлс энэ аккаунтдаа үлдэнэ.</ThemedText>
          <Pressable disabled={busy} onPress={() => act('connect')} style={styles.primary}><ThemedText style={styles.primaryText}>{busy ? 'Холбож байна...' : 'Энэ аккаунтад Facebook холбох'}</ThemedText></Pressable>
          <Pressable disabled={busy} onPress={async () => { await logout(); router.push('/login'); }}><ThemedText style={styles.link}>Өөр аккаунтаар нэвтрэх</ThemedText></Pressable>
        </> : <>
          <ThemedText>Өмнө нь бүртгүүлсэн бол Google эсвэл нууц үгээрээ нэвтэрч Facebook-ээ холбоно уу. Facebook-ийн имэйл өөр байсан ч өмнөх аккаунтаа ашиглаж болно.</ThemedText>
          {!pending.email && <ThemedText>Facebook имэйл хаяг дамжуулсангүй. Шинэ хэрэглэгч бол имэйлээр бүртгүүлсний дараа Facebook-ээ холбоно.</ThemedText>}
          <Pressable onPress={() => router.push('/login')} style={styles.primary}><ThemedText style={styles.primaryText}>Өмнөх аккаунтаар нэвтрэх</ThemedText></Pressable>
          {!pending.email && <Pressable onPress={() => router.push('/signup')}><ThemedText style={styles.link}>Имэйлээр бүртгүүлэх</ThemedText></Pressable>}
          {pending.can_register && <View style={styles.group}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: creating }} onPress={() => setCreating(!creating)}>
              <ThemedText>{creating ? '☑' : '☐'} Өмнө нь бүртгүүлээгүй. Шинэ аккаунт үүсгэнэ. Өмнөх аккаунтын захиалга шинэ аккаунтад шилжихгүйг ойлголоо.</ThemedText>
            </Pressable>
            {creating && <>
              <ThemedText>{pending.email} хаягаа баталгаажуулна уу.</ThemedText>
              <Pressable disabled={busy} onPress={() => act('send-code')}><ThemedText style={styles.link}>{busy ? 'Түр хүлээнэ үү...' : sent ? 'Код дахин илгээх' : 'Имэйлд код илгээх'}</ThemedText></Pressable>
              {sent && <>
                <ThemedText>Имэйлд ирсэн 6 оронтой код (Spam/Junk хавтсыг мөн шалгана уу)</ThemedText>
                <TextInput accessibilityLabel="Баталгаажуулах код" value={code} onChangeText={text => setCode(text.replace(/\D/g, ''))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} style={styles.input} />
                <Pressable disabled={busy || code.length !== 6} onPress={() => act('register')} style={[styles.primary, (busy || code.length !== 6) && { opacity: 0.5 }]}><ThemedText style={styles.primaryText}>{busy ? 'Бүртгэж байна...' : 'Баталгаажуулж бүртгүүлэх'}</ThemedText></Pressable>
              </>}
            </>}
          </View>}
        </>}
        <Pressable disabled={busy} onPress={async () => { await clearFacebookPending(); router.replace('/login'); }}><ThemedText style={styles.link}>Холбох хүсэлтийг цуцлах</ThemedText></Pressable>
      </>}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
    </ScrollView>
  </SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', gap: 20, padding: 24 },
  group: { gap: 16, borderTopWidth: 1, borderColor: '#ddd', paddingTop: 20 },
  primary: { padding: 14, alignItems: 'center', borderRadius: 8, backgroundColor: '#1877F2' },
  primaryText: { color: '#fff', fontWeight: '600' }, link: { color: '#16A34A', textDecorationLine: 'underline' },
  input: { borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 14, backgroundColor: '#fff', color: '#111', fontSize: 20 },
  error: { color: '#DC2626', fontSize: 14 },
});
