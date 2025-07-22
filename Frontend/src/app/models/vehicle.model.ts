export interface Vehicle {
  id: string;
  plate_number: string;
  type: string;
  fuel_type: 'electric' | 'hybrid' | 'gasoline';
  status: 'available' | 'in_use' | 'frozen';
  freeze_reason?: 'accident' | 'maintenance' | 'personal';
  freeze_details?: string;
  last_used_at?: string;
  current_location: string;
  mileage: number;
  vehicle_model: string;
  image_url: string;
  lease_expiry?: string;
  department_id?: string;
  canDelete: boolean;

}
