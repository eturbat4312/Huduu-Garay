import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { Href } from 'expo-router';
import { API_BASE_URL, ApiError, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './api';
import { rememberAuthReturnPath, resolveAuthReturnPath } from './auth-return';
import { getItem, setItem, removeItem } from './storage';

const VERIFIER_KEY = 'facebook_login_verifier';
const PENDING_KEY = 'facebook_pending_connection';
export type FacebookPending = {
  status: 'account_required'; pending_token: string; email: string; name: string;
  can_register: boolean; expires_at: string;
};
export type FacebookResult = FacebookPending
  | { status: 'authenticated'; access: string; refresh: string }
  | { status: 'cancelled' | 'provider_error' };

export async function facebookRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/auth/facebook/${path}/`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.error || 'Facebook нэвтрэхэд алдаа гарлаа.');
  return data;
}

export async function getFacebookPending(): Promise<FacebookPending | null> {
  try {
    const value = JSON.parse(await getItem(PENDING_KEY) || 'null');
    if (value?.pending_token && Date.parse(value.expires_at) > Date.now()) return value;
  } catch { /* Restart corrupt/expired sessions. */ }
  await removeItem(PENDING_KEY);
  return null;
}
export async function clearFacebookPending() { await removeItem(PENDING_KEY); }
export async function facebookReturnPath(
  requestedPath?: string | null,
  fallback = '/(tabs)/profile',
): Promise<Href> {
  if (await getFacebookPending()) return '/facebook-connect' as Href;
  return resolveAuthReturnPath(requestedPath, fallback);
}
export async function prepareFacebook(
  intent: 'login' | 'connect',
  returnTo?: string | null,
) {
  exchange = null;
  completedCode = '';
  await rememberAuthReturnPath(intent === 'login' ? returnTo : null);
  if (Platform.OS === 'web') throw new Error('Facebook нэвтрэлтийг үндсэн вэб сайт дээр ашиглана уу.');
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verifier = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  const result = await facebookRequest<{ authorization_url: string }>('start', { challenge, intent, client: 'mobile' });
  await setItem(VERIFIER_KEY, verifier);
  if (await getItem(VERIFIER_KEY) !== verifier) throw new Error('Нэвтрэх мэдээллийг төхөөрөмжид хадгалж чадсангүй. Дахин оролдоно уу.');
  await clearFacebookPending();
  return result.authorization_url;
}
let exchange: { code: string; task: Promise<FacebookResult> } | null = null;
let completedCode = '';
export function forgetFacebookExchange(code: string) { completedCode = code; exchange = null; }
export function wasFacebookCallbackHandled(code: string) { return exchange?.code === code || completedCode === code; }
export function completeFacebook(code: string): Promise<FacebookResult> {
  if (exchange?.code === code) return exchange.task;
  const task = (async () => {
    const verifier = await getItem(VERIFIER_KEY);
    if (!verifier) throw new Error('Нэвтрэх хүсэлт олдсонгүй. Facebook товчоор дахин эхлүүлнэ үү.');
    const result = await facebookRequest<FacebookResult>('exchange', { code, verifier });
    await removeItem(VERIFIER_KEY);
    if (result.status === 'account_required') {
      await setItem(PENDING_KEY, JSON.stringify(result));
      if (!(await getFacebookPending())) throw new Error('Холбох мэдээллийг хадгалж чадсангүй. Дахин эхлүүлнэ үү.');
    }
    return result;
  })();
  exchange = { code, task };
  return task;
}
export async function storeFacebookTokens(data: { access: string; refresh: string }) {
  await setItem(ACCESS_TOKEN_KEY, data.access);
  await setItem(REFRESH_TOKEN_KEY, data.refresh);
  if (await getItem(ACCESS_TOKEN_KEY) !== data.access || await getItem(REFRESH_TOKEN_KEY) !== data.refresh) {
    await removeItem(ACCESS_TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
    throw new Error('Нэвтрэх эрхийг төхөөрөмжид хадгалж чадсангүй. Дахин оролдоно уу.');
  }
}
export function facebookError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return 'Хэт олон оролдлого хийсэн байна. Түр хүлээгээд дахин оролдоно уу.';
  return error instanceof Error ? error.message : 'Facebook нэвтрэхэд алдаа гарлаа.';
}
