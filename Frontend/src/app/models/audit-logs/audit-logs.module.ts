// src/app/models/audit-logs/audit-logs.module.ts
export interface AuditLogs {
  id: number;
  full_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE'; // Assuming these are your actions
  entity_type: string;
  entity_id: string;
  change_data: any; // Use 'any' here, as it can be different structures
  created_at: string;
  changed_by: string;
}

// You might also want to define specific interfaces for change_data if it becomes more complex
// Example for an 'UPDATE' action's change_data
export interface UpdateChangeData {
  new: Record<string, any>;
  old: Record<string, any>;
}

// Example for an 'INSERT' action's change_data (for a User)
export interface UserInsertChangeData {
  role: string;
  email: string;
  password?: string; // Password might not always be present or displayed
  username: string;
  last_name: string;
  first_name: string;
  employee_id: string;
  department_id: string;
}

// Example for an 'INSERT' action's change_data (for a Ride)
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
  override_user_id?: string; // Optional for Ride updates
}