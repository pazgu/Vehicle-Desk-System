export interface VehicleInspection {
  inspection_id: string | null;
  inspection_date: string | null;
  inspected_by: string | null;
  inspected_by_name: string | null;
  clean: boolean;
  fuel_checked: boolean;
  no_items_left: boolean;
  critical_issue_bool: boolean;
  issues_found: string | null;
  plate_number: string | null;
}
