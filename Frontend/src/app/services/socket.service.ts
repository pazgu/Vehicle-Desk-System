import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SocketService {

  private socket!: Socket;

  // ✅ Will remind you to replace this with actual backend URL
  private readonly SOCKET_URL = environment.socketUrl; // ✅ now uses env

  public notifications$ = new BehaviorSubject<any>(null);
  public rideRequests$ = new BehaviorSubject<any>(null);
  public deleteRequests$ = new BehaviorSubject<any>(null);
  public orderUpdated$ = new BehaviorSubject<any>(null); 
  public newInspection$ = new Subject<any>();
  public vehicleStatusUpdated$ = new BehaviorSubject<any>(null); 
  public rideStatusUpdated$ = new BehaviorSubject<any>(null); 
  public auditLogs$ = new BehaviorSubject<any>(null);


  constructor() {
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
      console.log('✅ Connected to Socket.IO backend');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO backend');
    });



    this.listenToEvents();
  }

  private listenToEvents(): void {
  this.socket.on('order_updated', (data: any) => {
  console.log('✏️ Ride order updated via socket:', data);
  this.orderUpdated$.next(data); // ✅ Pushes to subscribers like HomeComponent
    this.socket.on('order_updated', (data: any) => {
      console.log('✏️ Ride order updated via socket:', data);
      this.orderUpdated$.next(data); // ✅ Pushes to subscribers like HomeComponent

});

this.socket.on('order_deleted', (data: any) => {
  console.log('✏️ Ride order deleted via socket:', data);
  this.deleteRequests$.next(data); // ✅ Pushes to subscribers like HomeComponent
  
});
    });
    this.socket.on('order_deleted', (data: any) => {
      console.log('✏️ Ride order deleted via socket:', data);
      this.deleteRequests$.next(data); // ✅ Pushes to subscribers like HomeComponent

    });
    this.socket.on('new_notification', (data: any) => {
      console.log('📩 Raw socket data received:', data);
      console.log('📩 Data type:', typeof data);
      console.log('📩 Socket ID:', this.socket.id);

      this.notifications$.next(data);
      console.log('📩 Data pushed to BehaviorSubject');
    });

    this.socket.on('new_ride_request', (data: any) => {
      console.log('🚗 New ride request received via socket:', data);
      this.rideRequests$.next(data);
    });

    this.socket.on('new_inspection', (data: any) => {
      console.log('📦 New inspection received via socket:', data);
      this.newInspection$.next(data);
    });


    this.socket.on('ride_status_updated', (data: any) => {
      console.log('🚗 ride status updated:', data);
      this.rideStatusUpdated$.next(data);
    });
       this.socket.on('vehicle_status_updated', (data: any) => {
      console.log('🚗 vehicle status updated:', data);
      this.vehicleStatusUpdated$.next(data);
    });


    this.socket.on('audit_log_updated', (data: any) => {
      console.log('📝 Audit log updated via socket:', data);
      this.auditLogs$.next(data);
    });


    setTimeout(() => {
      this.orderUpdated$.next({ id: 'test-id' });
    }, 3000);


  }

  public sendMessage(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }

  //   public joinRoom(userId: string): void {
  //   this.socket.emit('join', { room: userId });
  //   console.log(`📡 Sent join request to room: ${userId}`);
  // }



}
