import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { completeFacebook, facebookError, facebookReturnPath, forgetFacebookExchange } from '@/lib/facebook';

export default function FacebookCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { acceptFacebookSession, isLoading } = useAuth();
  const [error, setError] = useState('');
  const message = !code || typeof code !== 'string' ? 'Нэвтрэх мэдээлэл дутуу байна.' : error;
  useEffect(() => {
    let active = true;
    if (!code || typeof code !== 'string' || isLoading) return;
    completeFacebook(code).then(async result => {
      if (!active) return;
      if (result.status === 'authenticated') {
        await acceptFacebookSession(result);
        if (active) { forgetFacebookExchange(code); router.replace(await facebookReturnPath()); }
      } else if (result.status === 'account_required') {
        forgetFacebookExchange(code);
        router.replace('/facebook-connect' as Href);
      } else {
        forgetFacebookExchange(code);
        setError(result.status === 'cancelled' ? 'Facebook нэвтрэлтийг цуцаллаа.' : 'Facebook нэвтрэлтийг баталгаажуулж чадсангүй. Дахин оролдоно уу.');
      }
    }).catch(err => { if (active) setError(facebookError(err)); });
    return () => { active = false; };
  }, [code, acceptFacebookSession, isLoading]);
  return <ThemedView style={{ flex: 1 }}><SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
    <View style={{ gap: 20 }}>
      <ThemedText type="subtitle">Facebook нэвтрэлт</ThemedText>
      {!message && <ActivityIndicator />}
      <ThemedText>{message || 'Нэвтрэлтийг баталгаажуулж байна...'}</ThemedText>
      {message && <Pressable onPress={() => router.replace('/login')}><ThemedText style={{ color: '#16A34A' }}>Нэвтрэх хуудас руу буцах</ThemedText></Pressable>}
    </View>
  </SafeAreaView></ThemedView>;
}
