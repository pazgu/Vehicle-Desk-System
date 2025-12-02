import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TabMonitorService implements OnDestroy {
  private heartbeatKey = 'tabHeartbeat';
  private intervalId!: number;

  constructor() {
    this.startHeartbeat();
    this.checkIfLastTabClosed();
  }

  private startHeartbeat() {
    this.intervalId = window.setInterval(() => {
      localStorage.setItem(this.heartbeatKey, Date.now().toString());
    }, 1000); 
  }

  private checkIfLastTabClosed() {
    const last = localStorage.getItem(this.heartbeatKey);
    const now = Date.now();

    if (!last || now - parseInt(last) > 3000) {
      localStorage.clear();
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }
}
