import { escapeHtml } from './Utils.js';

/**
 * Simple Markdown-to-HTML parser that supports headers, bold, italics, lists, and tables.
 */
export function parseMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML first to prevent XSS
  let html = escapeHtml(text);
  
  // Replace headers: ###, ##, #
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italics: *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Split into trimmed, non-empty lines
  const lines = html.split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
  let inList = false;
  let result = [];
  
  function isSeparatorRow(line) {
    if (!line.startsWith('|') || !line.endsWith('|') || line.length <= 2) return false;
    const inner = line.slice(1, -1);
    return /^[:\-\s\|]+$/.test(inner) && inner.includes('-');
  }
  
  function parseTableCells(line) {
    return line.slice(1, -1).split('|').map(cell => cell.trim());
  }
  
  function parseAlignments(line) {
    return parseTableCells(line).map(cell => {
      const alignLeft = cell.startsWith(':');
      const alignRight = cell.endsWith(':');
      if (alignLeft && alignRight) return 'center';
      if (alignRight) return 'right';
      if (alignLeft) return 'left';
      return '';
    });
  }
  
  function generateTableHtml(headers, rows, alignments) {
    let tableHtml = '<table class="md-table">';
    tableHtml += '<thead><tr>';
    headers.forEach((header, idx) => {
      const align = alignments[idx] ? ` style="text-align: ${alignments[idx]}"` : '';
      tableHtml += `<th${align}>${header}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    rows.forEach(row => {
      tableHtml += '<tr>';
      for (let idx = 0; idx < headers.length; idx++) {
        const cell = row[idx] !== undefined ? row[idx] : '';
        const align = alignments[idx] ? ` style="text-align: ${alignments[idx]}"` : '';
        tableHtml += `<td${align}>${cell}</td>`;
      }
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if it's a table
    if (line.startsWith('|') && line.endsWith('|')) {
      if (i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        
        const headers = parseTableCells(line);
        const alignments = parseAlignments(lines[i + 1]);
        const rows = [];
        
        let j = i + 2;
        while (j < lines.length && lines[j].startsWith('|') && lines[j].endsWith('|')) {
          if (isSeparatorRow(lines[j])) {
            break;
          }
          rows.push(parseTableCells(lines[j]));
          j++;
        }
        
        result.push(generateTableHtml(headers, rows, alignments));
        i = j - 1;
        continue;
      }
    }
    
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      const content = line.substring(2).trim();
      result.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (line.startsWith('<h') || line.startsWith('<table')) {
        result.push(line);
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }
  
  if (inList) {
    result.push('</ul>');
  }
  
  return result.join('\n');
}
