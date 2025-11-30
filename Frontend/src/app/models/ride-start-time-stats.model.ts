export interface RideStartTimeBucket {
  hour: number;      
  ride_count: number; 
}

export interface RideStartTimeStatsResponse {
  buckets: RideStartTimeBucket[];
  from_date: string; 
  to_date: string;    
  total_rides: number; 
}
