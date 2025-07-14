export interface VehicleInspection {
  inspection_id: string;
  inspection_date: string;
  inspected_by: string;
  clean: boolean;
  fuel_checked: boolean;
  no_items_left: boolean;
  critical_issue_bool: boolean;
  issues_found: string | null;
  vehicle_id: string;
}