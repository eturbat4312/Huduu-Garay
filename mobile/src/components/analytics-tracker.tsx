import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/lib/api';
import { getItem, setItem } from '@/lib/storage';

const INSTALLATION_ID_KEY = 'tanaid_analytics_installation_id';
const INSTALL_REPORTED_KEY = 'tanaid_analytics_install_reported';
let trackingStarted = false;

async function sendEvent(payload: Record<string, string>) {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function AnalyticsTracker() {
  useEffect(() => {
    if (trackingStarted || !['ios', 'android'].includes(Platform.OS)) return;
    trackingStarted = true;

    void (async () => {
      let installationId = await getItem(INSTALLATION_ID_KEY);
      if (!installationId) {
        installationId = Crypto.randomUUID();
        await setItem(INSTALLATION_ID_KEY, installationId);
      }

      const sessionId = Crypto.randomUUID();
      const common = {
        visitor_id: installationId,
        session_id: sessionId,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version || '',
      };

      if ((await getItem(INSTALL_REPORTED_KEY)) !== '1') {
        const recorded = await sendEvent({
          ...common,
          event_id: installationId,
          event_type: 'app_install',
        });
        if (recorded) await setItem(INSTALL_REPORTED_KEY, '1');
      }

      await sendEvent({
        ...common,
        event_id: Crypto.randomUUID(),
        event_type: 'app_open',
      });
    })();
  }, []);

  return null;
}
