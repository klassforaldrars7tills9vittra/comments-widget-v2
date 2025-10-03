
// === Konfiguration ===
// 1) Byt denna till din Apps Script web app-URL (Deployment /exec)
const API_BASE = 'https://script.google.com/macros/s/AKfycbzwPDlPGKv42Uxki647OVzrMLje6G1c_WdArDIsiC5lG9KqrYGJsT4pU8t5HVlEy6ne8g/exec';
// 2) Valfritt: begränsa max antal hämtade kommentarer
const MAX_ITEMS = 50;

const els = {
  form: document.getElementById('commentForm'),
  name: document.getElementById('name'),
  comment: document.getElementById('comment'),
  charCount: document.getElementById('charCount'),
  sendBtn: document.getElementById('sendBtn'),
  clearBtn: document.getElementById('clearBtn'),
  feed: document.getElementById('feed'),
  status: document.getElementById('status'),
  formMsg: document.getElementById('formMsg'),
  refreshBtn: document.getElementById('refreshBtn')
};

function esc(s=''){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',''':'&#39;'}[c])); }
function now(){ return new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}); }

async function listComments(){
  els.status.textContent = 'Hämtar kommentarer…';
  try {
    const url = `${API_BASE}?action=list&limit=${MAX_ITEMS}&t=${Date.now()}`;
    const res = await fetch(url, { cache:'no-store' });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error||'Okänt fel');
    renderFeed(json.items||[]);
    els.status.textContent = `Senast uppdaterad ${now()}`;
  } catch(err){
    console.error(err);
    els.status.textContent = 'Kunde inte hämta kommentarer.';
  }
}

function renderFeed(items){
  els.feed.innerHTML = '';
  if(!items.length){ els.feed.innerHTML = '<li class="muted">Inga kommentarer ännu.</li>'; return; }
  for(const it of items){
    const li = document.createElement('li'); li.className = 'item';
    const name = esc(it.name||'Anonym');
    const text = esc(it.comment||'');
    const ts = it.ts ? new Date(it.ts).toLocaleString('sv-SE',{dateStyle:'medium', timeStyle:'short'}) : '';
    li.innerHTML = `<div class="meta"><span class="name">${name}</span><span class="time">• ${ts}</span></div><div class="text">${text}</div>`;
    els.feed.appendChild(li);
  }
}

function setFormMsg(txt, cls=''){ els.formMsg.className = `msg ${cls}`; els.formMsg.textContent = txt; }

async function submitComment(ev){
  ev.preventDefault();
  const name = els.name.value.trim().slice(0,60);
  const comment = els.comment.value.trim();
  if(comment.length < 3){ setFormMsg('Skriv minst 3 tecken.', 'warn'); return; }
  if(comment.length > 500){ setFormMsg('Max 500 tecken.', 'warn'); return; }
  els.sendBtn.disabled = true; setFormMsg('Skickar…');
  try{
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ action:'submit', name, comment })
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error||'Okänt fel');
    els.comment.value = ''; els.charCount.textContent = '0';
    setFormMsg('Tack! Din kommentar väntar på godkännande.', 'ok');
  }catch(err){
    console.error(err); setFormMsg('Kunde inte skicka. Försök igen.', 'err');
  } finally{
    els.sendBtn.disabled = false;
  }
}

function onCommentInput(){ els.charCount.textContent = String(els.comment.value.length); }

els.form.addEventListener('submit', submitComment);
els.clearBtn.addEventListener('click', ()=>{ els.name.value=''; els.comment.value=''; els.charCount.textContent='0'; setFormMsg(''); });
els.comment.addEventListener('input', onCommentInput);
els.refreshBtn.addEventListener('click', listComments);

// Auto-uppdatera listan varje 60 s och när fliken blir aktiv
setInterval(listComments, 60000);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') listComments(); });

// Start
listComments();
