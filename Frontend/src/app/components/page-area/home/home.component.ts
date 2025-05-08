import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { HeaderComponent } from '../../layout-area/header/header.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink,HeaderComponent  ,RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
