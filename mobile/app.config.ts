import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Expo loads app.json before invoking this dynamic config, so required fields
  // such as name and slug are already present at runtime.
  const baseConfig = config as ExpoConfig;
  const androidGoogleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  return {
    ...baseConfig,
    plugins: (baseConfig.plugins ?? []).map((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
      if (pluginName !== 'react-native-maps' || !androidGoogleMapsApiKey) {
        return plugin;
      }

      const currentOptions = Array.isArray(plugin) ? plugin[1] : undefined;
      return [
        'react-native-maps',
        {
          ...(typeof currentOptions === 'object' && currentOptions !== null
            ? currentOptions
            : {}),
          androidGoogleMapsApiKey,
        },
      ];
    }),
  };
};
