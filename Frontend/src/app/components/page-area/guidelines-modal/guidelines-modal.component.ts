import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-guidelines-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guidelines-modal.component.html',
  styleUrls: ['./guidelines-modal.component.css']
})
export class GuidelinesModalComponent {
  @Input() rideId!: string;     // נשלח מה-Home אחרי יצירת נסיעה
  @Input() userId!: string;     // מזהה משתמש מחושב אצלך
  @Input() show = false;        // שליטה חיצונית אם לפתוח/לסגור
  @Output() confirmed = new EventEmitter<{rideId: string, userId: string, timestamp: string}>();
  @Output() closed = new EventEmitter<void>(); // לא נשתמש לסגירה בלי אישור (נשאיר למקרה עתידי)

  isChecked = false;

  onConfirm() {
    if (!this.isChecked) return;
    const ts = new Date().toISOString();
    this.confirmed.emit({ rideId: this.rideId, userId: this.userId, timestamp: ts });
  }

  // בכוונה לא מממשים close בלי אישור כדי "לחסום" את המסך
}
