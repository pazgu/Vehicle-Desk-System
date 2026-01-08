import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification';
import { AuthService } from './auth.service';
import { take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  
  usersLicense$ = new Subject<any>();
  usersDepartment$ = new Subject<any>();
  
  public notifications$ = new BehaviorSubject<any>(null);
  public rideRequests$ = new BehaviorSubject<any>(null);
  public deleteRequests$ = new BehaviorSubject<any>(null);
  public deleteUserRequests$ = new BehaviorSubject<any>(null);
  public orderUpdated$ = new BehaviorSubject<any>(null);
  public newInspection$ = new Subject<any>();
  public vehicleStatusUpdated$ = new BehaviorSubject<any>(null);
  public rideStatusUpdated$ = new BehaviorSubject<any>(null);
  public auditLogs$ = new BehaviorSubject<any>(null);
  public newVehicle$ = new BehaviorSubject<any>(null);
  public feedbackNeeded$ = new ReplaySubject<any>(1);
  public vehicleExpiry$ = new BehaviorSubject<any>(null);
  public odometerNotif$ = new BehaviorSubject<any>(null);
  public rideSupposedToStart$ = new BehaviorSubject<any>(null);
  public usersBlockStatus$ = new Subject<{
    id: string;
    is_blocked: boolean;
    block_expires_at: Date | null;
  }>();
  public reservationCanceledDueToVehicleFreeze$ = new BehaviorSubject<any>(
    null
  );

  public vehicleMileageUpdated$ = new BehaviorSubject<any>(null);

  private readonly SOCKET_URL = environment.socketUrl;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      if (isLoggedIn) {
        this.reconnectSocket();
      } else {
        this.disconnectSocket();
      }
    });

    this.checkInitialConnection();
  }

  private checkInitialConnection(): void {
    this.authService.isLoggedIn$.pipe(take(1)).subscribe(isLoggedIn => {
      if (isLoggedIn && localStorage.getItem('access_token')) {
        this.connectToSocket();
      }
    });
  }

  private connectToSocket(): void {
    const token = localStorage.getItem('access_token');
    if (!token || this.isConnected) return;

    this.socket = io(this.SOCKET_URL, {
      transports: ['websocket'],
      auth: {
        token,
      },
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      
      const userId = localStorage.getItem('employee_id');
      if (userId) {
        this.socket?.emit('join', { user_id: userId });
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    this.listenToEvents();
  }

  private reconnectSocket(): void {
    this.disconnectSocket();
    setTimeout(() => {
      this.connectToSocket();
    }, 100);
  }

  private disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  private listenToEvents(): void {
    if (!this.socket) return;

    this.socket.on('order_updated', (data: any) => {
      this.orderUpdated$.next(data);
    });

    this.socket.on('user_deleted', (data: any) => {
      this.deleteUserRequests$.next(data);
    });

    this.socket.on('reservationCanceledDueToVehicleFreeze', (data: any) => {
      this.reservationCanceledDueToVehicleFreeze$.next(data);
    });

    this.socket.on('feedback_needed', (data) => {
      this.feedbackNeeded$.next(data);
    });

    this.socket.on('order_deleted', (data: any) => {
      this.deleteRequests$.next(data);
    });

    this.socket.on('new_notification', (data: any) => {
      const userId = localStorage.getItem('employee_id');

      if (
        data.user_id &&
        userId &&
        data.user_id.toString() === userId.toString()
      ) {
        this.notifications$.next(data);

        const current = this.notificationService.unreadCount$.getValue();
        this.notificationService.unreadCount$.next(current + 1);
      }
    });

    this.socket.on('vehicle_expiry_notification', (data: any) => {
      this.vehicleExpiry$.next(data);
      const current = this.notificationService.unreadCount$.getValue();
      this.notificationService.unreadCount$.next(current + 1);
    });

    this.socket.on('new_odometer_notification', (data: any) => {
      this.odometerNotif$.next(data);
      const current = this.notificationService.unreadCount$.getValue();
      this.notificationService.unreadCount$.next(current + 1);
    });

    this.socket.on('new_ride_request', (data: any) => {
      this.rideRequests$.next(data);
    });
    this.socket.on('ride_supposed_to_start', (data: any) => {
      this.rideSupposedToStart$.next(data);
    });

    this.socket.on('new_inspection', (data: any) => {
      this.newInspection$.next(data);
    });

    this.socket.on('ride_status_updated', (data: any) => {
      this.rideStatusUpdated$.next(data);
    });
    this.socket.on('vehicle_status_updated', (data: any) => {
      this.vehicleStatusUpdated$.next(data);
    });

    this.socket.on('user_license_updated', (data) => {
      this.usersLicense$.next(data);
    });
    this.socket.on('user_department_updated', (data) => {
      this.usersDepartment$.next(data);
    });
    this.socket.on('user_block_status_updated', (data: any) => {
      const normalized = {
        id: String(data.id),
        is_blocked: !!data.is_blocked,
        block_expires_at: data.block_expires_at
          ? new Date(data.block_expires_at)
          : null,
      };

      this.usersBlockStatus$.next(normalized);
    });
    this.socket.on('audit_log_updated', (data: any) => {
      this.auditLogs$.next(data);
    });

    this.socket.on('new_vehicle_created', (data: any) => {
      this.newVehicle$.next(data);
    });
    this.socket.on('vehicle_mileage_updated', (data: any) => {
      this.vehicleMileageUpdated$.next(data);
    });

  }

  public sendMessage(eventName: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(eventName, data);
    } else {
      console.warn('Socket not connected, cannot send message:', eventName);
    }
  }
}
