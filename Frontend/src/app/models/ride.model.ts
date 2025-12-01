export interface RideLocationItem {
  id: number;
  start_location_name: string;
  stop_name: string;
  destination_name: string;
  extra_stops_names?: string[];
}

export interface StartedRide {
  id: string;
}

export interface StartedRidesResponse {
  rides_supposed_to_start: string[];
}
