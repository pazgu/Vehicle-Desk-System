import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-order-card',
  imports: [],
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.css'
})
export class OrderCardComponent {

  tripId: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.tripId = this.route.snapshot.paramMap.get('id');
    console.log('Trip ID:', this.tripId);
  }
  
}

