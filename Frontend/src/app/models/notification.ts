export interface MyNotification {
    id: string;
    user_id: string;
    notification_type: string;
    title: string;
    message: string;
    sent_at: string;
    order_id:string;
    order_status:string;
    vehicle_id: string;
    seen: boolean;
    is_extended_request?: boolean;
  }
  