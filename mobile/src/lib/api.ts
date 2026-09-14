import type {
  AvailabilityDay,
  BookingCreatePayload,
  BookingDetail,
  BookingSummary,
  FavoriteListItem,
  FavoriteResponse,
  ListingCategory,
  ListingDetail,
  ListingFilters,
  ListingSummary,
  UserProfile,
} from '@/types/api';
import { getItem, removeItem, setItem } from './storage';

const DEFAULT_API_URL = 'https://www.tanaid-honoy.mn/api';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  retryOnUnauthorized?: boolean;
  multipart?: FormData;
};

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    await removeItem(ACCESS_TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
    return null;
  }

  const data = (await response.json()) as { access: string };
  await setItem(ACCESS_TOKEN_KEY, data.access);
  return data.access;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getItem(ACCESS_TOKEN_KEY);

  let headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let body: BodyInit | undefined;
  if (options.multipart) {
    body = options.multipart;
    // multipart: Content-Type-ийг fetch өөрөө тохируулна (boundary-тай)
  } else if (options.body) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return request<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    let data: unknown;
    try {
      data = await response.json();
      const d = data as Record<string, unknown>;
      message =
        (d.detail as string) ??
        (d.error as string) ??
        (d.non_field_errors as string) ??
        message;
    } catch {}
    throw new ApiError(response.status, message, data);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<void> {
  const data = await request<{ access: string; refresh: string }>('/token/', {
    method: 'POST',
    body: { username: email, password },
  });
  await setItem(ACCESS_TOKEN_KEY, data.access);
  await setItem(REFRESH_TOKEN_KEY, data.refresh);
}

export async function signup(
  email: string,
  username: string,
  password: string,
): Promise<void> {
  await request('/signup/', {
    method: 'POST',
    body: { email, username, password },
  });
  // бүртгэлийн дараа автомат нэвтрэх
  await login(email, password);
}

export async function logout(): Promise<void> {
  await removeItem(ACCESS_TOKEN_KEY);
  await removeItem(REFRESH_TOKEN_KEY);
}

export async function googleLogin(idToken: string): Promise<void> {
  const data = await request<{ access: string; refresh: string }>('/auth/google/', {
    method: 'POST',
    body: { access_token: idToken }, // backend нь "access_token" гэж нэрлэсэн ч Google ID token
  });
  await setItem(ACCESS_TOKEN_KEY, data.access);
  await setItem(REFRESH_TOKEN_KEY, data.refresh);
}

export function fetchMe(): Promise<UserProfile> {
  return request<UserProfile>('/me/');
}

export async function updateMe(data: Partial<UserProfile> | FormData): Promise<UserProfile> {
  if (data instanceof FormData) {
    return request<UserProfile>('/me/', { method: 'PATCH', multipart: data });
  }
  return request<UserProfile>('/me/', { method: 'PATCH', body: data });
}

// ─── Listings ────────────────────────────────────────────────────────────────

export function fetchListings(filters: ListingFilters = {}): Promise<ListingSummary[]> {
  const query = buildQuery({
    category: filters.category || undefined,
    search: filters.search || undefined,
    location: filters.location || undefined,
    price_min: filters.priceMin ?? undefined,
    price_max: filters.priceMax ?? undefined,
    amenities: filters.amenities?.join(',') || undefined,
  });
  return request<ListingSummary[]>(`/listings/${query}`);
}

export function fetchListing(id: number | string): Promise<ListingDetail> {
  return request<ListingDetail>(`/listings/${id}/`);
}

export function fetchAvailability(listingId: number | string): Promise<AvailabilityDay[]> {
  return request<AvailabilityDay[]>(`/availability/${buildQuery({ listing: listingId })}`);
}

export function fetchCategories(): Promise<ListingCategory[]> {
  return request<ListingCategory[]>('/categories/');
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export function createFavorite(listingId: number): Promise<FavoriteResponse> {
  return request<FavoriteResponse>('/favorites/', {
    method: 'POST',
    body: { listing_id: listingId },
  });
}

export async function deleteFavorite(favoriteId: number): Promise<void> {
  await request<void>(`/favorites/${favoriteId}/`, { method: 'DELETE' });
}

export function fetchFavorites(): Promise<FavoriteListItem[]> {
  return request<FavoriteListItem[]>('/my-favorites/');
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export function createBooking(
  payload: BookingCreatePayload,
  idempotencyKey: string,
): Promise<BookingSummary> {
  return request<BookingSummary>('/bookings/', {
    method: 'POST',
    body: payload,
    headers: { 'X-Idempotency-Key': idempotencyKey },
  });
}

export function fetchMyBookings(): Promise<BookingSummary[]> {
  return request<BookingSummary[]>('/bookings/my/');
}

export function fetchBooking(id: number | string): Promise<BookingDetail> {
  return request<BookingDetail>(`/bookings/${id}/`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

// ─── Host ────────────────────────────────────────────────────────────────────

export type HostApplication = {
  id: number;
  status: string;
  created_at: string;
  message?: string | null;
};

export function fetchMyListings(): Promise<import('@/types/api').ListingSummary[]> {
  return request<import('@/types/api').ListingSummary[]>('/my-listings/');
}

export function fetchHostBookings(): Promise<import('@/types/api').BookingSummary[]> {
  return request<import('@/types/api').BookingSummary[]>('/host-bookings/');
}

export function applyToBeHost(payload: { message?: string }): Promise<HostApplication> {
  return request<HostApplication>('/host/apply/', {
    method: 'POST',
    body: payload,
  });
}

export function fetchHostApplication(): Promise<HostApplication> {
  return request<HostApplication>('/host/application/me/');
}

export function applyToBeHostFormData(formData: FormData): Promise<HostApplication> {
  return new Promise(async (resolve, reject) => {
    let token: string | null = null;
    try { token = await getItem(ACCESS_TOKEN_KEY); } catch {}

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/host/apply/`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new ApiError(xhr.status, 'Invalid JSON response')); }
      } else {
        let message = `Error ${xhr.status}`;
        let data: unknown;
        try {
          data = JSON.parse(xhr.responseText);
          const d = data as Record<string, unknown>;
          message = (d.detail as string) ?? (d.error as string) ?? message;
        } catch {}
        reject(new ApiError(xhr.status, message, data));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Сүлжээний алдаа гарлаа.'));
    xhr.send(formData);
  });
}

// ─── Listings (Host) ──────────────────────────────────────────────────────────

export function fetchAmenities(): Promise<import('@/types/api').ListingAmenity[]> {
  return request<import('@/types/api').ListingAmenity[]>('/amenities/');
}

export type ListingCreatePayload = {
  title: string;
  description: string;
  location_city: string;
  location_district: string;
  location_khoroo?: string;
  location_extra?: string;
  location_building?: string;
  location_apartment?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  price_per_night: number;
  beds: number;
  max_guests: number;
  category_id: number;
  amenity_ids?: number[];
};

export function createListing(payload: ListingCreatePayload): Promise<import('@/types/api').ListingDetail> {
  return request<import('@/types/api').ListingDetail>('/listings/', {
    method: 'POST',
    body: payload,
  });
}

export function uploadListingImages(listingId: number, imageUris: string[]): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (imageUris.length === 0) { resolve(); return; }
    let token: string | null = null;
    try { token = await getItem(ACCESS_TOKEN_KEY); } catch {}

    const formData = new FormData();
    formData.append('listing', String(listingId));
    imageUris.forEach((uri, i) => {
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      (formData as any).append('images', { uri, name: `photo_${i}.${ext}`, type: mime });
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/listing-images/`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(xhr.status, `Image upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Зургийн upload алдаа.'));
    xhr.send(formData);
  });
}

export async function deleteListing(listingId: number): Promise<void> {
  await request<void>(`/listings/${listingId}/delete/`, { method: 'DELETE' });
}

export function createAvailabilityBulk(listingId: number, dates: string[]): Promise<void> {
  if (dates.length === 0) return Promise.resolve();
  return request<void>('/availability/bulk/', {
    method: 'POST',
    body: { listing: listingId, dates },
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function fetchNotifications(): Promise<import('@/types/api').NotificationItem[]> {
  return request<import('@/types/api').NotificationItem[]>('/notifications/');
}

export function fetchUnreadCount(): Promise<import('@/types/api').UnreadCountResponse> {
  return request<import('@/types/api').UnreadCountResponse>('/notifications/unread-count/');
}

export function markNotificationsRead(type?: string): Promise<void> {
  return request<void>('/notifications/mark-read/', {
    method: 'POST',
    body: type ? { type } : {},
  });
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  await request<{ detail: string }>('/password-reset/', {
    method: 'POST',
    body: { email },
  });
}

export async function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
): Promise<void> {
  await request<{ detail: string }>('/password-reset/confirm/', {
    method: 'POST',
    body: { uid, token, new_password: newPassword },
  });
}

// ─── Listing update / image delete ───────────────────────────────────────────

export type ListingUpdatePayload = Partial<ListingCreatePayload>;

export function updateListing(
  id: number | string,
  payload: ListingUpdatePayload,
): Promise<import('@/types/api').ListingDetail> {
  return request<import('@/types/api').ListingDetail>(`/listings/${id}/`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteListingImage(imageId: number): Promise<void> {
  await request<void>(`/listing-images/${imageId}/`, { method: 'DELETE' });
}
