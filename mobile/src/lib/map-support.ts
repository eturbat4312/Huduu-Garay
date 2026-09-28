import { Platform } from 'react-native';

const androidGoogleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim();

// Android's native MapView requires a Google Maps SDK key in the binary.
// Keep the rest of the app usable until that credential is configured.
export const nativeMapAvailable =
  Platform.OS !== 'android' || Boolean(androidGoogleMapsApiKey);
