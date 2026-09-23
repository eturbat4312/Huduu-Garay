import { router } from 'expo-router';
import { Linking } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

export type NotificationNavigationData = {
  type?: string;
  related_booking?: number | string | null;
  booking_role?: 'guest' | 'host' | 'admin' | string | null;
  related_listing?: number | string | null;
  related_support_request?: number | string | null;
};

export function navigateForNotification(data: NotificationNavigationData) {
  if (data.type === 'support_reply') {
    router.push('/support' as never);
    return;
  }
  if (data.type === 'admin_support' && data.related_support_request) {
    void Linking.openURL(`${API_BASE_URL.replace(/\/api\/?$/, '')}/admin/core/supportrequest/${data.related_support_request}/change/`);
    return;
  }
  if (data.related_booking) {
    if (data.booking_role === 'admin') {
      void Linking.openURL(`${API_BASE_URL.replace(/\/api\/?$/, '')}/admin/core/booking/${data.related_booking}/change/`);
      return;
    }
    if (data.booking_role === 'guest') {
      router.push(`/booking/${data.related_booking}` as never);
      return;
    }
    if (data.booking_role === 'host') {
      router.push(`/host-bookings/${data.related_booking}` as never);
      return;
    }
    if (data.type === 'booking_created' || data.type === 'admin_booking') {
      router.push(`/host-bookings/${data.related_booking}` as never);
    } else {
      router.push(`/booking/${data.related_booking}` as never);
    }
    return;
  }
  if (data.related_listing) {
    router.push(`/listing/${data.related_listing}` as never);
    return;
  }
  if (data.type === 'host_approved') {
    router.push('/my-listings' as never);
    return;
  }
  if (data.type === 'host_rejected') {
    router.push('/become-host' as never);
    return;
  }
  router.push('/notifications' as never);
}
