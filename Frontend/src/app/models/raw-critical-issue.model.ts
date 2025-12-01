export interface RawCriticalIssue {
  inspection_id?: string; 
  ride_id?: string | null;
  approved_by?: string;
  submitted_by?: string; 
  role?: string;
  type?: string; 
  status?: string;
  severity: string;
  issue_description?: string;
  issue_text?: string;
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
