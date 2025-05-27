import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogsService } from '../../../services/audit-logs.service';
import { AuditLogs } from '../../../models/audit-logs/audit-logs.module';

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

  // logs: any[] = [
  //   // Sample data - replace with your actual data service
  //   {
  //     id: 1,
  //     actionType: 'CREATE',
  //     fullName: 'Mickey Mouse',
  //     description: 'User Mickey Mouse created a new report on financial data. The report includes quarterly earnings and expenditure analysis.',
  //     createdAt: new Date('2024-01-15T10:30:00')
  //   },
  //   {
  //     id: 2,
  //     actionType: 'UPDATE',
  //     fullName: 'Donald Duck',
  //     description: 'User Donald Duck updated the inventory count for warehouse A. Stock levels for item #345 and #678 were adjusted.',
  //     createdAt: new Date('2024-01-16T14:45:00')
  //   },
  //   {
  //     id: 3,
  //     actionType: 'DELETE',
  //     fullName: 'Goofy Goof',
  //     description: 'User Goofy Goof deleted an old project file named "Legacy_Project_X.zip" from the archive server.',
  //     createdAt: new Date('2024-01-17T09:00:00')
  //   }
  // ];
  // filteredLogs: any[] = [];
  // // Property to hold the selected log for detailed view
  // selectedLog: any | null = null;

  constructor(private auditLogService: AuditLogsService) { }
  logs: AuditLogs[] = [];
  filteredLogs: any[] = [];
  selectedLog: AuditLogs | null = null; // Property to hold the selected log for detailed view

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.auditLogService.getAuditLogs().subscribe(
      (data) => {
        this.logs = data.map(log => ({
          ...log,
          createdAt: new Date(log.created_at) // Convert string to Date object
        }));
        this.filteredLogs = [...this.logs]; // Initialize filtered logs
      })
  }

  filterLogs() {
    if (!this.searchTerm.trim()) {
      this.filteredLogs = [...this.logs];
      return;
    }

    const searchLower = this.searchTerm.toLowerCase();
    this.filteredLogs = this.logs.filter(log =>
      log.action?.toLowerCase().includes(searchLower) ||
      log.full_name?.toString().toLowerCase().includes(searchLower) 
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