import { Component } from '@angular/core';
import { LayoutComponent } from '../../../../layout-area/layout/layout.component';
import { HeaderComponent } from '../../../../layout-area/header/header.component';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [LayoutComponent, HeaderComponent,RouterModule,RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

}
