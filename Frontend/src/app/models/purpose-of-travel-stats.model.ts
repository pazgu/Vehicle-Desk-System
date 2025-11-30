export interface MonthlyPurposeBreakdown {
  year: number;
  month: number;
  month_label: string;
  administrative_count: number;
  operational_count: number;
  total_rides: number;
  administrative_percentage: number;
  operational_percentage: number;
}

export interface PurposeOfTravelStatsResponse {
  from_year: number;
  from_month: number;
  to_year: number;
  to_month: number;
  total_rides: number;
  months: MonthlyPurposeBreakdown[];
}
