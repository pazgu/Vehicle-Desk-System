export interface VehicleUsageStats {
  vehicle_id: string;
  plate_number: string;
  vehicle_model: string;
  total_rides: number;
  total_km: number;
  percentage_in_use_time: number;
}