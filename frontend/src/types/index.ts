export type Category = {
    id: number;
    name: string;
    icon?: string;
    translation_key?: string;
  };
  
  export type Amenity = {
    id: number;
    name: string;
  };
  
  export type ListingImage = {
    id: number;
    image: string; // URL
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
    listing: Listing;
    guest: User;
    check_in: string;
    check_out: string;
  };
  