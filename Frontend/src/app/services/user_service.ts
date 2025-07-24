// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { User } from '../models/user.model';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface NewUserPayload {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone?: string;
  employee_id?: string;
  role: 'admin' | 'employee' | 'supervisor' | 'inspector';
  department_id: string;
  password: string;
  has_government_license: boolean;
  license_file_url?: string;
  license_expiry_date?: Date;
}

export interface NoShowEvent {
  id: string;
  user_id: string;
  ride_id: string;
  occurred_at: string; // or Date if you're parsing it
  plate_number:string;
}


export interface NoShowResponse {
  count: number;
  events: NoShowEvent[];
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = 'http://localhost:8000/api';
  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/user-data`);
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/user-data/${id}`);
  }
  getRoles() {
    // This should return Observable<string[]> or your role type
    return this.http.get<string[]>('http://localhost:8000/api/roles');
  }
  updateUser(userId: string, updateData: any) {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Authentication token not found in local storage.');
      return new Observable();
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    console.log('Sending request with headers:', { Authorization: `Bearer ${token}` });

    return this.http.patch(`${this.apiUrl}/user-data-edit/${userId}`, updateData, { headers });
  }

  addNewUser(userData: FormData) {
    const token = localStorage.getItem('token');

    const headers = {
      Authorization: `Bearer ${token}`,
    };
    console.log('User data sent from frontend:');
    for (const [key, value] of userData.entries()) {
      console.log(`${key}:`, value);
    }
    return this.http.post(`${this.apiUrl}/add-user`, userData, { headers });
  }


  deleteUser(userId: string) {
    const token = localStorage.getItem('token'); // assuming you save it on login

    const headers = {
      Authorization: `Bearer ${token}`,
    }
    return this.http.delete(`${this.apiUrl}/user-data/${userId}`, { headers });
  }
  


 getDepartments(): Observable<{ id: string; name: string }[]> {
  return this.http.get<{ id: string; name: string, supervisor_id: string }[]>(`${this.apiUrl}/departments`);
}


getDepartmentsWithSupervisors(): Observable<{ id: string; name: string; supervisorName: string }[]> {
  return this.http.get<{ id: string; name: string; supervisor_id: string }[]>(`${this.apiUrl}/departments`).pipe(
    switchMap(departments => {
      const departmentsWithNames$ = departments.map(dept =>
        this.getUserById(dept.supervisor_id).pipe(
          map(user => ({
            id: dept.id,
            name: dept.name,
            supervisorName: `${user.first_name} ${user.last_name}`
          })),
          catchError(() => of({
            id: dept.id,
            name: dept.name,
            supervisorName: 'לא ידוע'
          }))
        )
      );
      return forkJoin(departmentsWithNames$);
    })
  );
}

  getNoShowCount(userId: string): Observable<number> {
  const headers = this.getAuthHeaders();

  return this.http.get<{ users: { name: string, email: string, role: string, no_show_count: number, user_id?: string }[] }>(
    `${this.apiUrl}/no-show-events/count`,
    { headers }
  ).pipe(
    map(response => {
      // Find the user by ID — if you don’t have ID, use email or name
      const match = response.users.find(user => user.user_id === userId);
      return match?.no_show_count || 0;
    }),
    catchError(error => {
      console.error('Error fetching no-show count:', error);
      return throwError(() => error);
    })
  );
}


  getRecentNoShowEvents(userId: string, limit: number = 3): Observable<NoShowEvent[]> {
  const headers = this.getAuthHeaders();
  const params = new HttpParams()
    .set('user_id', userId)
    .set('per_user_limit', limit.toString());

  return this.http.get<{ per_user_limit: number, events: NoShowEvent[] }>(
    `${this.apiUrl}/no-show-events/recent`, 
    { headers, params }
  ).pipe(
    map(res => res.events),
    catchError(error => {
      console.error('Error fetching recent no-show events:', error);
      return throwError(() => error);
    })
  );
}


  getNoShowData(userId: string, limit: number = 3): Observable<NoShowResponse> {
    return forkJoin({
      count: this.getNoShowCount(userId),
      events: this.getRecentNoShowEvents(userId, limit)
    });
  }
}


