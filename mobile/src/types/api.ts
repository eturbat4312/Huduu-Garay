export type ListingSummary = {
  id: number;
  title: string;
  description: string;
  location_city: string;
  location_district: string;
  location_khoroo?: string;
  location_extra?: string;
  price_per_night: string;
  max_guests: number;
  beds: number;
  category?: ListingCategory | null;
  amenities: ListingAmenity[];
  images: ListingImage[];
  is_favorited?: boolean;
  favorite_id?: number | null;
  host_username?: string | null;
  thumbnail: string | null;
  average_rating: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
};

export type ListingCategory = {
  id: number;
  name: string;
  icon?: string | null;
  translation_key?: string;
};

export type ListingFilters = {
  category?: string;
  search?: string;
  location?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  amenities?: string[];
};

export type ListingImage = {
  id: number;
  image: string;
  uploaded_at?: string;
};

export type ListingAmenity = {
  id: number;
  name: string;
};

export type ListingHost = {
  id: number;
  username: string;
  is_host: boolean;
  avatar?: string | null;
};

export type ListingDetail = ListingSummary & {
  location_building?: string;
  location_apartment?: string | null;
  host_username: string | null;
  host?: ListingHost | null;
  is_favorited: boolean;
  favorite_id: number | null;
};

export type FavoriteResponse = {
  id: number;
  listing?: ListingSummary;
};

export type AvailabilityDay = {
  id: number;
  listing: number;
  date: string;
};

export type BookingSummary = {
  id: number;
  check_in: string;
  check_out: string;
  total_price: number | string;
  status: string;
  listing: {
    id: number;
    title: string;
    location_city: string;
    location_district: string;
    thumbnail: string | null;
    price_per_night: number | string;
  };
};

export type BookingCreatePayload = {
  listing_id: number | string;
  check_in: string;
  check_out: string;
  full_name: string;
  phone_number: string;
  notes: string;
  guest_count: number;
};

export type UserProfile = {
  id: number;
  email: string;
  username: string;
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar?: string | null;
  is_host: boolean;
  host_application_status?: string | null;
};

export type FavoriteListItem = {
  id: number;
  listing: ListingSummary;
};

export type BookingDetail = BookingSummary & {
  full_name: string;
  phone_number: string;
  notes?: string | null;
  guest_count: number;
  service_fee: number | string;
  is_cancelled_by_host: boolean;
};

export type NotificationItem = {
  id: number;
  message: string;
  is_read: boolean;
  type:
    | 'booking_created'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'host_approved'
    | 'host_rejected'
    | 'review'
    | 'listing_published'
    | 'payment'
    | 'booking'
    | 'comment'
    | 'rating'
    | string;
  created_at: string;
  related_booking?: number | null;
  related_listing?: number | null;
};

export type UnreadCountResponse = {
  total_unread: number;
  booking_unread: number;
};

export type Review = {
  id: number;
  listing: number;
  guest: number;
  guest_username: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type Payment = {
  id: number;
  booking_id: number;
  booking_status: string;
  provider: string;
  invoice_id: string;
  sender_invoice_no: string;
  amount: number | string;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded';
  raw_response: {
    qr_text?: string;
    qr_image?: string;
    urls?: {
      name?: string;
      description?: string;
      link?: string;
    }[];
    mode?: string;
    message?: string;
    [key: string]: unknown;
  };
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentIntent = {
  booking: BookingDetail;
  service_fee: number | string;
  payment_required_amount: number | string;
};
