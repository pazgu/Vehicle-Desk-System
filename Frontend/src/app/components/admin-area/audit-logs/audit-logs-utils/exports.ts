import { TDocumentDefinitions } from 'pdfmake/interfaces';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import * as Papa from 'papaparse';
import {
  getRowBackgroundColor,
  getEnglishStatusLabel,
} from '../audit-logs-utils/helpers'; 

export async function exportToPDF(filteredLogs: any[]) {
  const weeklyLogs = filteredLogs; 

  const timestamp = new Date().toLocaleString('en-GB');
  const safeTimestamp = timestamp.replace(/[/:]/g, '-');

  const body: any[] = [
    [
      { text: 'Action Type', style: 'tableHeader' },
      { text: 'Full Name', style: 'tableHeader' },
      { text: 'Entity Type', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Date Created', style: 'tableHeader' },
    ],
  ];

  weeklyLogs.forEach((log) => {
    const statusLabel = getEnglishStatusLabel(log);
    const bgColor = getRowBackgroundColor(log);

    body.push([
      { text: log.action, fillColor: bgColor } as any,
      { text: log.full_name || '—', fillColor: bgColor } as any,
      { text: log.entity_type || '—', fillColor: bgColor } as any,
      { text: statusLabel, fillColor: bgColor } as any,
      {
        text: new Date(log.created_at).toLocaleString('en-GB'),
        fillColor: bgColor,
      } as any,
    ]);
  });

  const docDefinition: TDocumentDefinitions = {
    content: [
      { text: `Audit Logs Report`, style: 'header', alignment: 'center' },
      {
        text: `Created: ${timestamp}`,
        style: 'subheader',
        alignment: 'center',
      },
      {
        text: `Color Legend:`,
        style: 'legendHeader',
        alignment: 'left',
        margin: [0, 20, 0, 10],
      } as any,
      {
        table: {
          headerRows: 0,
          widths: ['auto', '*'],
          body: [
            [
              { text: '', fillColor: '#60cd79', margin: [0, 2] } as any,
              { text: 'Approved / Completed', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#dcf1e1', margin: [0, 2] } as any,
              { text: 'Success Operation', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#e2f0f8', margin: [0, 2] } as any,
              { text: 'Frozen', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#ffe5b4', margin: [0, 2] } as any,
              { text: 'Active (In Progress/In Use)', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#fbf3da', margin: [0, 2] } as any,
              { text: 'Pending', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#dc5b5b', margin: [0, 2] } as any,
              { text: 'Rejected', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#feaf66', margin: [0, 2] } as any,
              { text: 'Emergency Event', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#f8e2e2', margin: [0, 2] } as any,
              { text: 'Deleted', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#e0d6e8', margin: [0, 2] } as any,
              { text: 'Cancelled - No Show', fontSize: 10 } as any,
            ],
            [
              { text: '', fillColor: '#cdb69b', margin: [0, 2] } as any,
              { text: 'Monthly Limit Exceeded', fontSize: 10 } as any,
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20],
      } as any,
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', '*', '*', 'auto'],
          body: body,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f2f2f2' : null),
        },
      } as any,
    ],
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 12, margin: [0, 0, 0, 20] },
      legendHeader: { fontSize: 14, bold: true, color: '#942222' },
      tableHeader: { fontSize: 12, bold: true, alignment: 'center' },
    },
  };

  pdfMake.createPdf(docDefinition).download(`audit_logs_${safeTimestamp}.pdf`);
}

export async function exportToCSV(filteredLogs: any[]) {
  const timestamp = new Date().toLocaleString('en-GB').replace(/[/:]/g, '-');

  const legendRows = [
    ['# Color Legend (Row background colors used in PDF/Excel):'],
    ['Color', 'Meaning'],
    ['#60cd79', 'Approved / Completed'],
    ['#dcf1e1', 'Success Operation'],
    ['#e2f0f8', 'Frozen'],
    ['#ffe5b4', 'Active (In Progress / In Use)'],
    ['#fbf3da', 'Pending'],
    ['#dc5b5b', 'Rejected'],
    ['#feaf66', 'Emergency Event'],
    ['#f8e2e2', 'Deleted'],
    ['#e0d6e8', 'Cancelled - No Show'],
    ['#cdb69b', 'Monthly Limit Exceeded'],
    [''],
  ];

  const headers = [
    'Action',
    'Full Name',
    'Entity Type',
    'Status',
    'Date Created',
    'Row Color',
  ];

  const dataRows = filteredLogs.map((log) => {
    const statusLabel = getEnglishStatusLabel(log);
    const bgColor = getRowBackgroundColor(log);

    return [
      log.action,
      log.full_name || '—',
      log.entity_type || '—',
      statusLabel,
      new Date(log.created_at).toLocaleString('en-GB'),
      bgColor,
    ];
  });

  const csv = Papa.unparse({
    fields: [],
    data: [...legendRows, headers, ...dataRows],
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `audit_logs_colored_${timestamp}.csv`);
}


const STATUS_LEGEND: Record<string, string> = {
  approved: 'Approved / Completed',
  success: 'Success Operation',
  frozen: 'Frozen',
  active: 'Active (In Progress / In Use)',
  pending: 'Pending',
  rejected: 'Rejected',
  emergency: 'Emergency Event',
  deleted: 'Deleted',
  cancelled_no_show: 'Cancelled - No Show',
  monthly_limit: 'Monthly Limit Exceeded',

  cancelled_vehicle_unavailable: 'Ride Cancelled - Vehicle Unavailable',
};

function getStatusMeaning(log: any) {
  const status = getEnglishStatusLabel(log); 
  return STATUS_LEGEND[status] || status || 'Unknown';
}

export async function exportToExcel(filteredLogs: any[]) {
  const timestamp = new Date().toLocaleString('en-GB').replace(/[/:]/g, '-');

  const legendRows = [
    ['# Legend (Status Meaning)'],
    ['Status Code', 'Meaning'],
    ...Object.entries(STATUS_LEGEND).map(([code, meaning]) => [code, meaning]),
    [''], 
  ];

  const headers = [
    'Action',
    'Action Meaning', 
    'Full Name',
    'Entity Type',
    'Status',
    'Date Created',
  ];

  const dataRows = filteredLogs.map((log) => [
    log.action,
    getStatusMeaning(log), 
    log.full_name || '—',
    log.entity_type || '—',
    getEnglishStatusLabel(log),
    new Date(log.created_at).toLocaleString('en-GB'),
  ]);

  const fullSheet: any[][] = [...legendRows, headers, ...dataRows];

  const ws = XLSX.utils.aoa_to_sheet(fullSheet);

  const headerRowIndex = legendRows.length;
  headers.forEach((_, colIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex });
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([wbout], { type: 'application/octet-stream' }),
    `audit_logs_${timestamp}.xlsx`
  );
}
