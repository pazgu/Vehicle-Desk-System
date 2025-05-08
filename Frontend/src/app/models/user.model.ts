export interface LoginResponse {
    access_token: string;
    expires_at: string;
    user_id: string;
    username: string;
    role: string;
    token_type: 'bearer';
  }
  