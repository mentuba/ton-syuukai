const { CATEGORIES } = require('./dataStore');

// セッションのカテゴリ群から縦持ち（1行=1提出）のレコード配列を作る
// [{ date, category, discordUserId, discordDisplayName, terror }, ...]
function buildRecords(date, session, categoryKeys) {
  const records = [];
  for (const catKey of categoryKeys) {
    const bucket = session[catKey] || {};
    const label = CATEGORIES[catKey]?.label ?? catKey;
    for (const [userId, entry] of Object.entries(bucket)) {
      for (const terror of entry.terrors) {
        records.push({
          date,
          category: label,
          discordUserId: userId,
          discordDisplayName: entry.displayName,
          terror,
        });
      }
    }
  }
  return records;
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(records) {
  const header = ['date', 'category', 'discordUserId', 'discordDisplayName', 'terror'];
  const lines = [header.join(',')];
  for (const r of records) {
    lines.push(header.map((key) => csvEscape(r[key])).join(','));
  }
  // Excelでの文字化け対策としてBOMを付与
  return '\uFEFF' + lines.join('\n');
}

function toJSON(records) {
  return JSON.stringify(records, null, 2);
}

module.exports = { buildRecords, toCSV, toJSON };
