export type Category = {
    id: number;
    name: string;
    icon?: string;
    translation_key?: string;
  };
  
  export type Amenity = {
    id: number;
    name: string;
    translation_key?: string;
  };
  
  export type ListingImage = {
    id: number;
    image: string; // URL
  };

  export type Host = {
    id: number;
  };
  
  export type Listing = {
    id: number;
    title: string;
    description: string;
    price_per_night: number;
    beds: number;
    max_guests: number;
    location_city: string;
    location_district: string;
    location_khoroo?: string;
    location_extra?: string;
    location_building?: string;
    location_apartment?: string;
    location_lat?: number;
    location_lng?: number;
    category?: Category | null;
    amenities: Amenity[];
    images: ListingImage[];
    is_active: boolean;
    created_at: string;
    is_favorited?: boolean;
    favorite_id?: number | null;
    host_username?: string;
    // Claude: null means no reviews yet
    average_rating?: number | null;
    host?: Host;

    
  };
  
  export type User = {
    id: number;
    username: string;
    email: string;
    avatar?: string;
    is_host: boolean;
    host_application_status?: "pending" | "approved" | "rejected" | "none";
  }
  
  export type Booking = {
    id: number;
    check_in: string;
    check_out: string;
    listing: {
      id: number;
      title: string;
      location?: string;
      location_city?: string;
      location_district?: string;
      thumbnail: string | null;
      price_per_night: number;
    };
    listing_id?: number; // write-only
    total_price: number;
    service_fee: number;
    status: string;
    guest_cancelled_at?: string | null;
    guest_cancellation_reason?: string;
    guest_cancellation?: {
      allowed: boolean;
      blocked_reason: string;
      policy_version: string;
      policy: string[];
    };
    created_at: string;
    notes?: string;
    full_name: string;
    phone_number: string;
    guest_name: string;
    guest_phone: string;
    is_cancelled_by_host: boolean;
    host_cancelled_at?: string | null;
    host_cancellation_reason?: string;
    host_cancellation_policy_version?: string;
    host_cancellation?: {
      allowed: boolean;
      blocked_reason: string;
      policy_version: string;
      policy: string[];
    };
    guest_count: number;
    is_unread: boolean;
    host_name?: string | null;
    host_phone?: string | null;
  };

  export type PaymentStatus =
    | "pending"
    | "paid"
    | "failed"
    | "cancelled"
    | "expired"
    | "refunded";

  export type Payment = {
    id: number;
    booking: Booking;
    booking_id: number;
    booking_status: string;
    provider: string;
    invoice_id: string;
    sender_invoice_no: string;
    idempotency_key?: string | null;
    amount: number;
    currency: string;
    status: PaymentStatus;
    raw_response: {
      qr_text?: string;
      qr_image?: string;
      urls?: Array<{
        name?: string;
        description?: string;
        link?: string;
      }>;
      mode?: string;
      message?: string;
      [key: string]: unknown;
    };
    paid_at?: string | null;
    created_at: string;
    updated_at: string;
  };


  export type HostApplication = {
    id: number;
    status: "pending" | "approved" | "rejected";
    bank_name?: string;
    account_number?: string;
    full_name?: string;
    phone_number?: string;
  };
