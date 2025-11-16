import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification';
@Injectable({
  providedIn: 'root',
})
export class SocketService {

  private socket!: Socket;
  usersLicense$ = new Subject<any>();
  usersDepartment$ = new Subject<any>();
  private readonly SOCKET_URL = environment.socketUrl;

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
  public vehicleExpiry$=new BehaviorSubject<any>(null);
  public odometerNotif$=new BehaviorSubject<any>(null);
  public rideSupposedToStart$=new BehaviorSubject<any>(null);
  public usersBlockStatus$ = new Subject<{ id: string, is_blocked: boolean, block_expires_at: Date | null }>();

  constructor(private notificationService: NotificationService) {
    this.connectToSocket(); // ✅ now always tries to connect (later you can add env check)
  }

  private connectToSocket(): void {

    const token = localStorage.getItem('access_token'); // ✅ Fixed this line!

    this.socket = io(this.SOCKET_URL, {
      transports: ['websocket'],
      auth: {
        token,
      },
    });

    this.socket.on('connect', () => {

 const userId = localStorage.getItem('employee_id');
if (userId) {
  this.socket.emit('join', { user_id: userId });
} else {
  console.warn('⚠️ No user_id found in localStorage. Room join skipped.');
}

  });




    this.listenToEvents();
  }

  private listenToEvents(): void {
  this.socket.on('order_updated', (data: any) => {
  this.orderUpdated$.next(data); // ✅ Pushes to subscribers like HomeComponent

});

this.socket.on('user_deleted', (data: any) => {
  this.deleteUserRequests$.next(data);
});

this.socket.on('feedback_needed', (data) => {
  this.feedbackNeeded$.next(data);
});

this.socket.on('order_deleted', (data: any) => {
  this.deleteRequests$.next(data); // ✅ Pushes to subscribers like HomeComponent
  
});

    this.socket.on('new_notification', (data: any) => {
  const userId = localStorage.getItem('employee_id');

  

  // Make sure both exist and compare them
  if (data.user_id && userId && data.user_id.toString() === userId.toString()) {
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
      ? new Date(data.block_expires_at)     // <-- normalize here
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



  }

  public sendMessage(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }

  //   public joinRoom(userId: string): void {
  //   this.socket.emit('join', { room: userId });
  //   console.log(`📡 Sent join request to room: ${userId}`);
  // }

  


}
