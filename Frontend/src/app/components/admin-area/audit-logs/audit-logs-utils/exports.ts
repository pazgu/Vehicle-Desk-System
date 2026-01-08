import { TDocumentDefinitions } from 'pdfmake/interfaces';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as XLSX from 'xlsx-js-style';
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
  pageSize: 'A4',
  pageOrientation: 'landscape',
  pageMargins: [20, 20, 20, 20],

  content: [
    { text: `Audit Logs Report`, style: 'header', alignment: 'center' },
    { text: `Created: ${timestamp}`, style: 'subheader', alignment: 'center' },

    {
  table: {
    headerRows: 1,
    widths: [90, 140, 110, 120, 120],
    body: body,
  },
  layout: {
    fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f2f2f2' : null),
  },
  fontSize: 10,

  margin: [60, 0, 60, 0],
} as any,

  ],

  defaultStyle: { font: 'Roboto', fontSize: 10 },
  styles: {
    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
    subheader: { fontSize: 12, margin: [0, 0, 0, 20] },
    legendHeader: { fontSize: 14, bold: true, color: '#942222' },
    tableHeader: { fontSize: 11, bold: true, alignment: 'center' },
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

const COLOR_LEGEND: Array<{ color: string; meaning: string }> = [
  { color: '#60cd79', meaning: 'Approved / Completed' },
  { color: '#dcf1e1', meaning: 'Success Operation' },
  { color: '#e2f0f8', meaning: 'Frozen' },
  { color: '#ffe5b4', meaning: 'Active (In Progress / In Use)' },
  { color: '#fbf3da', meaning: 'Pending' },
  { color: '#dc5b5b', meaning: 'Rejected' },
  { color: '#feaf66', meaning: 'Emergency Event' },
  { color: '#f8e2e2', meaning: 'Deleted' },
  { color: '#e0d6e8', meaning: 'Cancelled - No Show' },
  { color: '#cdb69b', meaning: 'Monthly Limit Exceeded' },
];


function getStatusMeaning(log: any) {
  const statusLabel = getEnglishStatusLabel(log);
  return statusLabel || 'Unknown';
}

export async function exportToExcel(filteredLogs: any[]) {
  const timestamp = new Date().toLocaleString('en-GB').replace(/[/:]/g, '-');

  const sortedLogs = [...filteredLogs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const legendRows = [
  ['# Color Legend (Row background colors used in PDF/Excel)'],
  ['Color', 'Meaning'],
  ...COLOR_LEGEND.map((x) => ['', x.meaning]),
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

  const dataRows = sortedLogs.map((log) => [
    log.action,
    getStatusMeaning(log),
    log.full_name || '—',
    log.entity_type || '—',
    getEnglishStatusLabel(log),
    new Date(log.created_at).toLocaleString('en-GB'),
  ]);

  const fullSheet: any[][] = [...legendRows, headers, ...dataRows];

  const ws = XLSX.utils.aoa_to_sheet(fullSheet);

const legendTitleRow = 0;
const legendHeaderRow = 1;

const titleCell = ws[XLSX.utils.encode_cell({ r: legendTitleRow, c: 0 })];
if (titleCell) {
  titleCell.s = {
    font: { bold: true, sz: 13, color: { rgb: '942222' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };
}

for (let c = 0; c < 2; c++) {
  const ref = XLSX.utils.encode_cell({ r: legendHeaderRow, c });
  const cell = ws[ref];
  if (!cell) continue;

  cell.s = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '103E76' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
}

const firstLegendItemRow = 2; 
for (let i = 0; i < COLOR_LEGEND.length; i++) {
  const r = firstLegendItemRow + i;
  const color = COLOR_LEGEND[i].color.replace('#', '').toUpperCase();
  const refColorCell = XLSX.utils.encode_cell({ r, c: 0 });
  const refMeaningCell = XLSX.utils.encode_cell({ r, c: 1 });

  if (ws[refColorCell]) {
    ws[refColorCell].s = {
      fill: { patternType: 'solid', fgColor: { rgb: `FF${color}` } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  if (ws[refMeaningCell]) {
    ws[refMeaningCell].s = {
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    };
  }
}


  const headerRowIndex = legendRows.length;

  (ws as any)['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 1 };

  headers.forEach((_, colIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex });
    const cell = ws[cellRef];
    if (!cell) return;

    cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '103E76' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
  });

  // ✅ Apply styles + wrap + row colors for data rows
  const startDataRow = headerRowIndex + 1;

  for (let r = startDataRow; r < fullSheet.length; r++) {
    const logIndex = r - startDataRow;
    const log = sortedLogs[logIndex];
    if (!log) continue;

    const bgHex = getRowBackgroundColor(log).replace('#', '').toUpperCase();
    const fillColor = `FF${bgHex}`;

    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (!cell) continue;

      cell.s = {
        ...(cell.s || {}),
        fill: { patternType: 'solid', fgColor: { rgb: fillColor } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      };
    }
  }

  // ✅ Auto-fit columns (no cropping)
  autoFitColumnsAOA(ws, fullSheet, 55);

  // ✅ Row heights (so wrapped text shows instead of being hidden)
  applyRowHeights(ws, fullSheet, 18, 60);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');

  const wbout = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
  });

  saveAs(
    new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    }),
    `audit_logs_${timestamp}.xlsx`
  );
}

function autoFitColumnsAOA(ws: XLSX.WorkSheet, aoa: any[][], maxWch = 55) {
  const colCount = Math.max(...aoa.map((r) => r.length), 0);

  const widths = new Array(colCount).fill(10).map((_, c) => {
    let maxLen = 10;

    for (let r = 0; r < aoa.length; r++) {
      const val = aoa[r]?.[c];
      const str = val === null || val === undefined ? '' : String(val);
      maxLen = Math.max(maxLen, str.length);
    }

    return { wch: Math.min(maxLen + 3, maxWch) };
  });

  (ws as any)['!cols'] = widths;
}

function applyRowHeights(
  ws: XLSX.WorkSheet,
  aoa: any[][],
  baseHeight = 18,
  maxHeight = 60
) {
  const rows = aoa.map((row) => {
    const longest = Math.max(
      ...row.map((v) => (v === null || v === undefined ? 0 : String(v).length)),
      0
    );

    const lines = Math.max(1, Math.ceil(longest / 40));
    const hpt = Math.min(baseHeight * lines, maxHeight);

    return { hpt };
  });

  (ws as any)['!rows'] = rows;
}

