export interface CriticalIssue {
  id: string;
  timestamp: string;
  source_type: 'Inspector' | 'Trip Completion';
  responsible_user: string;
  vehicle_info: string;
  issue_summary: string;
  inspection_id?: string;
  ride_id?: string | null;


}