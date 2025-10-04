
/**
 * Modererat kommentarsflöde – Apps Script Web App
 * Sheet-struktur (bladnamn: "Comments"):
 * timestamp | name | comment | approved
 */

const SHEET_NAME = 'Comments';
const ADMIN_TOKEN = '0924caec289cfc505292708280150e009cd4bc8c655a73da01a08f3cee81101b';
const NOTIFY_TO = 'klassforaldrar.s7tills9.vittra@gmail.com';
const ALLOWED_ORIGINS = ["https://klassforaldrars7tills9vittra.github.io"];

function ensureSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if(!sh){ sh = ss.insertSheet(SHEET_NAME); sh.appendRow(['timestamp','name','comment','approved']); }
  return sh;
}

function doOptions(e){
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(corHeaders_(e));
}

function doGet(e){
  const p = e && e.parameter || {};
  const action = (p.action||'').toLowerCase();
  if(action === 'list') return handleList_(p, e);
  return json_({ ok:true, msg:'ok' }, e);
}

function doPost(e){
  const p = e && e.parameter ? e.parameter : {};
  const action = (p.action||'').toLowerCase();
  if(action === 'submit') return handleSubmit_(p, e);
  if(action === 'moderate') return handleModerate_(p, e);
  return json_({ ok:false, error:'unknown_action' }, e, 400);
}

function handleList_(p, e){
  const status = (p.status||'approved').toLowerCase();
  const limit = Math.max(1, Math.min(500, Number(p.limit||50)));
  const token = p.token||'';
  const sh = ensureSheet_();
  const rng = sh.getDataRange().getValues();
  const head = rng.shift()||[];
  const idx = { ts: head.indexOf('timestamp'), name: head.indexOf('name'), comment: head.indexOf('comment'), approved: head.indexOf('approved') };

  const all = rng.map((r,i)=>({
    row: i+2,
    ts: r[idx.ts],
    name: String(r[idx.name]||''),
    comment: String(r[idx.comment]||''),
    approved: String(r[idx.approved]||'')
  })).sort((a,b)=> new Date(b.ts) - new Date(a.ts));

  let items;
  if(status === 'approved'){
    items = all.filter(r=>/^j/i.test(r.approved)).map(stripId_).slice(0, limit);
  } else if(status === 'pending'){
    if(!isAdminToken_(token)) return json_({ ok:false, error:'forbidden' }, e, 403);
    items = all.filter(r=>!/^j/i.test(r.approved)).slice(0, limit);
  } else {
    if(!isAdminToken_(token)) return json_({ ok:false, error:'forbidden' }, e, 403);
    items = all.slice(0, limit);
  }
  return json_({ ok:true, items });
}

function stripId_(r){ return { ts:r.ts, name:r.name, comment:r.comment }; }

function handleSubmit_(p, e){
  const name = String(p.name||'').trim().slice(0,60);
  const comment = String(p.comment||'').trim();
  if(comment.length < 3 || comment.length > 500){ return json_({ ok:false, error:'invalid_length' }, e, 400); }

  const sh = ensureSheet_();
  const ts = new Date();
  let who = name || '';
  if(!who){
    try { who = Session.getActiveUser().getEmail() || ''; } catch(err) {}
    if(!who) who = 'Anonym';
  }
  sh.appendRow([ts, who, comment, 'Nej']);

  try {
    const to = NOTIFY_TO || Session.getEffectiveUser().getEmail();
    if(to){
      const subj = 'Ny kommentar på Klassresesidan';
      const body = 'Ny kommentar väntar på godkännande:
' +
                   'Från: ' + who + '
' +
                   'Tid: ' + ts + '

' +
                   comment + '

' +
                   'Godkänn i Sheet (kolumn approved = Ja).';
      MailApp.sendEmail({ to, subject: subj, htmlBody: body.replace(/
/g,'<br>'), noReply: true });
    }
  } catch(err) { Logger.log('Mail error: ' + err); }

  return json_({ ok:true });
}

function handleModerate_(p, e){
  const token = p.token||''; if(!isAdminToken_(token)) return json_({ ok:false, error:'forbidden' }, e, 403);
  const op = (p.op||'').toLowerCase();
  const row = Number(p.row||0);
  if(!row || row<2) return json_({ ok:false, error:'bad_row' }, e, 400);
  const sh = ensureSheet_();
  if(op==='approve'){
    const col = findCol_(sh, 'approved');
    sh.getRange(row, col).setValue('Ja');
    return json_({ ok:true });
  } else if(op==='decline'){
    const col = findCol_(sh, 'approved');
    sh.getRange(row, col).setValue('Nej');
    return json_({ ok:true });
  } else if(op==='delete'){
    sh.deleteRow(row);
    return json_({ ok:true });
  }
  return json_({ ok:false, error:'bad_op' }, e, 400);
}

function findCol_(sh, headerName){
  const headers = sh.getRange(1,1,1, sh.getLastColumn()).getValues()[0];
  const i = headers.indexOf(headerName);
  if(i<0) throw new Error('header_not_found: '+headerName);
  return i+1;
}

function isAdminToken_(token){ return token && token === ADMIN_TOKEN; }

function json_(obj, e, status){
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  const headers = corHeaders_(e); if(status) headers['Status'] = String(status);
  out.setHeaders(headers);
  return out;
}

function corHeaders_(e){
  const origin = (e && e.parameter && e.parameter.origin) || '';
  const allow = ALLOWED_ORIGINS.indexOf('*')>=0 ? '*' : (ALLOWED_ORIGINS.indexOf(origin)>=0? origin: '');
  return {
    'Access-Control-Allow-Origin': allow || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '300'
  };
}
