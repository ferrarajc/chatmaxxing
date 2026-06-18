/**
 * Validate the generated CSV by re-parsing it (RFC-4180) and checking:
 *  - every record has exactly the header's column count
 *  - hierarchy referential integrity (Parent ID / Epic Link / Parent Link resolve)
 *  - no non-ASCII bytes (avoids import mojibake)
 * Run:  node validate-backlog.mjs
 */
import { readFileSync } from 'node:fs';

const file = new URL('./vanguard-backlog.csv', import.meta.url);
const text = readFileSync(file, 'utf8');

// Non-ASCII scan (would break some Jira importers / Excel-on-Windows).
const nonAscii = [...text].filter(c => c.charCodeAt(0) > 126);
if (nonAscii.length) {
  console.error('NON-ASCII characters found:', [...new Set(nonAscii)].slice(0, 20));
} else {
  console.log('OK: file is pure ASCII');
}

// Minimal RFC-4180 parser.
function parseCsv(s) {
  const records = [];
  let field = '', record = [], inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { record.push(field); records.push(record); field = ''; record = []; }
    else field += c;
  }
  if (field.length || record.length) { record.push(field); records.push(record); }
  return records;
}

const recs = parseCsv(text);
const header = recs[0];
const data = recs.slice(1).filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
console.log(`Header columns: ${header.length}`);
console.log(`Data records: ${data.length}`);

const col = name => header.indexOf(name);
const TYPE = col('Issue Type'), ID = col('Issue ID'), PID = col('Parent ID'),
  ELINK = col('Epic Link'), ENAME = col('Epic Name'), PLINK = col('Parent Link'),
  PARENT = col('Parent');

let bad = 0;
for (const [n, r] of data.entries()) {
  if (r.length !== header.length) {
    console.error(`Row ${n + 2}: has ${r.length} columns, expected ${header.length} (${r[ID]} ${r[TYPE]})`);
    bad++;
  }
}

const ids = new Map(data.map(r => [r[ID], r]));
const epicNames = new Set(data.filter(r => r[TYPE] === 'Epic').map(r => r[ENAME]));
const featureIds = new Set(data.filter(r => r[TYPE] === 'Feature').map(r => r[ID]));
const storyIds = new Set(data.filter(r => r[TYPE] === 'Story').map(r => r[ID]));

for (const r of data) {
  if (r[TYPE] === 'Sub-task' && !storyIds.has(r[PID])) {
    console.error(`Sub-task ${r[ID]} Parent ID ${r[PID]} does not match a Story`); bad++;
  }
  if (r[TYPE] === 'Story' && r[ELINK] && !epicNames.has(r[ELINK])) {
    console.error(`Story ${r[ID]} Epic Link "${r[ELINK]}" does not match an Epic Name`); bad++;
  }
  if (r[TYPE] === 'Epic' && r[PLINK] && !featureIds.has(r[PLINK])) {
    console.error(`Epic ${r[ID]} Parent Link ${r[PLINK]} does not match a Feature`); bad++;
  }
  // Unified Parent column: every non-feature row must point at an existing Issue ID,
  // and at the correct level (epic->feature, story->epic, subtask->story).
  if (r[TYPE] !== 'Feature') {
    const p = ids.get(r[PARENT]);
    if (!p) { console.error(`${r[TYPE]} ${r[ID]} Parent ${r[PARENT]} does not resolve`); bad++; }
    else {
      const want = r[TYPE] === 'Epic' ? 'Feature' : r[TYPE] === 'Story' ? 'Epic' : 'Story';
      if (p[TYPE] !== want) { console.error(`${r[TYPE]} ${r[ID]} Parent ${r[PARENT]} is a ${p[TYPE]}, expected ${want}`); bad++; }
    }
  }
}

// Every Epic Link should be used by >=1 story is not required; but every Story must have one.
for (const r of data) {
  if (r[TYPE] === 'Story' && !r[ELINK]) { console.error(`Story ${r[ID]} has no Epic Link`); bad++; }
  if (r[TYPE] === 'Epic' && !r[ENAME]) { console.error(`Epic ${r[ID]} has no Epic Name`); bad++; }
}

const counts = data.reduce((m, r) => ((m[r[TYPE]] = (m[r[TYPE]] || 0) + 1), m), {});
console.log('Counts by type:', counts);
console.log(bad === 0 ? 'OK: all structural + referential checks passed' : `FAILED: ${bad} problem(s)`);
process.exit(bad === 0 ? 0 : 1);
