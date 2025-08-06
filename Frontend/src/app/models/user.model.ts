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
    department_id: string; // selected from dropdown
    // No need to include `employee_id` or `role`, those are handled by the backend
  }  
  
export interface User {
 
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  employee_id: string;     // UUID string
  role: string;            // Could be 'Employee', 'Supervisor', etc.
  department_id: string;   // UUID string
  has_government_license: boolean;  
  license_check_passed: boolean;
  license_file_url?: string | null;
  license_expiry_date: Date | null;
  is_blocked: boolean;
  block_expires_at?: Date | null; // Optional, if user is blocked

}
