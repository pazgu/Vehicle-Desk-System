export interface AuditLogs {
    id: number;
    action: string;
    entity_type: string;
    entity_id: string;
    change_data: JSON;
    created_at: string; 
    changed_by: string;
  }
  