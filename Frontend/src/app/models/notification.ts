export interface MyNotification {
    id: string;
    user_id: string;
    notification_type: string;
    title: string;
    message: string;
    sent_at: string; // Keep this as-is from backend
  }
  