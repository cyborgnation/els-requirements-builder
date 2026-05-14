export function extractTables(html: string): Record<string, string>[][] {
  const tables: Record<string, string>[][] = [];
  const tableRegex = /<table[\s\S]*?>([\s\S]*?)<\/table>/gi;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rows: Record<string, string>[] = [];

    // Extract headers
    const headers: string[] = [];
    const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
      headers.push(stripHtml(headerMatch[1]).trim());
    }

    // Extract rows
    const rowRegex = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let rowIndex = 0;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];

      // Skip header row
      if (rowHtml.includes("<th")) {
        continue;
      }

      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtml(cellMatch[1]).trim());
      }

      if (cells.length > 0) {
        const row: Record<string, string> = {};
        cells.forEach((cell, i) => {
          const key = headers[i] || `col_${i}`;
          row[key] = cell;
        });
        rows.push(row);
      }
      rowIndex++;
    }

    if (rows.length > 0) {
      tables.push(rows);
    }
  }

  return tables;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
