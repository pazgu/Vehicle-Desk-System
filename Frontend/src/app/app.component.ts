import { Component ,HostListener,OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { TabMonitorService } from './services/tab-monitor.service';
import { SocketService } from './services/socket.service';
import { EmailRetryComponent } from './components/shared/email-retry/email-retry.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, EmailRetryComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Bookit-frontend';
  constructor(private tabMonitorService: TabMonitorService ,private socketService: SocketService 
) {}
 ngOnInit(): void {
    console.log('🧠 AppComponent initialized — SocketService eagerly loaded');
  }
}


