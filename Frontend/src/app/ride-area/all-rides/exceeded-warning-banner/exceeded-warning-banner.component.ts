import {
  Component,
  Input,
  OnInit,
  OnChanges,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-exceeded-warning-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exceeded-warning-banner.component.html',
  styleUrls: ['./exceeded-warning-banner.component.css'],
})
export class ExceededWarningBannerComponent implements OnInit, OnChanges {
  @Input() allOrders: any[] = [];
  @Output() bannerClicked = new EventEmitter<void>();

  warningVisible = false;

freeQuotaTotal = 6;
  freeQuotaUsed = 0;


  ngOnInit(): void {
this.calculateQuota();
    if (this.freeQuotaExceeded) {
      const today = new Date().toISOString().split('T')[0];
      const lastShownDate = localStorage.getItem('exceededWarningDate');
      if (lastShownDate !== today) {
        this.warningVisible = true;
        localStorage.setItem('exceededWarningDate', today);
      }
    }
  }

  ngOnChanges(): void {
    this.calculateQuota();
  }

  hideWarning(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.warningVisible = false;
  }

  showWarning(): void {
    this.warningVisible = true;
    this.bannerClicked.emit();
  }

  onBannerClick(): void {
    this.bannerClicked.emit();
  }

   get freeQuotaExceeded(): boolean {
    return this.calculateQuota() >= this.freeQuotaTotal;
  }

 private calculateQuota(): number {
  const now = new Date();

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0, 0, 0, 0
  );
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23, 59, 59, 999
  );
 
  const used = this.allOrders.filter((o: any) => {
    if (!o?.date || !o?.status) return false;

    const d = this.parseDate(o.date);
    d.setHours(12, 0, 0, 0);

    const isEligible =
      o.status === 'completed' ||
      (o.status === 'approved' && d >= now) ||
      (o.status === 'pending' && d >= now);

    if (!isEligible) return false;

    return d >= startOfMonth && d <= endOfMonth;
  }).length;

  this.freeQuotaUsed = Math.min(used, this.freeQuotaTotal);

  return used; 
}

  private parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }
}
