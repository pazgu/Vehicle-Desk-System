// src/app/audit-logs/audit-logs.component.ts
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
import { AuditLogs } from '../../../models/audit-logs/audit-logs.module'; // Ensure this path is correct

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
  objectKeys = Object.keys; // Still useful if you need to iterate over object keys dynamically

  constructor(private auditLogService: AuditLogsService) { }
  logs: AuditLogs[] = [];
  filteredLogs: AuditLogs[] = []; // Type this correctly
  selectedLog: AuditLogs | null = null; // Property to hold the selected log for detailed view

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.auditLogService.getAuditLogs().subscribe(
      (data) => {
        this.logs = data.map(log => ({
          ...log,
          // 'createdAt' property was not used in the provided JSON,
          // sticking to 'created_at' as per your API response for consistency
          // If you need a Date object, you can add it:
          // createdAt: new Date(log.created_at)
        }));
        this.filteredLogs = [...this.logs]; // Initialize filtered logs
      });
  }

  filterLogs() {
    if (!this.searchTerm.trim()) {
      this.filteredLogs = [...this.logs];
      return;
    }

    const searchLower = this.searchTerm.toLowerCase();
    this.filteredLogs = this.logs.filter(log =>
      log.action?.toLowerCase().includes(searchLower) ||
      log.entity_type?.toLowerCase().includes(searchLower) || // Added entity_type to search
      log.entity_id?.toLowerCase().includes(searchLower) || // Added entity_id to search
      log.full_name?.toString().toLowerCase().includes(searchLower)
    );
  }

  // Method to show details of a selected log
  showDetails(log: AuditLogs) { // Type the 'log' parameter
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
