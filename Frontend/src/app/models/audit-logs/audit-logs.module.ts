export interface AuditLogs {
  id: number;
  full_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  change_data: any;
  created_at: string;
  changed_by: string;
}

export interface UpdateChangeData {
  new: Record<string, any>;
  old: Record<string, any>;
}

export interface UserInsertChangeData {
  role: string;
  email: string;
  password?: string;
  username: string;
  last_name: string;
  first_name: string;
  employee_id: string;
  department_id: string;
}

export interface RideInsertChangeData {
  id: string;
  stop: string;
  status: string;
  user_id: string;
  isArchive: boolean;
  ride_type: string;
  vehicle_id: string;
  destination: string;
  end_datetime: string;
  submitted_at: string;
  start_datetime: string;
  start_location: string;
  emergency_event: string | null;
  actual_distance_km: number;
  license_check_passed: boolean;
  estimated_distance_km: number;
  override_user_id?: string;
  extra_stops?: string[];
}
