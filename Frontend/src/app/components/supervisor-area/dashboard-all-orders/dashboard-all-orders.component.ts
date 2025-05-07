import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { Table, TableModule } from 'primeng/table';

@Component({
  selector: 'app-dashboard-all-orders',
  imports: [TableModule, DropdownModule, CalendarModule, CommonModule, ButtonModule, PaginatorModule, FormsModule],
  templateUrl: './dashboard-all-orders.component.html',
  styleUrl: './dashboard-all-orders.component.css'
})
export class DashboardAllOrdersComponent {

  rows: number = 5;
  trips = [
    { id: 1, employeeName: 'ישראל ישראלי', vehicle: 'רכב 1', dateTime: '2025-05-07 10:00', destination: 'תל אביב', distance: '10 ק"מ', status: 'הושלם' },
    { id: 2, employeeName: 'יוסי כהן', vehicle: 'רכב 2', dateTime: '2025-05-07 12:00', destination: 'ירושלים', distance: '70 ק"מ', status: 'ממתין' },
    { id: 3, employeeName: 'דנה לוי', vehicle: 'רכב 3', dateTime: '2025-05-08 09:00', destination: 'חיפה', distance: '90 ק"מ', status: 'בדרך' },
    { id: 4, employeeName: 'אבי מזרחי', vehicle: 'רכב 4', dateTime: '2025-05-08 14:30', destination: 'באר שבע', distance: '110 ק"מ', status: 'הושלם' },
    { id: 5, employeeName: 'שרה כהן', vehicle: 'רכב 5', dateTime: '2025-05-09 08:15', destination: 'נתניה', distance: '30 ק"מ', status: 'ממתין' },
    { id: 6, employeeName: 'מיכאל רון', vehicle: 'רכב 6', dateTime: '2025-05-09 11:45', destination: 'אשדוד', distance: '55 ק"מ', status: 'בדרך' },
    { id: 7, employeeName: 'תמר אלון', vehicle: 'רכב 7', dateTime: '2025-05-10 13:00', destination: 'אילת', distance: '300 ק"מ', status: 'ממתין' },
    { id: 8, employeeName: 'נועם חן', vehicle: 'רכב 8', dateTime: '2025-05-10 15:30', destination: 'רחובות', distance: '20 ק"מ', status: 'הושלם' },
    { id: 9, employeeName: 'רוני ברק', vehicle: 'רכב 9', dateTime: '2025-05-11 07:30', destination: 'מודיעין', distance: '45 ק"מ', status: 'בדרך' },
    { id: 10, employeeName: 'גיא כהן', vehicle: 'רכב 10', dateTime: '2025-05-11 17:00', destination: 'כפר סבא', distance: '25 ק"מ', status: 'ממתין' },
    { id: 11, employeeName: 'ליהי לוי', vehicle: 'רכב 11', dateTime: '2025-05-12 10:30', destination: 'חולון', distance: '35 ק"מ', status: 'הושלם' },
    { id: 12, employeeName: 'אורן מזרחי', vehicle: 'רכב 12', dateTime: '2025-05-12 13:00', destination: 'ראשון לציון', distance: '15 ק"מ', status: 'ממתין' },
    { id: 13, employeeName: 'נועה ברק', vehicle: 'רכב 13', dateTime: '2025-05-13 08:45', destination: 'רמת גן', distance: '25 ק"מ', status: 'בדרך' },
    { id: 14, employeeName: 'שלומי יוסף', vehicle: 'רכב 14', dateTime: '2025-05-13 11:30', destination: 'נתניה', distance: '40 ק"מ', status: 'הושלם' },
    { id: 15, employeeName: 'מירה כהן', vehicle: 'רכב 15', dateTime: '2025-05-14 09:00', destination: 'תל אביב', distance: '10 ק"מ', status: 'בדרך' },
    { id: 16, employeeName: 'צוריאל בר', vehicle: 'רכב 16', dateTime: '2025-05-14 14:00', destination: 'עכו', distance: '120 ק"מ', status: 'ממתין' },
    { id: 17, employeeName: 'מיכל חן', vehicle: 'רכב 17', dateTime: '2025-05-15 12:15', destination: 'חיפה', distance: '100 ק"מ', status: 'הושלם' },
    { id: 18, employeeName: 'אוראל רוזן', vehicle: 'רכב 18', dateTime: '2025-05-15 16:30', destination: 'הרצליה', distance: '40 ק"מ', status: 'בדרך' },
    { id: 19, employeeName: 'רז יוספי', vehicle: 'רכב 19', dateTime: '2025-05-16 09:30', destination: 'תל אביב', distance: '15 ק"מ', status: 'ממתין' },
    { id: 20, employeeName: 'עדי פרידמן', vehicle: 'רכב 20', dateTime: '2025-05-16 18:00', destination: 'חולון', distance: '25 ק"מ', status: 'הושלם' }
  ];
  
  

}
