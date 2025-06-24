export interface VehicleOutItem{
  id: string; // UUID as string
  plate_number: string;
  type: string; // VehicleType as string
  fuel_type: string; // FuelType as string
  status: string; // VehicleStatus as string
  freeze_reason?: string | null; // Optional, can be null
  last_used_at?: string | null; // ISO date string or null
  current_location: string;
  odometer_reading: number;
  vehicle_model: string;
  image_url: string;
}
export enum FreezeReason {
  accident = 'accident',
  maintenance = 'maintenance',
  personal = 'personal',
}
export enum FuelType {
  Electric = 'electric',
  Hybrid = 'hybrid',
  Gasoline = 'gasoline'
}

export interface FuelTypeResponse {
  vehicle_id: string;
  fuel_type: FuelType;
}