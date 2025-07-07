export interface RawCriticalIssue {
  inspection_id?: string;  // ← use this if backend sends "id" as inspection ID
  ride_id?: string | null;
  approved_by?: string;
  submitted_by?: string; // ← support both
  role?: string;
  type?: string; // ← support both
  status?: string;
  severity: string;
  issue_description?: string;
  issue_text?: string; // ← support both
  timestamp: string;
  vehicle_id?: string;
  vehicle_info?: string;

  inspection_details?: {
    clean?: boolean;
    fuel_checked?: boolean;
    no_items_left?: boolean;
    issues_found?: string;
  };
}
