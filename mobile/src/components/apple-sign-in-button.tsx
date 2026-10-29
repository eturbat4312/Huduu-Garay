import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/auth';
import { facebookReturnPath } from '@/lib/facebook';

type Props = {
  onError?: (message: string) => void;
  returnTo?: string | null;
};

/** Apple-ийн шаардсан native, брэндийн товчийг iOS дээр л харуулна. */
export function AppleSignInButton({ onError, returnTo }: Props) {
  const { loginWithApple } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, []);

  const handlePress = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple таних мэдээлэл ирсэнгүй.');
      }
      await loginWithApple(credential.identityToken, {
        givenName: credential.fullName?.givenName,
        familyName: credential.fullName?.familyName,
      });
      router.replace(await facebookReturnPath(returnTo));
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        onError?.(
          error instanceof Error
            ? error.message
            : 'Apple-ээр нэвтрэх үед алдаа гарлаа.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (Platform.OS !== 'ios' || !isAvailable) return null;

  return (
    <View style={styles.wrapper} accessibilityState={{ busy: isLoading }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={10}
        onPress={handlePress}
        style={[styles.button, isLoading && styles.loading]}
      />
      {isLoading ? <ActivityIndicator color="#FFFFFF" style={styles.spinner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 50, position: 'relative' },
  button: { width: '100%', height: 50 },
  loading: { opacity: 0.65 },
  spinner: { position: 'absolute', right: 22, top: 13 },
});
