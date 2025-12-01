import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GuidelinesService } from '../../../services/guidelines.service';
import { Observable } from 'rxjs';
import { GuidelinesDoc } from '../../../models/guidelines.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-guidelines-modal',
  templateUrl: './guidelines-modal.component.html',
  styleUrls: ['./guidelines-modal.component.css'],
  imports: [CommonModule, FormsModule],
})
export class GuidelinesModalComponent {
  @Input() rideId!: string;
  @Input() userId!: string;
  @Input() show = false;
  @Output() confirmed = new EventEmitter<{
    rideId: string;
    userId: string;
    timestamp: string;
  }>();
  @Output() closed = new EventEmitter<void>();

  isChecked = false;
  doc$!: Observable<GuidelinesDoc | null>;

  constructor(private guidelines: GuidelinesService) {}

  ngOnInit() {
    this.doc$ = this.guidelines.doc$;
    this.guidelines.get().subscribe();
  }

  onConfirm() {
    if (!this.isChecked) return;

    const payload = {
      ride_id: this.rideId,
      confirmed: true,
    };

    this.guidelines.confirmRide(payload).subscribe({
      next: (res) => {
        const ts = new Date().toISOString();
        this.confirmed.emit({
          rideId: this.rideId,
          userId: this.userId,
          timestamp: ts,
        });
        this.show = false;
      },
      error: () => {
        console.error('Failed to confirm ride requirements');
      },
    });
  }
}
