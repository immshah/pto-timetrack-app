const STANDARD_WORKDAY_HOURS = Number(process.env.STANDARD_WORKDAY_HOURS || 8);

// Counts Mon-Fri days between two YYYY-MM-DD dates, inclusive.
function businessDaysBetween(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function ptoHoursForRange(startStr, endStr) {
  return businessDaysBetween(startStr, endStr) * STANDARD_WORKDAY_HOURS;
}

function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => esc(row[c.key])).join(','));
  return [header, ...lines].join('\n');
}

module.exports = { STANDARD_WORKDAY_HOURS, businessDaysBetween, ptoHoursForRange, toCsv };
