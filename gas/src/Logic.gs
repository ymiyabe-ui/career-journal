// シートに触れない純粋な処理。node のテストからも require できるようにしてある。

// 固定の列。これより右は入力項目ごとの列（項目IDが見出し）
var FIXED_HEADERS = ['id', 'date', 'createdAt', 'updatedAt', 'deleted', 'syncedAt'];

var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
var FIELD_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/** アプリから届いた記録の形を確かめる。おかしいものは同期しない */
function isValidEntry(e) {
  if (!e || typeof e !== 'object') return false;
  if (typeof e.id !== 'string' || e.id !== e.date || !DATE_RE.test(e.date)) return false;
  if (!ISO_RE.test(String(e.createdAt)) || !ISO_RE.test(String(e.updatedAt))) return false;
  if (!e.fields || typeof e.fields !== 'object') return false;
  var keys = Object.keys(e.fields);
  for (var i = 0; i < keys.length; i++) {
    if (!FIELD_ID_RE.test(keys[i]) || typeof e.fields[keys[i]] !== 'string') return false;
  }
  return true;
}

/** 見出しが空なら固定列で始め、知らない項目IDの列を右に足す */
function ensureHeaders(headers, entries) {
  var out = headers.length ? headers.slice() : FIXED_HEADERS.slice();
  entries.forEach(function (e) {
    Object.keys(e.fields).forEach(function (k) {
      if (out.indexOf(k) === -1) out.push(k);
    });
  });
  return out;
}

function entryFromRow(headers, row) {
  var get = function (name) {
    var i = headers.indexOf(name);
    return i === -1 || row[i] == null ? '' : String(row[i]);
  };
  var fields = {};
  headers.forEach(function (h, i) {
    if (FIXED_HEADERS.indexOf(h) === -1 && h !== '') fields[h] = row[i] == null ? '' : String(row[i]);
  });
  var entry = {
    id: get('id'),
    date: get('date'),
    fields: fields,
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
    schemaVersion: 1,
  };
  if (get('deleted') === 'TRUE') entry.deleted = true;
  return entry;
}

function rowFromEntry(headers, entry, syncedAt) {
  return headers.map(function (h) {
    switch (h) {
      case 'id': return entry.id;
      case 'date': return entry.date;
      case 'createdAt': return entry.createdAt;
      case 'updatedAt': return entry.updatedAt;
      case 'deleted': return entry.deleted ? 'TRUE' : '';
      case 'syncedAt': return String(syncedAt);
      default: return entry.fields[h] || '';
    }
  });
}

/**
 * 届いた記録をシートの表に取り込み、since より後に変わった記録を返す。
 * 同じ日の記録は updatedAt が新しいほうを残す（アプリ側の pickNewer と同じ規則）。
 * syncedAt はサーバーの時刻（ミリ秒）。端末の時計のずれに左右されないよう、差分の目印にはこちらを使う。
 */
function applySync(table, incoming, since, now) {
  var valid = incoming.filter(isValidEntry);
  var headers = ensureHeaders(table.headers, valid);
  var idCol = headers.indexOf('id');
  var syncedCol = headers.indexOf('syncedAt');
  var rows = table.rows.map(function (r) {
    var copy = r.slice();
    while (copy.length < headers.length) copy.push('');
    return copy;
  });
  var index = {};
  rows.forEach(function (r, i) { index[String(r[idCol])] = i; });

  var accepted = 0;
  valid.forEach(function (e) {
    var i = index[e.id];
    if (i === undefined) {
      index[e.id] = rows.length;
      rows.push(rowFromEntry(headers, e, now));
      accepted++;
    } else if (entryFromRow(headers, rows[i]).updatedAt < e.updatedAt) {
      rows[i] = rowFromEntry(headers, e, now);
      accepted++;
    }
  });

  var changed = rows
    .filter(function (r) { return Number(r[syncedCol]) > since; })
    .map(function (r) { return entryFromRow(headers, r); });

  return {
    table: { headers: headers, rows: rows },
    changed: changed,
    accepted: accepted,
    rejected: incoming.length - valid.length,
  };
}

/** 日本時間で、dayStartHour 時を1日の区切りにした「今日」 */
function logicalTodayJst(now, dayStartHour) {
  return new Date(now.getTime() + (9 - dayStartHour) * 3600 * 1000).toISOString().slice(0, 10);
}

function hasEntryOn(table, date) {
  return table.rows.some(function (r) {
    var e = entryFromRow(table.headers, r);
    if (e.date !== date || e.deleted) return false;
    return Object.keys(e.fields).some(function (k) { return e.fields[k].trim() !== ''; });
  });
}

var SETTINGS_WINS_ID = 'wins';

function validThresholds_(a) {
  if (!Array.isArray(a) || a.length < 1 || a.length > 10) return false;
  return a.every(function (n) { return typeof n === 'number' && n % 1 === 0 && n >= 1 && n <= 9999; });
}

/** アプリの設定（入力項目・バッジのしきい値）の形を確かめる。おかしいものは保存しない */
function isValidSettings(s) {
  if (!s || typeof s !== 'object') return false;
  if (typeof s.updatedAt !== 'string' || !ISO_RE.test(s.updatedAt)) return false;
  if (!Array.isArray(s.fields) || s.fields.length < 1 || s.fields.length > 12) return false;
  var seen = {};
  for (var i = 0; i < s.fields.length; i++) {
    var f = s.fields[i];
    if (!f || typeof f.id !== 'string' || !FIELD_ID_RE.test(f.id) || seen[f.id]) return false;
    if (typeof f.label !== 'string' || f.label.trim() === '' || f.label.length > 40) return false;
    if (f.placeholder != null && typeof f.placeholder !== 'string') return false;
    seen[f.id] = true;
  }
  if (s.fields[0].id !== SETTINGS_WINS_ID || s.fields[0].hidden) return false;
  if (!validThresholds_(s.streakMilestones) || !validThresholds_(s.totalMilestones)) return false;
  return JSON.stringify(s).length < 5000;
}

/** 設定は更新時刻が新しいほうを残す。届いたものが不正なら何も変えない */
function mergeSettings(stored, incoming) {
  var current = isValidSettings(stored) ? stored : null;
  if (!isValidSettings(incoming)) return { settings: current, changed: false };
  if (!current || current.updatedAt < incoming.updatedAt) return { settings: incoming, changed: true };
  return { settings: current, changed: false };
}

if (typeof module !== 'undefined') {
  module.exports = {
    FIXED_HEADERS: FIXED_HEADERS, isValidEntry: isValidEntry, ensureHeaders: ensureHeaders,
    entryFromRow: entryFromRow, rowFromEntry: rowFromEntry, applySync: applySync,
    logicalTodayJst: logicalTodayJst, hasEntryOn: hasEntryOn,
    isValidSettings: isValidSettings, mergeSettings: mergeSettings };
}
