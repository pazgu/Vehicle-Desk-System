export interface EmailStatusResponse {
  email_status: 'ok' | 'failed' | 'retrying';
  email_operation_id?: string;
  email_recipient_id?: string;
  email_type?: string;
}
