import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
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

  constructor() {
    this.connectToSocket(); // ✅ now always tries to connect (later you can add env check)
  }

  private connectToSocket(): void {
    const token = localStorage.getItem('token');
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
    this.socket.on('new_notification', (data: any) => {
      console.log('📩 New notification received:', data);
      this.notifications$.next(data);
    });

    this.socket.on('new_ride_request', (data: any) => {
      console.log('🚗 New ride request received via socket:', data);
      this.rideRequests$.next(data);
    });
  }

  public sendMessage(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }

  
}
