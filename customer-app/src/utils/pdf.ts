// Minimal, dependency-free PDF generator — produces a valid single-page (or multi-page)
// text PDF as a Blob and opens it in a new tab. Used so "View PDF" actually opens a real,
// downloadable/printable PDF instead of a placeholder. Text is forced to ASCII so the byte
// offsets in the xref table stay exact (a malformed xref breaks strict viewers).

function toAscii(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[•]/g, '*')
    .replace(/[·]/g, '-')
    .replace(/…/g, '...')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x20-\x7E]/g, '?');
}

function escapePdf(s: string): string {
  return toAscii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Greedy word-wrap to a character budget (Helvetica is narrow, so ~95 fits an 8.5" page). */
function wrap(text: string, max = 95): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > max) { out.push(line); line = word; }
      else line = (line ? line + ' ' : '') + word;
    }
    out.push(line);
  }
  return out;
}

/**
 * Open a simple text PDF in a new tab.
 * @param title    bold heading on the first page
 * @param paragraphs body text (each entry is a paragraph; '' yields a blank line)
 */
export function openTextPdf(title: string, paragraphs: string[]): void {
  const lines = wrap(paragraphs.join('\n'));

  // Content stream: title (Helvetica-Bold 18), then body (Helvetica 11, 15pt leading).
  const parts: string[] = [];
  parts.push(`BT /F2 18 Tf 72 740 Td (${escapePdf(title)}) Tj ET`);
  parts.push('BT /F1 11 Tf 72 706 Td 15 TL');
  lines.forEach(l => parts.push(`(${escapePdf(l)}) Tj T*`));
  parts.push('ET');
  const content = parts.join('\n');

  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(off => { pdf += `${String(off).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;

  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
