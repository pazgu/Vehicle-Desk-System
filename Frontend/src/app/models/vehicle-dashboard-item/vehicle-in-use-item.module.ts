export interface VehicleInItem {
  id: string;
  plate_number: string;
  type: string;
  fuel_type: string;
  status: string;
  freeze_reason?: string | null;
  last_used_at?: string;
  current_location?: string;
  odometer_reading: number;
  vehicle_model: string;
  image_url: string;
  user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
}