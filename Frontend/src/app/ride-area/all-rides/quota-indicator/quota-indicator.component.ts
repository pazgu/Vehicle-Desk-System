import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quota-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quota-indicator.component.html',
  styleUrls: ['./quota-indicator.component.css']
})
export class QuotaIndicatorComponent implements OnInit, OnChanges {
  @Input() allOrders: any[] = [];
  
  freeQuotaTotal = 6;
  freeQuotaUsed = 0;

  ngOnInit(): void {
    this.calculateQuota();
  }

  ngOnChanges(): void {
    this.calculateQuota();
  }

  get freeQuotaExceeded(): boolean {
    return this.freeQuotaUsed >= this.freeQuotaTotal;
  }

  get quotaSegments(): number[] {
    return Array.from({ length: this.freeQuotaTotal }, (_, i) => i);
  }

  private calculateQuota(): void {
  const now = new Date();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const used = this.allOrders.filter((o: any) => {
    if (!o?.date || !o?.status) return false;

    const d = this.parseDate(o.date);
    d.setHours(12, 0, 0, 0);

    const isEligible =
      o.status === 'completed' ||
      (o.status === 'pending' && d >= now);

    if (!isEligible) return false;

    return d >= startOfMonth && d <= endOfMonth;
  }).length;

  this.freeQuotaUsed = Math.min(used, this.freeQuotaTotal);
}


  private parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }
}