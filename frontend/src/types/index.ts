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
    location_text: string;
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
    average_rating?: number;
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
      location: string;
      thumbnail: string | null;
      price_per_night: number;
    };
    listing_id?: number; // write-only
    total_price: number;
    status: string;
    created_at: string;
    notes?: string;
    full_name: string;
    phone_number: string;
    guest_name: string;
    guest_phone: string;
    is_cancelled_by_host: boolean;
    guest_count: number;
    is_unread: boolean;
    host_name?: string | null;
    host_phone?: string | null;
  };


  export type HostApplication = {
    id: number;
    status: "pending" | "approved" | "rejected";
    bank_name?: string;
    account_number?: string;
    full_name?: string;
    phone_number?: string;
  };
  