import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MyRidesService } from '../../../services/myrides.service';
import { UserService } from '../../../services/user_service';
import * as XLSX from 'xlsx';

interface UserOrder {
  username: string;
  email: string;
  completedOrders: number;
}

@Component({
  selector: 'user-orders-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-orders-export.component.html',
  styleUrls: ['./user-orders-export.component.css'],
})
export class UserOrdersExportComponent implements OnInit {
  userOrders: UserOrder[] = [];
  isLoading = false;
  isExporting = false;

  viewMode: 'monthly' | 'yearly' = 'monthly';
  selectedMonth = (new Date().getMonth() + 1).toString();
  selectedYear = new Date().getFullYear();
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

  years: number[] = [];

  constructor(
    private myRidesService: MyRidesService,
    private userService: UserService
  ) {}

  ngOnInit() {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      this.years.push(y);
    }
    this.loadUserOrders();
  }

  async loadUserOrders() {
    this.isLoading = true;
    this.userOrders = [];

    try {
      const users = (await this.userService.getAllUsers().toPromise()) || [];

      const year = this.selectedYear;
      const month = this.viewMode === 'monthly' ? parseInt(this.selectedMonth) : undefined;
      
      const userOrdersPromises = users.map(async (user: any) => {
        const rides = await this.myRidesService.getAllOrders(user.employee_id).toPromise();

       

        const filtered = rides.filter((ride: any) => {
          // Check status (try different possible field names and values)
          const status = ride.status || ride.Status || ride.ride_status || ride.orderStatus;
          const isCompleted = status && (
            status.toLowerCase() === 'completed' || 
            status.toLowerCase() === 'complete' ||
            status.toLowerCase() === 'הושלם' ||
            status === 'completed'
          );
          
          if (!isCompleted) {
            return false;
          }
          
          const dateValue = ride.start_datetime || ride.end_datetime || ride.submitted_at;
if (!dateValue) {
  return false;
}

          
          const d = new Date(dateValue);
          const matchesYear = d.getFullYear() === year;
          const matchesMonth = !month || d.getMonth() + 1 === month;
                  
          return matchesYear && matchesMonth;
        });

    
        return {
          username: user.username || 'N/A',
          email: user.email || 'N/A',
          completedOrders: filtered.length,
        };
      });

      this.userOrders = await Promise.all(userOrdersPromises);
      this.applySorting();
    } catch (error) {
      console.error('Error loading user orders:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applySorting() {
    switch (this.sortOption) {
      case 'name_asc':
        this.userOrders.sort((a, b) => a.username.localeCompare(b.username, 'he'));
        break;
      case 'orders_desc':
        this.userOrders.sort((a, b) => b.completedOrders - a.completedOrders);
        break;
      case 'orders_asc':
        this.userOrders.sort((a, b) => a.completedOrders - b.completedOrders);
        break;
    }
  }

  onFilterChange() {
    this.loadUserOrders();
  }

  onSortChange() {
    this.applySorting();
  }

  exportToExcel() {
    if (!this.userOrders || this.userOrders.length === 0) return;

    this.isExporting = true;

    try {
      const worksheet = XLSX.utils.json_to_sheet(this.userOrders);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'User Orders');

      const fileName = `UserOrders-${this.selectedYear}-${
        this.viewMode === 'monthly' ? this.selectedMonth : 'Full'
      }.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    } finally {
      this.isExporting = false;
    }
  }
}