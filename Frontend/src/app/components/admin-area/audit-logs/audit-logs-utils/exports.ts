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

export async function exportToExcel(filteredLogs: any[]) {
  const timestamp = new Date().toLocaleString('en-GB').replace(/[/:]/g, '-');

  const legendRows = [
    ['Color', 'Meaning'],
    [' ', 'Approved / Completed'],
    [' ', 'Success Operation'],
    [' ', 'Frozen'],
    [' ', 'Active (In Progress / In Use)'],
    [' ', 'Pending'],
    [' ', 'Rejected'],
    [' ', 'Emergency Event'],
    [' ', 'Deleted'],
    [' ', 'Cancelled - No Show'],
    [' ', 'Monthly Limit Exceeded'],
  ];

  const legendColors = [
    '',
    '#60cd79',
    '#dcf1e1',
    '#e2f0f8',
    '#ffe5b4',
    '#fbf3da',
    '#dc5b5b',
    '#feaf66',
    '#f8e2e2',
    '#e0d6e8',
    '#cdb69b',
  ];

  const data = [
    ['Action', 'Full Name', 'Entity Type', 'Status', 'Date Created'],
    ...filteredLogs.map((log) => [
      log.action,
      log.full_name || '—',
      log.entity_type || '—',
      getEnglishStatusLabel(log),
      new Date(log.created_at).toLocaleString('en-GB'),
    ]),
  ];

  const bgColors = filteredLogs.map((log) => {
    const color = getRowBackgroundColor(log);
    return [color, color, color, color, color];
  });

  const fullSheet: any[][] = [...legendRows, [''], ...data];

  const wsData: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(fullSheet);

  const legendLength = legendRows.length;
  fullSheet.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });

      if (!wsData[cellRef]) return;

      if (rowIndex === legendLength) {
        wsData[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E0E0E0' } },
        };
        return;
      }

      if (rowIndex > 0 && rowIndex < legendLength && colIndex === 0) {
        wsData[cellRef].s = {
          fill: { fgColor: { rgb: legendColors[rowIndex].replace('#', '') } },
        };
        return;
      }

      if (rowIndex > legendLength) {
        const colorIndex = rowIndex - legendLength - 1;
        const bgColor = bgColors[colorIndex]?.[colIndex] || '#FFFFFF';
        wsData[cellRef].s = {
          fill: { fgColor: { rgb: bgColor.replace('#', '') } },
        };
      }
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Audit Logs');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([wbout], { type: 'application/octet-stream' }),
    `audit_logs_${timestamp}.xlsx`
  );
}
