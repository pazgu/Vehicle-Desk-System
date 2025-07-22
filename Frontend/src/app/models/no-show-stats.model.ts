export interface TopNoShowUser {
  user_id: string;
  name: string;
  department_id: string;
  count: number;
}

export interface NoShowStatsResponse {
  total_no_show_events: number;
  unique_no_show_users: number;
  top_no_show_users: TopNoShowUser[];
}
