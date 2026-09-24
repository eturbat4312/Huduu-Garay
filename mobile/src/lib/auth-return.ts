import type { Href } from 'expo-router';

import { getItem, removeItem, setItem } from './storage';

const AUTH_RETURN_PATH_KEY = 'auth_return_path';

export function safeAuthReturnPath(value?: string | null): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('://')
  ) {
    return null;
  }

  return value;
}

export function loginHref(returnTo: string): Href {
  const safeReturnTo = safeAuthReturnPath(returnTo);
  if (!safeReturnTo) return '/login';

  return {
    pathname: '/login',
    params: { returnTo: safeReturnTo },
  } as unknown as Href;
}

export async function rememberAuthReturnPath(returnTo?: string | null) {
  const safeReturnTo = safeAuthReturnPath(returnTo);
  if (safeReturnTo) {
    await setItem(AUTH_RETURN_PATH_KEY, safeReturnTo);
  } else {
    await removeItem(AUTH_RETURN_PATH_KEY);
  }
}

export async function resolveAuthReturnPath(
  requestedPath?: string | null,
  fallback = '/(tabs)/profile',
): Promise<Href> {
  const savedPath = await getItem(AUTH_RETURN_PATH_KEY);
  await removeItem(AUTH_RETURN_PATH_KEY);
  return (safeAuthReturnPath(requestedPath) ?? safeAuthReturnPath(savedPath) ?? fallback) as Href;
}
