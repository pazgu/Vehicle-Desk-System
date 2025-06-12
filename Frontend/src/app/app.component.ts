import { Component ,HostListener,OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { TabMonitorService } from './services/tab-monitor.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Bookit-frontend';
  constructor(private tabMonitorService: TabMonitorService) {}
}
