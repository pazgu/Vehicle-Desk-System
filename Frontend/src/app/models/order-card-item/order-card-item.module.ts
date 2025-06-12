export interface OrderCardItem {
  id: string;
  user_id: string;
  vehicle_id: string;
  ride_type: string;
  start_datetime: string;
  end_datetime: string;
  start_location: string;
  stop: string;
  destination: string;
  estimated_distance_km: number;
  actual_distance_km: number;
  status: string;
  license_check_passed: boolean;
  submitted_at: string;
  emergency_event: string;
}