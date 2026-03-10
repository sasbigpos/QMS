// ═══════════════════════════════════════════════════════
//  QueueFlow — shared.js
//  Uses Supabase for real-time sync + state persistence.
//  No server needed — works on GitHub Pages.
// ═══════════════════════════════════════════════════════

const SUPABASE_URL = 'https://tkjtvfmoodshxcinqwfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRranR2Zm1vb2RzaHhjaW5xd2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDEyMTQsImV4cCI6MjA4ODYxNzIxNH0.OU5AhfZ-EXRmsMBX2QPHv8ysDqu-YPqJBLxjxaYLc04';

const CAT = {
  dine: { id:'dine', label:'Dine In', prefix:'D', color:'#C8502A', light:'#FDF0EB', light2:'#FFF8F5' },
};

let state = {
  queues:         { dine: [] },
  serving:        null,
  completed:      [],
  ticketNums:     { dine: 0 },
  waitSettings:   { dine: 12 },
  restaurantName: 'My Restaurant',
  waLog:          [],
  announcements:  [],
  activeCounters: 1,
};

let selectedCat = 'dine';
let _supabase   = null;
let _saving     = false;

// ── Init Supabase ─────────────────────────────────────
async function initSupabase() {
  // Load Supabase JS from CDN
  await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Load initial state
  await loadState();

  // Subscribe to realtime changes
  _supabase
    .channel('queue_state_changes')
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'queue_state',
      filter: 'id=eq.main',
    }, (payload) => {
      const prevServing = state.serving ? state.serving.number : null;
      state = payload.new.state;
      if (typeof render === 'function') render();
      if (state.serving && state.serving.number !== prevServing) {
        if (typeof flashNowServing === 'function') flashNowServing(state.serving.category);
      }
    })
    .subscribe((status) => {
      console.log('[QF] Realtime status:', status);
      setStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
    });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadState() {
  setStatus('connecting');
  const { data, error } = await _supabase
    .from('queue_state')
    .select('state')
    .eq('id', 'main')
    .single();

  if (error) {
    console.error('[QF] loadState error:', error);
    setStatus('error');
    return;
  }
  state = data.state;
  console.log('[QF] State loaded:', state.queues.dine.length, 'dine');
  if (typeof render === 'function') render();
}

// ── Save state to Supabase ────────────────────────────
async function saveState() {
  if (!_supabase) return;
  if (_saving) return; // debounce
  _saving = true;
  const { error } = await _supabase
    .from('queue_state')
    .update({ state: state, updated_at: new Date().toISOString() })
    .eq('id', 'main');
  _saving = false;
  if (error) console.error('[QF] saveState error:', error);
}

// ── Status indicator ──────────────────────────────────
function setStatus(status) {
  const el = document.getElementById('ws-status');
  if (!el) return;
  const map = {
    connected:    { text:'● Live',          color:'#2A7A6F', bg:'#EBF7F5' },
    connecting:   { text:'○ Connecting…',   color:'#A07830', bg:'#FDF6E3' },
    disconnected: { text:'○ Reconnecting…', color:'#A07830', bg:'#FDF6E3' },
    error:        { text:'✕ Error',          color:'#DC2626', bg:'#FEF2F2' },
  };
  const s = map[status] || map.disconnected;
  el.textContent       = s.text;
  el.style.color       = s.color;
  el.style.background  = s.bg;
  el.style.borderColor = s.color + '40';
}

// ── Helpers ───────────────────────────────────────────
function estimateWait(pos, cats, avgMin) {
  if (cats === 0) return null;
  return Math.round(Math.ceil((pos + 1) / cats) * avgMin);
}

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '');
  return d.startsWith('0') ? '60' + d.slice(1) : d || null;
}

function buildWALink(phone, msg) {
  return 'https://wa.me/' + formatPhone(phone) + '?text=' + encodeURIComponent(msg);
}

const WA_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

// ── WA notification ───────────────────────────────────
function sendWANotification(ticket, type) {
  if (!ticket || !ticket.phone) return null;
  const messages = {
    called:   'Hi! Your queue number *' + ticket.number + '* at *' + state.restaurantName + '* is now being called. Please proceed to the counter. Thank you! 🍽',
    upcoming: 'Hi! Your queue number *' + ticket.number + '* at *' + state.restaurantName + '* is up next. Please be ready! 🍽',
    recall:   'Reminder: Your queue number *' + ticket.number + '* at *' + state.restaurantName + '* is still being called. Please come to the counter now! 🍽',
  };
  const link  = buildWALink(ticket.phone, messages[type]);
  const entry = { id: Date.now() + Math.random(), ticket: ticket.number, phone: ticket.phone, type: type, time: new Date().toISOString(), link: link };
  state.waLog.unshift(entry);
  if (state.waLog.length > 30) state.waLog.pop();
  return link;
}

// ── Actions ───────────────────────────────────────────
async function issueTicket(catId, phone, pax) {
  const prefix = 'D';
  state.ticketNums[catId]++;
  const num    = prefix + String(state.ticketNums[catId]).padStart(3, '0');
  const ticket = { id: Date.now(), number: num, category: catId, time: new Date().toISOString(), pax: pax, phone: phone.trim() };
  state.queues[catId].push(ticket);
  await saveState();
  if (typeof render === 'function') render();
}

async function callSpecific(ticketId, catId) {
  const queue  = state.queues[catId];
  const idx    = queue.findIndex(t => t.id === ticketId);
  if (idx === -1) return;
  const nextUp = idx === 0 ? queue[1] : queue[0];

  if (state.serving) { state.completed.unshift(state.serving); if (state.completed.length > 20) state.completed.pop(); }
  const next    = queue.splice(idx, 1)[0];
  state.serving = next;
  state.announcements.unshift({ id: Date.now(), ticket: next.number, catId: catId, time: new Date().toISOString() });
  if (state.announcements.length > 5) state.announcements.pop();

  if (next.phone) {
    const link = sendWANotification(next, 'called');
    if (link) window.open(link, '_blank', 'noopener');
  }
  if (nextUp && nextUp.phone) sendWANotification(nextUp, 'upcoming');

  await saveState();
  if (typeof render === 'function') render();
  if (typeof flashNowServing === 'function') flashNowServing(catId);
}

async function callNext() {
  const selQ = state.queues[selectedCat];
  if (!selQ || !selQ.length) return;
  await callSpecific(selQ[0].id, selectedCat);
}

async function recallCurrent() {
  if (!state.serving) return;
  state.announcements.unshift({ id: Date.now(), ticket: state.serving.number, recall: true, time: new Date().toISOString() });
  if (state.announcements.length > 5) state.announcements.pop();
  if (state.serving.phone) {
    const link = sendWANotification(state.serving, 'recall');
    if (link) window.open(link, '_blank', 'noopener');
  }
  await saveState();
  if (typeof render === 'function') render();
}

async function skipCurrent() {
  if (!state.serving) return;
  state.completed.unshift({ ...state.serving, skipped: true });
  if (state.completed.length > 20) state.completed.pop();
  state.serving = null;
  await saveState();
  if (typeof render === 'function') render();
}

function selectCat(catId) {
  selectedCat = catId;
  if (typeof render === 'function') render();
}

async function saveSettings() {
  await saveState();
  showToast('✓ Settings saved!');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, isError) {
  let t = document.getElementById('qf-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'qf-toast';
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:11px 24px;border-radius:24px;font-size:13px;font-weight:700;font-family:Outfit,sans-serif;z-index:9999;pointer-events:none;transition:opacity 0.4s;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.18)';
    document.body.appendChild(t);
  }
  t.textContent      = msg;
  t.style.background = isError ? '#DC2626' : '#1A1714';
  t.style.color      = '#fff';
  t.style.opacity    = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── Boot ──────────────────────────────────────────────
window.addEventListener('load', initSupabase);
