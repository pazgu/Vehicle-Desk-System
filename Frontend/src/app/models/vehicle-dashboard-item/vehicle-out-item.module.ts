export interface VehicleOutItem {
  id: string; 
  plate_number: string;
  type: string;
  fuel_type: string;
  status: string; 
  freeze_reason?: string | null; 
  last_used_at?: string | null;
  mileage: number;
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
  Gasoline = 'gasoline',
}

export interface FuelTypeResponse {
  vehicle_id: string;
  fuel_type: FuelType;
}
