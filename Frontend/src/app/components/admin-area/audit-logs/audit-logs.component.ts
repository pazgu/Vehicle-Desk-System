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
      id: 3,
      actionType: 'DELETE',
      fullName: 'Goofy Goof',
      description: 'User Goofy Goof deleted an old project file named "Legacy_Project_X.zip" from the archive server.',
      createdAt: new Date('2024-01-17T09:00:00')
    }
  ];

  filteredLogs: any[] = [];
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

  showDetails(log: any) {
    this.selectedLog = log;
  }

  closeDetails() {
    this.selectedLog = null;
  }

  exportToPDF() {
    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: `Weekly report of system logs`, style: 'header', alignment: 'center' },
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            body: [
              ['Action type', 'Full name', 'Description', 'Date created'],
              ...this.filteredLogs.map(log => [
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
    const csvData = this.filteredLogs.map(log => ({
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