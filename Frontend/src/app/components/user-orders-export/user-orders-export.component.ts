import { Component, OnInit } from '@angular/core';
import { MyRidesService } from '../../services/myrides.service';
import * as XLSX from 'xlsx';
interface UserOrder {
  name: string;
  email: string;
  completedOrders: number;
}

@Component({
  selector: 'user-orders-export',
  standalone: true,
  imports: [],
  templateUrl: './user-orders-export.component.html',
  styleUrls: ['./user-orders-export.component.css'],
})
export class UserOrdersExportComponent implements OnInit {
  userOrders: UserOrder[] = [];
  isLoading = false;
  isExporting = false;

  viewMode: 'monthly' | 'yearly' = 'monthly';
  selectedMonth = (new Date().getMonth() + 1).toString();
  selectedYear = new Date().getFullYear().toString();
  sortOption: 'name_asc' | 'orders_desc' | 'orders_asc' = 'orders_desc';

  months = [
    { value: '1', label: 'ינואר' },
    { value: '2', label: 'פברואר' },
    { value: '3', label: 'מרץ' },
    { value: '4', label: 'אפריל' },
    { value: '5', label: 'מאי' },
    { value: '6', label: 'יוני' },
    { value: '7', label: 'יולי' },
    { value: '8', label: 'אוגוסט' },
    { value: '9', label: 'ספטמבר' },
    { value: '10', label: 'אוקטובר' },
    { value: '11', label: 'נובמבר' },
    { value: '12', label: 'דצמבר' },
  ];

  years: string[] = [];

  constructor(private myRidesService: MyRidesService) {}

  ngOnInit() {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      this.years.push(y.toString());
    }
    this.loadUserOrders();
  }

  loadUserOrders() {
    this.isLoading = true;

    // Replace with your backend API call
    const mode = this.viewMode;
    const year = this.selectedYear;
    const month = mode === 'monthly' ? this.selectedMonth : undefined;
    const sort = this.sortOption;
  }

  onFilterChange() {
    this.loadUserOrders();
  }

  onSortChange() {
    this.loadUserOrders();
  }

  exportToExcel() {
    if (!this.userOrders || this.userOrders.length === 0) return;

    this.isExporting = true;

    const worksheet = XLSX.utils.json_to_sheet(this.userOrders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Orders');

    const fileName = `UserOrders-${this.selectedYear}-${
      this.selectedMonth || ''
    }.xlsx`;
    XLSX.writeFile(workbook, fileName);

    this.isExporting = false;
  }
}
