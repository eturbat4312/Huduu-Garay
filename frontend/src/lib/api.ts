// 📄 frontend/lib/api.ts
import api from "@/lib/axios";

// 🔢 Уншаагүй мэдэгдлийн тоог авах
export async function fetchUnreadNotifications(): Promise<{
  total_unread: number;
  booking_unread: number;
}> {
  const res = await api.get("/notifications/unread-count/");
  return res.data;
}

// 🟢 Бүх мэдэгдлийг уншсан гэж тэмдэглэх
export async function markAllNotificationsAsRead(): Promise<void> {
  await api.post("/notifications/mark-read/");
}

// 📥 Зөвхөн booking төрлийн мэдэгдлийг уншсан гэж тэмдэглэх
export async function markBookingNotificationsAsRead(): Promise<void> {
  await api.post("/notifications/mark-read/", { type: "booking" });
}
