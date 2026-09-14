import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';

// ▸ Google Console-оос авсан Client ID-ээ солино уу
export const GOOGLE_IOS_CLIENT_ID = '1074205961751-egshclpstvb78p398re4h6noo4kaiake.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  label?: string;
  onError?: (msg: string) => void;
};

export function GoogleSignInButton({ label = 'Google-ээр нэвтрэх', onError }: Props) {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleCallback();
    } else if (response?.type === 'error') {
      setIsLoading(false);
      onError?.('Google нэвтрэх үед алдаа гарлаа.');
    }
  }, [response]);

  const handleGoogleCallback = async () => {
    if (response?.type !== 'success' || !request) return;
    setIsLoading(true);
    try {
      const clientId =
        Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_ANDROID_CLIENT_ID;
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code: response.params.code,
          redirectUri: request.redirectUri,
          extraParams: request.codeVerifier
            ? { code_verifier: request.codeVerifier }
            : {},
        },
        { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
      );
      const idToken = tokenResponse.idToken;
      if (!idToken) throw new Error('Google ID token байхгүй байна.');
      await loginWithGoogle(idToken);
      router.replace('/(tabs)/profile');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Google нэвтрэх үед алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      onPress={() => {
        setIsLoading(true);
        promptAsync();
      }}
      disabled={!request || isLoading}
      style={({ pressed }) => [styles.button, (pressed || isLoading) && styles.pressed]}>
      <ThemedText type="smallBold" style={styles.text}>
        {isLoading ? 'Нэвтэрч байна...' : `🔵  ${label}`}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D7DAE0',
    backgroundColor: '#FFFFFF',
  },
  text: { color: '#1F2937', fontSize: 16 },
  pressed: { opacity: 0.8 },
});
