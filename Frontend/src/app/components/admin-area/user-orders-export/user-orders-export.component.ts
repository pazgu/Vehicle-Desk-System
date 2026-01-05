import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MyRidesService } from '../../../services/myrides.service';
import { UserService } from '../../../services/user_service';
import * as XLSX from 'xlsx-js-style';

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
      const month =
        this.viewMode === 'monthly' ? parseInt(this.selectedMonth) : undefined;

      const userOrdersPromises = users.map(async (user: any) => {
        const rides = await this.myRidesService
          .getAllOrders(user.employee_id)
          .toPromise();

        const filtered = rides.filter((ride: any) => {
          const status =
            ride.status || ride.Status || ride.ride_status || ride.orderStatus;
          const isCompleted =
            status &&
            (status.toLowerCase() === 'completed' ||
              status.toLowerCase() === 'complete' ||
              status.toLowerCase() === 'הושלם' ||
              status === 'completed');

          if (!isCompleted) {
            return false;
          }

          const dateValue =
            ride.start_datetime || ride.end_datetime || ride.submitted_at;
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
        this.userOrders.sort((a, b) =>
          a.username.localeCompare(b.username, 'he')
        );
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
    const exportRows = this.userOrders.map((u) => ({
      'שם משתמש': u.username,
      'אימייל': u.email,
      'כמות הזמנות שבוצעו': u.completedOrders,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    const keys = Object.keys(exportRows[0] ?? {});
    (worksheet as any)['!cols'] = keys.map((key) => {
      const headerLen = String(key).length;

      const maxCellLen = exportRows.reduce((max, row) => {
        const val = (row as any)[key];
        const str = val === null || val === undefined ? '' : String(val);
        return Math.max(max, str.length);
      }, 0);

      const wch = Math.min(Math.max(headerLen, maxCellLen) + 3, 90);
      return { wch };
    });

    const ref = worksheet['!ref'];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = worksheet[addr];
          if (!cell) continue;

          cell.s = cell.s || {};
          cell.s.alignment = {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true,
          };

          if (r === 0) {
            cell.s.font = { bold: true };
          }
        }
      }

      (worksheet as any)['!rows'] = Array.from(
        { length: range.e.r + 1 },
        (_, i) => ({ hpt: i === 0 ? 26 : 22 })
      );
    }

    (worksheet as any)['!freeze'] = { xSplit: 0, ySplit: 1 };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'הזמנות משתמשים');

    const fileName = `הזמנות משתמשים-${this.selectedYear}-${
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
