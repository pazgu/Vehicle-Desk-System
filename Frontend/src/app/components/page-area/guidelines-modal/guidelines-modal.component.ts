import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GuidelinesService, GuidelinesDoc } from '../../../services/guidelines.service';
import { Observable } from 'rxjs';

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

  doc$!: Observable<GuidelinesDoc | null>;

   constructor(private guidelines: GuidelinesService) {}

  ngOnInit() {
    this.doc$ = this.guidelines.doc$; // already loaded by service ctor + get()
    // ensure we have fresh data (mock will return quickly)
    this.guidelines.get().subscribe();
  }

  onConfirm() {
    if (!this.isChecked) return;
    const ts = new Date().toISOString();
    this.confirmed.emit({ rideId: this.rideId, userId: this.userId, timestamp: ts });
  }

  // בכוונה לא מממשים close בלי אישור כדי "לחסום" את המסך
}
