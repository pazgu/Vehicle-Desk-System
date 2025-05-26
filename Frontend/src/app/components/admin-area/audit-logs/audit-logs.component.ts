import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css']
})
export class AuditLogsComponent implements OnInit {
  showFilters = false;
  searchTerm = '';
  logs: any[] = [
    // Sample data - replace with your actual data service
    {
      id: 1,
      action: 'CREATE',
      entityType: 'Vehicle',
      entityId: 'ABC123',
      changeData: 'Created new vehicle',
      changedBy: 'אדמין',
      createdAt: new Date('2024-01-15T10:30:00')
    },
    {
      id: 2,
      action: 'UPDATE',
      entityType: 'User',
      entityId: 'USER001',
      changeData: 'Updated user profile',
      changedBy: 'מנהל',
      createdAt: new Date('2024-01-15T11:45:00')
    },
    {
      id: 3,
      action: 'DELETE',
      entityType: 'Booking',
      entityId: 'BOOK456',
      changeData: 'Deleted booking',
      changedBy: 'אדמין',
      createdAt: new Date('2024-01-15T14:20:00')
    }
  ];
  filteredLogs: any[] = [];

  ngOnInit() {
    this.filteredLogs = [...this.logs];
  }

  filterLogs() {
    if (!this.searchTerm.trim()) {
      this.filteredLogs = [...this.logs];
      return;
    }

    const searchLower = this.searchTerm.toLowerCase();
    this.filteredLogs = this.logs.filter(log => 
      log.entityType?.toLowerCase().includes(searchLower) ||
      log.entityId?.toString().toLowerCase().includes(searchLower) ||
      log.changedBy?.toLowerCase().includes(searchLower) ||
      log.action?.toLowerCase().includes(searchLower)
    );
  }
}