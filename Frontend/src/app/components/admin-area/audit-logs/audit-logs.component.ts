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
      actionType: 'CREATE',
      fullName: 'Mickey Mouse',
      description: 'User Mickey Mouse created a new report on financial data. The report includes quarterly earnings and expenditure analysis.',
      createdAt: new Date('2024-01-15T10:30:00')
    },
    {
      id: 2,
      actionType: 'UPDATE',
      fullName: 'Donald Duck',
      description: 'User Donald Duck updated the inventory count for warehouse A. Stock levels for item #345 and #678 were adjusted.',
      createdAt: new Date('2024-01-16T14:45:00')
    },
    {
      id: 3,
      actionType: 'DELETE',
      fullName: 'Goofy Goof',
      description: 'User Goofy Goof deleted an old project file named "Legacy_Project_X.zip" from the archive server.',
      createdAt: new Date('2024-01-17T09:00:00')
    }
  ];
  filteredLogs: any[] = [];
  // Property to hold the selected log for detailed view
  selectedLog: any | null = null;

  ngOnInit() {
    this.filteredLogs = [...this.logs];
    console.log('LOGS:', this.logs);
  }

  filterLogs() {
    if (!this.searchTerm.trim()) {
      this.filteredLogs = [...this.logs];
      return;
    }

    const searchLower = this.searchTerm.toLowerCase();
    this.filteredLogs = this.logs.filter(log =>
      log.actionType?.toLowerCase().includes(searchLower) ||
      log.fullName?.toString().toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower)
    );
  }

  // Method to show details of a selected log
  showDetails(log: any) {
    this.selectedLog = log;
  }

  // Method to close the details card
  closeDetails() {
    this.selectedLog = null;
  }
}