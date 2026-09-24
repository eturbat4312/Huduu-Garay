import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { facebookReturnPath } from '@/lib/facebook';
import { useAuth } from '@/context/auth';

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type Props = {
  label?: string;
  onError?: (msg: string) => void;
  returnTo?: string | null;
};

export function GoogleSignInButton({
  label = 'Google-ээр нэвтрэх',
  onError,
  returnTo,
}: Props) {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const isConfigured = Boolean(
    GOOGLE_WEB_CLIENT_ID && (Platform.OS !== 'ios' || GOOGLE_IOS_CLIENT_ID),
  );

  const handlePress = async () => {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      onError?.('Google нэвтрэлтийг хөгжүүлэлтийн эсвэл дэлгүүрийн апп дээр ашиглана.');
      return;
    }
    if (!isConfigured) {
      onError?.('Google нэвтрэх тохиргоо дутуу байна.');
      return;
    }

    setIsLoading(true);
    try {
      const { GoogleSignin, isSuccessResponse } = await import(
        '@react-native-google-signin/google-signin'
      );

      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        ...(Platform.OS === 'ios' ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
      });

      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Google таних мэдээлэл ирсэнгүй.');

      await loginWithGoogle(idToken);
      router.replace(await facebookReturnPath(returnTo));
    } catch (err) {
      const googleModule = await import('@react-native-google-signin/google-signin');
      if (googleModule.isErrorWithCode(err)) {
        if (err.code === googleModule.statusCodes.IN_PROGRESS) {
          onError?.('Google нэвтрэх цонх аль хэдийн нээгдсэн байна.');
        } else if (err.code === googleModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError?.('Google Play үйлчилгээ шинэчлэгдэх шаардлагатай байна.');
        } else {
          onError?.('Google-ээр нэвтрэх үед алдаа гарлаа.');
        }
      } else {
        onError?.(err instanceof Error ? err.message : 'Google-ээр нэвтрэх үед алдаа гарлаа.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLoading}
      style={({ pressed }) => [styles.button, (pressed || isLoading) && styles.pressed]}>
      <ThemedText type="smallBold" style={styles.googleMark}>G</ThemedText>
      <ThemedText type="smallBold" style={styles.text}>
        {isLoading ? 'Нэвтэрч байна...' : label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D7DAE0',
    backgroundColor: '#FFFFFF',
  },
  googleMark: { color: '#4285F4', fontSize: 20 },
  text: { color: '#1F2937', fontSize: 16 },
  pressed: { opacity: 0.8 },
});
