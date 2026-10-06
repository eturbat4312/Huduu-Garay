import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/mn/bookings/",
        "/mn/profile/",
        "/mn/favorites/",
        "/mn/notifications/",
        "/mn/my-listings/",
        "/mn/host-bookings/",
        "/mn/checkout/",
        "/mn/payment/",
        "/mn/booking-success/",
        "/mn/support/",
        "/mn/edit-listing/",
        "/mn/listings/new/",
        "/mn/become-host/",
      ],
    },
  };
}
