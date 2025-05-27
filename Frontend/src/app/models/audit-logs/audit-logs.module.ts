export interface AuditLogs {
    id: number;
    full_name: string;
    action: string;
    entity_type: string;
    entity_id: string;
    change_data: JSON;
    created_at: string; 
    changed_by: string;
  }
  