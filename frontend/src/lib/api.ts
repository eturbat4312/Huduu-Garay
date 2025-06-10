// 📄 frontend/lib/api.ts
import api from "@/lib/axios";

export const fetchUnreadNotifications = async (): Promise<number> => {
  const response = await api.get("/notifications/unread-count/");
  return response.data.unread_count;
};
