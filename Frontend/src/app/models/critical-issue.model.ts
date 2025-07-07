export interface CriticalIssue {
  timestamp: string;
  source_type: 'Inspector' | 'Trip Completion';
  responsible_user: string;
  vehicle_info?: string;
  issue_summary: string;
}
