// Career Journal の同期サーバー。アプリから text/plain の JSON を POST で受ける。
// スクリプトプロパティ：
//   SHARED_SECRET  … 合言葉。アプリの設定画面に同じ値を入れる（setup で自動作成）
//   SPREADSHEET_ID … 記録を溜めるスプレッドシート（setup で自動作成）
//   APP_URL        … リマインドメールに載せるアプリのURL（任意）
//   REMIND_HOUR    … リマインドの時刻（任意、既定 21）

var SHEET_NAME = 'entries';
var SETTINGS_SHEET_NAME = 'settings';
var DAY_START_HOUR = 4;

function doGet() {
  return json_({ ok: true, app: 'career-journal' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!secret || body.token !== secret) return json_({ ok: false, error: 'unauthorized' });
  if (body.action !== 'sync') return json_({ ok: false, error: 'unknown_action' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var now = Date.now();
    var incoming = Array.isArray(body.entries) ? body.entries : [];
    var result = applySync(readTable_(sheet), incoming, Number(body.since) || 0, now);
    if (result.accepted > 0) writeTable_(sheet, result.table);
    // 設定（入力項目・バッジのしきい値）。古い版のアプリは settings を送らないので、無くても動く
    var settings = mergeSettings(readSettings_(), body.settings);
    if (settings.changed) writeSettings_(settings.settings);
    return json_({
      ok: true,
      serverTime: now,
      entries: result.changed,
      accepted: result.accepted,
      rejected: result.rejected,
      settings: settings.settings,
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 最初に1回だけエディタから実行する。スプレッドシートと合言葉がなければ作り、
 * 合言葉を実行ログに出す（アプリの設定画面に貼る）。リマインドのトリガーも作る。
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) {
    var ss = SpreadsheetApp.create('Career Journal');
    props.setProperty('SPREADSHEET_ID', ss.getId());
    Logger.log('スプレッドシートを作りました：' + ss.getUrl());
  }
  if (!props.getProperty('SHARED_SECRET')) {
    props.setProperty('SHARED_SECRET', Utilities.getUuid().replace(/-/g, ''));
  }
  getSheet_();
  setupReminder();
  Logger.log('合言葉（アプリの設定画面に入れる）：' + props.getProperty('SHARED_SECRET'));
}

/** 毎日 REMIND_HOUR 時に remindIfMissing を動かすトリガーを作り直す */
function setupReminder() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'remindIfMissing') ScriptApp.deleteTrigger(t);
  });
  var hour = Number(PropertiesService.getScriptProperties().getProperty('REMIND_HOUR') || 21);
  ScriptApp.newTrigger('remindIfMissing').timeBased().atHour(hour).everyDays(1).create();
  Logger.log('リマインドを毎日 ' + hour + ' 時台に設定しました');
}

/** 今日の記録がまだなければ、自分あてにメールを送る */
function remindIfMissing() {
  var today = logicalTodayJst(new Date(), DAY_START_HOUR);
  if (hasEntryOn(readTable_(getSheet_()), today)) return;
  var url = PropertiesService.getScriptProperties().getProperty('APP_URL') || '';
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'Career Journal：今日の1行がまだです',
    body: '今日の達成を1行だけ書いて、連続記録をつなげましょう。\n' + (url ? '\n' + url + '\n' : ''),
  });
}

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID が未設定です。setup を実行してください');
  return SpreadsheetApp.openById(id);
}

/** 設定は「settings」シートの2行目に JSON で1つだけ置く */
function readSettings_() {
  var sheet = getSpreadsheet_().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;
  try {
    return JSON.parse(String(sheet.getRange(2, 2).getValue()));
  } catch (err) {
    return null;
  }
}

function writeSettings_(settings) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SETTINGS_SHEET_NAME) || ss.insertSheet(SETTINGS_SHEET_NAME);
  var range = sheet.getRange(1, 1, 2, 3);
  range.setNumberFormat('@');
  range.setValues([['key', 'value', 'updatedAt'], ['app', JSON.stringify(settings), settings.updatedAt]]);
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    writeTable_(sheet, { headers: FIXED_HEADERS.slice(), rows: [] });
    sheet.setFrozenRows(1);
    // 新規作成時に付いてくる空のシートは消す
    ss.getSheets().forEach(function (s) {
      if (s.getName() !== SHEET_NAME && s.getLastRow() === 0) ss.deleteSheet(s);
    });
  }
  return sheet;
}

function readTable_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return { headers: [], rows: [] };
  // 表示値で読む（日付の自動変換が起きていても文字列で受け取れる）
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  return { headers: values[0], rows: values.slice(1) };
}

function writeTable_(sheet, table) {
  var values = [table.headers].concat(table.rows);
  var range = sheet.getRange(1, 1, values.length, table.headers.length);
  // 書式を「書式なしテキスト」にしてから書く（2026-10-05 が日付に化けないように）
  range.setNumberFormat('@');
  range.setValues(values);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
