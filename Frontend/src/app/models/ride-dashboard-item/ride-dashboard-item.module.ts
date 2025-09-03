export interface RideDashboardItem {
  ride_id: string;
  employee_name: string;
  requested_vehicle_model: string;
  date_and_time: string;
  end_datetime?: string; 
  distance: number;
  status: string;
  destination: string; 
  submitted_at: string; 

}