import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { MobilePreviewWidth } from '@/constants/theme';

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <View style={styles.page}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: MobilePreviewWidth,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
