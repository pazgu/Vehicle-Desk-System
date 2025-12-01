export interface GuidelinesDoc {
  id: string;
  title: string;
  items: string[];
  updated_at: string;
  updated_by?: string;
}

export interface RideRequirementConfirmationIn {
  ride_id: string;
  confirmed: boolean;
}
