import { Component, OnDestroy, OnInit } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { RouterModule } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  imports: [HeaderComponent,RouterModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit,OnDestroy {
  private subscription = new Subscription();

  constructor(
    private socketService: SocketService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.subscription = this.socketService.notifications$.subscribe((notif) => {
      if(notif){
      const role=localStorage.getItem("role");
      if(role==='employee'){
 if(notif.message.includes('נדחתה')){
         this.toastService.show(notif.message,'error');
      }else{
         this.toastService.show(notif.message,'success');
      }
      }
    }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}