import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-exceeded-warning-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exceeded-warning-banner.component.html',
  styleUrls: ['./exceeded-warning-banner.component.css']
})
export class ExceededWarningBannerComponent implements OnInit, OnChanges {
  @Input() allOrders: any[] = [];

  warningVisible = false;
  exceeded = false;

  ngOnInit(): void {
    this.checkExceeded();
    if (this.exceeded) {
      const today = new Date().toISOString().split('T')[0];
      const lastShownDate = localStorage.getItem('exceededWarningDate');
      if (lastShownDate !== today) {
        this.warningVisible = true;
        localStorage.setItem('exceededWarningDate', today);
      }
    }
  }

  ngOnChanges(): void {
    this.checkExceeded();
  }

  hideWarning(): void {
    this.warningVisible = false;
  }

  showWarning(): void {
    this.warningVisible = true;
  }

  private checkExceeded(): void {
    const maxRides = 6;
    const beginningOfMonth = new Date();
    beginningOfMonth.setDate(1);
    beginningOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const recentOrders = this.allOrders.filter((order: any) => {
      const orderDate = this.parseDate(order.date);
      return orderDate >= beginningOfMonth && orderDate <= endOfMonth;
    });

    this.exceeded = recentOrders.length >= maxRides;
  }

  private parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }
}