import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// Set pdfMake fonts to use the embedded Roboto font
(pdfMake as any).vfs = pdfFonts.vfs;
(pdfMake as any).fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  }
};
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

  logs: any[] = [
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
      id: 2,
      actionType: 'DELETE',
      fullName: 'Donald Duck',
      description: 'User Donald Duck updated the inventory count for warehouse A. Stock levels for item #345 and #678 were adjusted.',
      createdAt: new Date('2025-05-26T14:45:00')
    },
    {
      id: 2,
      actionType: 'DELETE',
      fullName: 'Donald Duck',
      description: 'quack quack quack quack quack quack quack quack quack quack quack quack quack quack quack',
      createdAt: new Date('2025-05-26T14:45:00')
    },
    {
      id: 2,
      actionType: 'CREATE',
      fullName: 'Donald Duck',
      description: 'BLAHHHHHHBLAHBLAHHHH',
      createdAt: new Date('2025-05-26T14:45:00')
    },
    {
      id: 3,
      actionType: 'DELETE',
      fullName: 'Goofy Goof',
      description: 'User Goofy Goof deleted an old project file named "Legacy_Project_X.zip" from the archive server.',
      createdAt: new Date('2024-01-17T09:00:00')
    }
  ];


  constructor(private auditLogService: AuditLogsService) { }
  logs: AuditLogs[] = [];
  filteredLogs: any[] = [];
  selectedLog: any | null = null;
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

  showDetails(log: any) {
    this.selectedLog = log;
  }

  closeDetails() {
    this.selectedLog = null;
  }

  private getLogsForThisWeek(): any[] {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.logs.filter(log => {
      const created = new Date(log.createdAt);
      return created >= startOfWeek && created <= endOfWeek;
    });
  }

  exportToPDF() {
    const weeklyLogs = this.getLogsForThisWeek();

    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: `Weekly report of system logs`, style: 'header', alignment: 'center' },
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            body: [
              ['Action type', 'Full name', 'Description', 'Date created'],
              ...weeklyLogs.map(log => [
                log.actionType,
                log.fullName,
                log.description.length > 100 ? log.description.slice(0, 100) + '...' : log.description,
                new Date(log.createdAt).toLocaleString('he-IL')
              ])
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      defaultStyle: {
        font: 'Roboto',
        alignment: 'right'
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true
        }
      }
    };

    pdfMake.createPdf(docDefinition).download('audit_logs_weekly.pdf');
  }

  exportToCSV() {
    const weeklyLogs = this.getLogsForThisWeek();

    const csvData = weeklyLogs.map(log => ({
      actionType: log.actionType,
      fullName: log.fullName,
      description: log.description,
      createdAt: new Date(log.createdAt).toLocaleString('he-IL')
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'audit_logs_weekly.csv');
  }
}
