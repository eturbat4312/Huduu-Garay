import type { PropsWithChildren } from 'react';
import { useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HostAction } from '@/components/host-action';
import { BottomTabInset, Spacing } from '@/constants/theme';

export default function AppShell({ children }: PropsWithChildren) {
  const segments = useSegments();
  const isTabsRoute = segments[0] === '(tabs)';

  return (
    <View style={styles.container}>
      {children}
      {isTabsRoute ? (
        <View pointerEvents="box-none" style={styles.floatingAction}>
          <HostAction />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingAction: {
    position: 'absolute',
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.two,
    zIndex: 100,
    elevation: 10,
    alignItems: 'flex-end',
  },
});
