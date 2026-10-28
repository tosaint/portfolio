/**
 * Google Apps Script 收件端 v2.0（對應 study.js v2.0：視覺邊界四方案）
 * 部署：試算表 → 擴充功能 → Apps Script → 貼上本檔 → 部署為網頁應用程式（執行身分：我；存取：任何人）
 * 開啟部署網址應回傳 {"ok":true,"service":"toilet-study","version":"2.0"}，再把網址填入 study.json 的 endpoint。
 *
 * 每次 POST 是一個分段（part = main 或 night），內容：participant、ratings、marks、pretestChecks、events。
 * 以唯一鍵「更新或新增」（upsert），同一筆重送不會產生重複列：
 *   participants   studyId|pid
 *   ratings        studyId|pid|trialId|checkpoint|questionId
 *   marks          studyId|pid|trialId
 *   pretestChecks  studyId|pid|trialId|questionId
 *   events         eventId
 * 新欄位會自動加到表頭最右邊。第一欄 _key 為唯一鍵，請勿手動修改。
 */
const ALLOWED_STUDY_IDS = ['haru-boundary'];
const SERVICE = 'toilet-study';

function doGet() {
  return json_({ ok: true, service: SERVICE, version: '2.0' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'invalid JSON' }); }
  if (!d || d.kind !== 'toilet-study-part') return json_({ ok: false, error: 'unknown payload kind' });
  if (ALLOWED_STUDY_IDS.indexOf(d.studyId) < 0) return json_({ ok: false, error: 'studyId not allowed' });
  if (!/^[0-9a-f]{12}$/.test(String(d.pid || ''))) return json_({ ok: false, error: 'invalid pid' });
  if (['main', 'night'].indexOf(d.part) < 0) return json_({ ok: false, error: 'invalid part' });
  const same = r => r && r.studyId === d.studyId && r.pid === d.pid;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'busy, retry' });
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const p = Object.assign({}, d.participant || {}, { lastPart: d.part, lastReceivedAt: new Date().toISOString() });
    p[d.part + 'ReceivedAt'] = p.lastReceivedAt;
    if (!same(p)) return json_({ ok: false, error: 'participant mismatch' });
    upsert_(ss, 'participants', [p], r => [r.studyId, r.pid].join('|'));
    upsert_(ss, 'ratings', (d.ratings || []).filter(same), r => [r.studyId, r.pid, r.trialId, r.checkpoint, r.questionId].join('|'));
    upsert_(ss, 'marks', (d.marks || []).filter(same), r => [r.studyId, r.pid, r.trialId].join('|'));
    upsert_(ss, 'pretestChecks', (d.pretestChecks || []).filter(same), r => [r.studyId, r.pid, r.trialId || 'end', r.questionId].join('|'));
    upsert_(ss, 'events', (d.events || []).filter(same), r => r.eventId);
    return json_({ ok: true, part: d.part, counts: { ratings: (d.ratings || []).length, marks: (d.marks || []).length, events: (d.events || []).length } });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function upsert_(ss, name, rows, keyFn) {
  if (!rows.length) return;
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  let headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (!headers.length) headers = ['_key'];
  const flat = rows.map(r => {
    const o = {};
    Object.keys(r).forEach(k => { const v = r[k]; o[k] = (v !== null && typeof v === 'object') ? JSON.stringify(v) : v; });
    o._key = keyFn(r);
    return o;
  });
  flat.forEach(o => Object.keys(o).forEach(k => { if (headers.indexOf(k) < 0) headers.push(k); }));
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  const last = sh.getLastRow();
  const keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(x => String(x[0])) : [];
  const appends = [];
  flat.forEach(o => {
    const line = headers.map(h => (o[h] === undefined || o[h] === null) ? '' : o[h]);
    const i = keys.indexOf(o._key);
    if (i >= 0) sh.getRange(i + 2, 1, 1, headers.length).setValues([line]);
    else { appends.push(line); keys.push(o._key); }
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, headers.length).setValues(appends);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
