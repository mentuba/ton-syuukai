const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBMISSIONS_PATH = path.join(DATA_DIR, 'submissions.json');
const TERRORS_PATH = path.join(DATA_DIR, 'terrors.json');
const ALTERNATE_PATH = path.join(DATA_DIR, 'alternate.json');

// カテゴリ定義: cracked / ghost は terrors.json、alternate は alternate.json を使用
const CATEGORIES = {
  cracked: { label: 'Cracked', listFile: TERRORS_PATH },
  ghost: { label: 'Ghost', listFile: TERRORS_PATH },
  alternate: { label: 'Alternate', listFile: ALTERNATE_PATH },
};

function ensureSubmissionsFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUBMISSIONS_PATH)) {
    const initial = { currentSession: null, sessions: {} };
    fs.writeFileSync(SUBMISSIONS_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function loadSubmissions() {
  ensureSubmissionsFile();
  const raw = fs.readFileSync(SUBMISSIONS_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveSubmissions(data) {
  ensureSubmissionsFile();
  fs.writeFileSync(SUBMISSIONS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function loadTerrorList(category) {
  const conf = CATEGORIES[category];
  if (!conf) throw new Error(`不明なカテゴリ: ${category}`);
  const raw = fs.readFileSync(conf.listFile, 'utf8');
  return JSON.parse(raw);
}

// 今日の日付を YYYY-MM-DD 形式で返す（サーバーのローカルタイムゾーン基準）
function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getActiveSession(data) {
  const date = data.currentSession;
  if (!date) return null;
  const session = data.sessions[date];
  if (!session || session.closed) return null;
  return { date, session };
}

function ensureCategoryBucket(session, category) {
  if (!session[category]) session[category] = {};
  return session[category];
}

// 開催日の一覧を新しい順で返す
function listSessionDates(data) {
  return Object.keys(data.sessions).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

// 指定した日付のセッションを返す（存在しない場合は null）
function getSessionByDate(data, date) {
  const session = data.sessions[date];
  if (!session) return null;
  return { date, session };
}

module.exports = {
  CATEGORIES,
  loadSubmissions,
  saveSubmissions,
  loadTerrorList,
  todayString,
  getActiveSession,
  ensureCategoryBucket,
  listSessionDates,
  getSessionByDate,
};
