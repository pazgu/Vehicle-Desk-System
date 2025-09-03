export interface EmailStatusResponse {
  /** 'ok' if the email was sent, 'failed' if it was not. 'retrying' is a frontend-only state. */
  email_status: 'ok' | 'failed' | 'retrying';
  
  /** The UUID/string ID of the specific entity related to the email (e.g., Ride ID, Vehicle ID, Report ID). */
  email_operation_id?: string;
  
  /** The UUID/string ID of the user the email was intended for. */
  email_recipient_id?: string;
  
  /** A string identifying the type of email sent (e.g., 'ride_creation', 'ride_approval'). */
  email_type?: string;
}