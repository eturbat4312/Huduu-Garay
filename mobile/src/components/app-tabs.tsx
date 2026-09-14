import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchUnreadCount } from '@/lib/api';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { state } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  const isAuthenticated = state.status === 'authenticated';

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchUnreadCount();
        if (!cancelled) setUnreadCount(data.total_unread ?? 0);
      } catch {}
    };

    load();
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Навигейшн өөрчлөгдөхөд (жишээ нь create-listing-ээс буцахад) шууд poll хийх
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchUnreadCount()
      .then(data => { if (!cancelled) setUnreadCount(data.total_unread ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname, isAuthenticated]);

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Нүүр</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Хайх</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Label>Захиалга</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Нэвтрээгүй үед: Хадгалсан | Нэвтэрсэн үед: Мэдэгдэл — 4-р байр үргэлж 5 tab л байна */}
      {isAuthenticated ? (
        <NativeTabs.Trigger
          name="notifications"
          badge={unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined}>
          <NativeTabs.Trigger.Label>Мэдэгдэл</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      ) : (
        <NativeTabs.Trigger name="favorites">
          <NativeTabs.Trigger.Label>Хадгалсан</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Профайл</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
