export interface LoginResponse {
  access_token: string;
  expires_at: string;
  employee_id: string;
  username: string;
  role: string;
  token_type: 'bearer';
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  department_id: string; 
}

export interface User {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  employee_id: string; 
  role: string; 
  department_id: string;
  has_government_license: boolean;
  license_check_passed: boolean;
  license_file_url?: string | null;
  license_expiry_date: Date | null;
  is_blocked: boolean;
  block_expires_at?: Date | null; 
  block_reason?: string | null;
  is_unassigned_user?: boolean;
}
