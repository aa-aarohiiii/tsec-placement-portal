/* ==========================================================================
   common.js — shared helpers used by EVERY page
   --------------------------------------------------------------------------
   P.api()      fetch wrapper that talks to our Express API
   P.shell()    draws the sidebar + top bar around the page
   P.toast()    small pop-up messages
   P.modal()    dialogs; P.confirm() for "Are you sure?"
   P.icon()     inline SVG icons
   + formatting helpers (dates, CTC, names, badges, pipelines)
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- theme (applied early to avoid a flash)
  const THEME_KEY = 'tsec-theme';
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; } }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ }
  }
  setTheme(getTheme());

  // ---------------------------------------------------------------- icons (Lucide-style strokes)
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/><path d="M10 21v-3h4v3"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h4"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.2 3M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mapPin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    rupee: '<path d="M6 4h12M6 9h12M13 20 7 13h2.5a4.5 4.5 0 0 0 0-9"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    shieldAlert: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="M12 8v4M12 16h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.2 13.6-1.7 7.4L12 18l5.5 3-1.7-7.4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3Z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
    trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
    graduation: '<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    moreH: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  function icon(name, cls = '') {
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.circle}</svg>`;
  }

  // ---------------------------------------------------------------- tiny utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  /** Escape text before putting it into HTML — prevents XSS. ALWAYS use for user data. */
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const qs = (name) => new URLSearchParams(location.search).get(name);
  const plural = (n, word, pl) => `${n} ${n === 1 ? word : pl || word + 's'}`;

  /** SQLite gives UTC 'YYYY-MM-DD HH:MM:SS' — convert to a Date. */
  function utc(s) { return s ? new Date(s.replace(' ', 'T') + (s.length > 16 ? 'Z' : ':00Z')) : null; }
  /** Deadlines are stored as LOCAL 'YYYY-MM-DD HH:MM'. */
  function local(s) { if (!s) return null; const [d, t = '00:00'] = s.split(' '); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi); }
  const fmtDate = (d) => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const fmtDateTime = (d) => (d ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
  function relTime(d) {
    if (!d) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
    return fmtDate(d);
  }
  /** "Closes in 2 days" style countdown for a local deadline string. */
  function countdown(deadline) {
    const ms = local(deadline) - Date.now();
    if (ms < 0) return { text: 'Closed', urgent: false, closed: true };
    const h = ms / 36e5;
    if (h < 1) return { text: `Closes in ${Math.max(1, Math.round(ms / 6e4))} min`, urgent: true };
    if (h < 24) return { text: `Closes in ${Math.round(h)} h`, urgent: true };
    const d = Math.floor(h / 24);
    return { text: `Closes in ${plural(d, 'day')}`, urgent: d <= 2 };
  }
  const ctc = (n) => (n == null ? '—' : `₹${Number(n) % 1 === 0 ? Number(n) : Number(n).toFixed(2).replace(/0$/, '')} LPA`);
  const cgpa = (n) => (n == null ? '—' : Number(n).toFixed(2));
  const initials = (name) => String(name || '?').replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const AVATAR_COLORS = ['#8c1d2e', '#1f5f99', '#1d7a4c', '#7a4bb3', '#b35c1e', '#0f766e', '#9f1d6b', '#4b5563'];
  function avatar(name, size = '') {
    let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="avatar ${size}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${esc(initials(name))}</span>`;
  }
  function logoTile(name, size = '') {
    const words = String(name).replace(/[^A-Za-z& ]/g, ' ').split(/\s+/).filter((w) => w && !['and', 'of', 'the', '&', 'Co'].includes(w));
    const txt = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2);
    return `<span class="logo-tile ${size}">${esc(txt.toUpperCase())}</span>`;
  }

  let META = { branches: {}, years: {}, jobTypes: [] };
  let unloading = false;
  window.addEventListener('pagehide', () => { unloading = true; });
  window.addEventListener('beforeunload', () => { unloading = true; });
  const branchName = (code) => META.branches[code] || code;

  // ---------------------------------------------------------------- API
  /**
   * Call our backend. Returns parsed JSON or throws an Error whose message
   * is the server's friendly error text.
   */
  async function api(url, { method = 'GET', body, form } = {}) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (form) opts.body = form;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res; let data = null;
    try {
      res = await fetch(url, opts);
      if (res.headers.get('content-type')?.includes('application/json')) data = await res.json();
    } catch {
      // Navigating away cancels in-flight requests — that's not a real error.
      if (unloading) return new Promise(() => {});
      throw new Error('Cannot reach the server. Is it still running? (npm start)');
    }
    if (res.status === 401 && !url.startsWith('/api/auth/login')) {
      location.href = '/?expired=1&next=' + encodeURIComponent(location.pathname + location.search);
      throw new Error('Session expired');
    }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  // ---------------------------------------------------------------- toasts
  function toast(message, type = 'ok', ms = 3600) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(type === 'bad' ? 'alert' : type === 'info' ? 'info' : 'check')}<div>${esc(message)}</div>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 220); }, ms);
  }
  const fail = (err) => toast(err.message || String(err), 'bad', 5200);

  // ---------------------------------------------------------------- modal
  /**
   * P.modal({ title, subtitle, body: html|Node, size: ''|'lg'|'xl', actions: [{label, variant, onClick, close}] })
   * onClick may return false to keep the modal open, or a Promise (button shows a spinner).
   */
  function modal({ title, subtitle = '', body = '', size = '', flush = false, actions = [{ label: 'Close' }], onClose } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
          <button class="btn ghost icon-only sm" data-x aria-label="Close">${icon('x')}</button></div>
        <div class="modal-body ${flush ? 'flush' : ''}"></div>
        ${actions.length ? '<div class="modal-foot"></div>' : ''}
      </div>`;
    const bodyEl = $('.modal-body', back);
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    const prevFocus = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); prevFocus && prevFocus.focus && prevFocus.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    $('[data-x]', back).onclick = close;
    const foot = $('.modal-foot', back);
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = `btn ${a.variant || ''}`;
      b.innerHTML = a.label;
      b.type = 'button';
      b.onclick = async () => {
        if (!a.onClick) return close();
        const html = b.innerHTML;
        b.disabled = true; b.innerHTML = `<span class="spinner"></span>${a.label}`;
        try { const r = await a.onClick({ close, el: back, body: bodyEl }); if (r !== false) close(); }
        catch (err) { const box = $('.form-error', bodyEl); if (box) { box.textContent = err.message; box.classList.add('show'); } else fail(err); }
        finally { if (back.isConnected) { b.disabled = false; b.innerHTML = html; } }
      };
      foot.appendChild(b);
    });
    document.body.appendChild(back);
    const first = $('input:not([type=hidden]):not([type=checkbox]), select, textarea', bodyEl);
    (first || $('.modal-foot .btn:last-child', back) || back).focus();
    // Submitting a form inside the modal = clicking the last (primary) button.
    bodyEl.addEventListener('submit', (e) => { e.preventDefault(); const btns = $$('.modal-foot .btn', back); btns[btns.length - 1]?.click(); });
    return { close, el: back, body: bodyEl };
  }

  /** "Are you sure?" dialog. Resolves true / false. */
  function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      modal({
        title, body: `<p class="muted">${message}</p>`,
        actions: [
          { label: 'Cancel', onClick: () => { done = true; resolve(false); } },
          { label: confirmText, variant: danger ? 'danger solid' : 'primary', onClick: () => { done = true; resolve(true); } },
        ],
        onClose: () => { if (!done) resolve(false); },
      });
    });
  }

  /** Collect a <form> into a plain object (checkbox groups become arrays). */
  function formData(form) {
    const out = {};
    for (const el of form.elements) {
      if (!el.name || el.disabled) continue;
      if (el.type === 'checkbox') {
        if (el.dataset.single !== undefined) { out[el.name] = el.checked; continue; }
        out[el.name] = out[el.name] || [];
        if (el.checked) out[el.name].push(el.value);
      } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    }
    return out;
  }
  function showFormError(form, err) {
    const box = $('.form-error', form);
    if (box) { box.textContent = err.message; box.classList.add('show'); box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } else fail(err);
  }
  /** Button spinner while an async action runs. */
  async function busy(btn, fn) {
    const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>${btn.textContent.trim()}`;
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
  }
  /** Download a file from an API endpoint (CSV exports). */
  function download(url) {
    const a = document.createElement('a'); a.href = url; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
    toast('Download started');
  }

  // ---------------------------------------------------------------- domain renderers
  function appStatusBadge(app) {
    if (app.status === 'SELECTED') return `<span class="badge ok">Selected</span>`;
    if (app.status === 'REJECTED') return `<span class="badge bad">${esc(app.stage_label || 'Rejected')}</span>`;
    if (app.status === 'WITHDRAWN') return `<span class="badge">Withdrawn</span>`;
    if (app.stage === 0) return `<span class="badge info">Applied</span>`;
    return `<span class="badge warn">${esc(app.stage_label || 'In process')}</span>`;
  }

  /** Horizontal Applied → rounds → Selected tracker. */
  function pipeline(app, rounds) {
    const steps = ['Applied', ...rounds, 'Selected'];
    const last = steps.length - 1;
    return `<div class="pipeline">${steps.map((label, i) => {
      let cls = '';
      if (app.status === 'SELECTED') cls = i === last ? 'win' : 'done';
      else if (app.status === 'REJECTED') cls = i < app.stage ? 'done' : i === app.stage ? 'failed' : '';
      else if (app.status === 'WITHDRAWN') cls = i === 0 ? 'done' : '';
      else cls = i < app.stage ? 'done' : i === app.stage ? 'current' : '';
      return `<div class="step ${cls}"><span class="node"></span>${esc(label)}</div>`;
    }).join('')}</div>`;
  }

  function criteriaChips(checks) {
    return checks.filter((c) => c.key !== 'open').map((c) =>
      `<span class="crit ${c.ok ? '' : 'fail'}" title="${esc(c.detail)}">${icon(c.ok ? 'check' : 'x')}${esc(c.label)}</span>`).join('');
  }

  function empty(iconName, title, text = '', actionHtml = '') {
    return `<div class="empty">${icon(iconName)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${actionHtml}</div>`;
  }

  // ---------------------------------------------------------------- app shell (sidebar + topbar)
  const NAV = {
    STUDENT: [
      { href: '/student/dashboard.html', label: 'Dashboard', icon: 'home', key: 'dashboard' },
      { href: '/student/drives.html', label: 'Placement Drives', icon: 'briefcase', key: 'drives' },
      { href: '/student/applications.html', label: 'My Applications', icon: 'clipboard', key: 'applications' },
      { href: '/student/announcements.html', label: 'Announcements', icon: 'megaphone', key: 'announcements', count: 'ann' },
      { href: '/student/profile.html', label: 'My Profile', icon: 'user', key: 'profile' },
    ],
    TPO: [
      { section: 'Overview' },
      { href: '/tpo/dashboard.html', label: 'Dashboard', icon: 'chart', key: 'dashboard' },
      { section: 'Manage' },
      { href: '/tpo/students.html', label: 'Students', icon: 'users', key: 'students', count: 'pending' },
      { href: '/tpo/companies.html', label: 'Companies', icon: 'building', key: 'companies' },
      { href: '/tpo/drives.html', label: 'Drives', icon: 'briefcase', key: 'drives' },
      { href: '/tpo/announcements.html', label: 'Announcements', icon: 'megaphone', key: 'announcements' },
      { href: '/tpo/reports.html', label: 'Reports & Exports', icon: 'download', key: 'reports' },
    ],
  };

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    location.href = '/';
  }

  function changePassword() {
    modal({
      title: 'Change password',
      body: `<form class="stack" autocomplete="off">
        <div class="form-error"></div>
        <div class="field"><label class="req">Current password</label><input class="input" type="password" name="current" required></div>
        <div class="field"><label class="req">New password</label><input class="input" type="password" name="next" minlength="8" required><span class="hint">At least 8 characters, with a letter and a number.</span></div>
        <div class="field"><label class="req">Confirm new password</label><input class="input" type="password" name="confirm" required></div>
      </form>`,
      actions: [{ label: 'Cancel' }, {
        label: 'Update password', variant: 'primary', onClick: async ({ body }) => {
          const f = formData($('form', body));
          if (f.next !== f.confirm) throw new Error('New passwords do not match.');
          await api('/api/auth/change-password', { method: 'POST', body: f });
          toast('Password updated');
        },
      }],
    });
  }

  function togglePopover(anchor, build) {
    const open = $('.popover', anchor.parentElement);
    $$('.popover').forEach((p) => p.remove());
    if (open) return;
    const pop = document.createElement('div');
    pop.className = 'popover';
    anchor.parentElement.style.position = 'relative';
    anchor.parentElement.appendChild(pop);
    build(pop);
    setTimeout(() => {
      const off = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } };
      document.addEventListener('mousedown', off);
    });
  }

  async function renderNotifications(pop, badge) {
    pop.innerHTML = '<div class="popover-head">Notifications</div><div class="page-loading" style="padding:30px"><span class="spinner"></span></div>';
    try {
      const n = await api('/api/student/notifications');
      pop.innerHTML = `<div class="popover-head"><span>Notifications</span>${n.unread ? '<button class="btn ghost sm" data-read>Mark all read</button>' : ''}</div>
        ${n.newAnnouncements ? `<a class="banner info" style="margin:10px;border-radius:6px" href="/student/announcements.html">${icon('megaphone')}<span>${plural(n.newAnnouncements, 'new announcement')} from the TPO</span></a>` : ''}
        <ul class="list" style="max-height:360px;overflow:auto">${n.items.length ? n.items.map((i) => `
          <li class="${i.is_read ? '' : 'unread'}"><div class="grow">
            ${i.link ? `<a href="${esc(i.link)}" style="color:inherit">${esc(i.message)}</a>` : esc(i.message)}
            <div class="tiny faint" style="margin-top:3px">${relTime(utc(i.created_at))}</div></div></li>`).join('')
          : `<li><span class="muted small">You're all caught up.</span></li>`}</ul>`;
      const btn = $('[data-read]', pop);
      if (btn) btn.onclick = async () => { await api('/api/student/notifications/read-all', { method: 'POST' }); badge.remove(); renderNotifications(pop, document.createElement('i')); };
    } catch (e) { pop.innerHTML = `<div class="card-body small">${esc(e.message)}</div>`; }
  }

  /**
   * Build the page chrome. Each page calls:  P.page({ title }, async (me) => { ... })
   */
  async function page({ title, crumb }, init) {
    const role = document.body.dataset.role; // 'STUDENT' | 'TPO'
    const key = document.body.dataset.page;
    const content = $('#app');
    content.innerHTML = '<div class="page-loading"><span class="spinner"></span></div>';

    let me;
    try {
      [me, META] = await Promise.all([api('/api/auth/me'), api('/api/meta')]);
    } catch (e) { return; }

    const shell = document.createElement('div');
    shell.className = 'app';
    shell.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <a class="brand-logo" href="${role === 'TPO' ? '/tpo/dashboard.html' : '/student/dashboard.html'}" aria-label="TSEC Placements home">
          <img class="light-only" src="/img/tsec-logo.png" alt="Thadomal Shahani Engineering College">
          <img class="dark-only" src="/img/tsec-logo-white.png" alt="">
          <div class="portal-name">${role === 'TPO' ? 'Placement Cell · TPO' : 'Placement Portal'}</div>
        </a>
        <nav class="nav">${NAV[role].map((n) => n.section ? `<div class="nav-label">${n.section}</div>` :
          `<a href="${n.href}" class="${n.key === key ? 'active' : ''}" data-count="${n.count || ''}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}</nav>
        <div class="side-foot">Thadomal Shahani Engineering College<br>Bandra (W), Mumbai</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost icon-only menu-toggle" aria-label="Open menu">${icon('menu')}</button>
          <div class="crumbs grow ellipsis">${role === 'TPO' ? 'TPO Console' : 'Student Portal'} <span class="faint">/</span> <b>${esc(crumb || title)}</b></div>
          ${role === 'STUDENT' ? `<div><button class="btn ghost icon-only icon-btn" data-bell aria-label="Notifications">${icon('bell')}</button></div>` : ''}
          <div><button class="btn ghost" data-user style="padding:0 6px 0 4px;gap:8px">${avatar(me.name)}<span class="hide-sm ellipsis" style="max-width:160px">${esc(me.name)}</span></button></div>
        </header>
        <main class="content" id="content"></main>
      </div>`;
    const main = $('#content', shell);
    while (content.firstChild) main.appendChild(content.firstChild);
    content.replaceWith(shell);
    main.id = 'app';
    document.title = `${title} · TSEC Placements`;

    // mobile menu
    const side = $('#sidebar', shell);
    $('.menu-toggle', shell).onclick = () => {
      side.classList.add('open');
      const scrim = document.createElement('div'); scrim.className = 'scrim';
      scrim.onclick = () => { side.classList.remove('open'); scrim.remove(); };
      document.body.appendChild(scrim);
    };

    // user menu
    const userBtn = $('[data-user]', shell);
    userBtn.onclick = () => togglePopover(userBtn, (pop) => {
      pop.classList.add('menu');
      const dark = document.documentElement.dataset.theme === 'dark';
      pop.innerHTML = `<div class="who"><b>${esc(me.name)}</b><div class="small faint ellipsis">${esc(me.email)}</div></div>
        ${role === 'STUDENT' ? `<a href="/student/profile.html">${icon('user')}My profile</a>` : ''}
        <button data-a="theme">${icon(dark ? 'sun' : 'moon')}${dark ? 'Light' : 'Dark'} mode</button>
        <button data-a="pw">${icon('key')}Change password</button><hr>
        <button data-a="out">${icon('logout')}Log out</button>`;
      $('[data-a=theme]', pop).onclick = () => { setTheme(dark ? 'light' : 'dark'); pop.remove(); document.dispatchEvent(new Event('themechange')); };
      $('[data-a=pw]', pop).onclick = () => { pop.remove(); changePassword(); };
      $('[data-a=out]', pop).onclick = logout;
    });

    // student bell + nav counts
    if (role === 'STUDENT') {
      const bell = $('[data-bell]', shell);
      api('/api/student/notifications').then((n) => {
        const total = n.unread;
        if (total) { const b = document.createElement('span'); b.className = 'dot-badge'; b.textContent = total > 9 ? '9+' : total; bell.appendChild(b); }
        const annLink = $('[data-count=ann]', shell);
        if (n.newAnnouncements && key !== 'announcements') annLink.insertAdjacentHTML('beforeend', `<span class="count">${n.newAnnouncements}</span>`);
      }).catch(() => {});
      bell.onclick = () => togglePopover(bell, (pop) => renderNotifications(pop, $('.dot-badge', bell) || document.createElement('i')));
    } else {
      api('/api/tpo/students?verified=0').then((list) => {
        if (list.length) $('[data-count=pending]', shell).insertAdjacentHTML('beforeend', `<span class="count" title="Pending verification">${list.length}</span>`);
      }).catch(() => {});
    }

    try { await init(me, main); }
    catch (e) { console.error(e); main.innerHTML = empty('alert', 'Something went wrong', esc(e.message), '<button class="btn" onclick="location.reload()">Try again</button>'); }
  }

  // ---------------------------------------------------------------- charts (Chart.js, loaded only on chart pages)
  /**
   * Single-series bar chart that follows the design system:
   * thin bars (max 24px), 4px rounded ends, hairline grid, hover tooltip.
   */
  function barChart(canvas, { labels, values, horizontal = false, tooltip = (v) => String(v), axisTitle = '' }) {
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: c('--chart'), hoverBackgroundColor: c('--brand'), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: c('--ink'), titleColor: '#fff', bodyColor: '#d7dae0', padding: 10, cornerRadius: 6, displayColors: false,
            callbacks: { label: (ctx) => tooltip(ctx.parsed[horizontal ? 'x' : 'y'], ctx.dataIndex) } },
        },
        scales: {
          [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0, color: c('--text-3'), font: { family: 'Plex', size: 11 } },
            grid: { color: c('--border'), lineWidth: 1 }, border: { display: false }, title: { display: !!axisTitle, text: axisTitle, color: c('--text-3'), font: { size: 11 } } },
          [horizontal ? 'y' : 'x']: { ticks: { color: c('--text-2'), font: { family: 'Plex', size: 11.5 } }, grid: { display: false }, border: { color: c('--border') } },
        },
      },
    });
    return canvas._chart;
  }

  // ---------------------------------------------------------------- TPO: assign students to a drive
  function summarize(r) {
    const parts = [];
    if (r.assigned.length) parts.push(`${plural(r.assigned.length, 'student')} assigned`);
    if (r.already.length) parts.push(`${r.already.length} already registered`);
    return parts.join(' · ') || 'No changes';
  }

  /** Ask which drive, assign, and offer an override for students who don't meet the criteria. */
  async function assignToDrive(studentIds, { driveId = null, label = '' } = {}) {
    const drives = (await api('/api/tpo/drives')).filter((d) => d.status === 'OPEN');
    if (!drives.length) { toast('There are no open drives. Create or reopen a drive first.', 'bad'); return null; }
    return new Promise((resolve) => {
      let finished = false;
      modal({
        title: 'Assign to drive',
        subtitle: `${plural(studentIds.length, 'student')} selected${label ? ' · ' + esc(label) : ''}`,
        body: `<form class="stack"><div class="form-error"></div>
          <div class="field"><label class="req">Drive</label><select class="select" name="drive">${drives.map((d) =>
            `<option value="${d.id}" ${d.id === driveId ? 'selected' : ''}>${esc(d.company_name)} — ${esc(d.role)} (${ctc(d.ctc_lpa)})${d.is_live ? '' : ' · deadline passed'}</option>`).join('')}</select></div>
          <p class="small muted">Assigned students are registered for the drive immediately and notified in their portal. Students who don't meet the drive's criteria will be listed so you can decide.</p></form>`,
        actions: [{ label: 'Cancel' }, {
          label: 'Assign', variant: 'primary', onClick: async ({ body }) => {
            const id = +$('select', body).value;
            const drive = drives.find((d) => d.id === id);
            const r = await api(`/api/tpo/drives/${id}/assign`, { method: 'POST', body: { studentIds } });
            finished = true;
            if (r.ineligible.length) {
              setTimeout(() => overrideDialog(drive, r, resolve));
            } else { toast(summarize(r)); resolve(r); }
          },
        }],
        onClose: () => { if (!finished) resolve(null); },
      });
    });
  }

  function overrideDialog(drive, first, resolve) {
    let done = false;
    modal({
      title: `${plural(first.ineligible.length, 'student')} don't meet the criteria`,
      subtitle: `${esc(drive.company_name)} — ${esc(drive.role)}${first.assigned.length ? ` · ${plural(first.assigned.length, 'other')} assigned` : ''}`,
      size: 'lg', flush: true,
      body: `<ul class="list">${first.ineligible.map((s) => `<li style="align-items:flex-start">${avatar(s.name)}
        <div class="grow"><b style="font-weight:500">${esc(s.name)}</b><div class="small" style="color:var(--bad)">${s.reasons.map(esc).join(' · ')}</div></div></li>`).join('')}</ul>`,
      actions: [
        { label: 'Skip them', onClick: () => { done = true; toast(summarize(first)); resolve(first); } },
        { label: 'Assign anyway (override)', variant: 'primary', onClick: async () => {
          const r = await api(`/api/tpo/drives/${drive.id}/assign`, { method: 'POST', body: { studentIds: first.ineligible.map((s) => s.id), force: true } });
          done = true;
          r.assigned = [...first.assigned, ...r.assigned];
          toast(summarize(r)); resolve(r);
        } },
      ],
      onClose: () => { if (!done) { toast(summarize(first)); resolve(first); } },
    });
  }

  // ---------------------------------------------------------------- TPO: create / edit drive form
  async function driveForm(d = null, { companyId = null } = {}) {
    const companies = await api('/api/tpo/companies');
    if (!companies.length) { toast('Add a company first, then create its drive.', 'bad'); location.href = '/tpo/companies.html'; return null; }
    const v = (k, def = '') => esc(d ? d[k] ?? def : def);
    const inWeek = new Date(Date.now() + 7 * 864e5);
    const p2 = (n) => String(n).padStart(2, '0');
    const defDeadline = `${inWeek.getFullYear()}-${p2(inWeek.getMonth() + 1)}-${p2(inWeek.getDate())}T23:59`;
    const branches = d ? d.allowed_branches.split(',') : ['COMPS', 'IT', 'AIDS', 'EXTC'];
    const years = d ? d.eligible_years.split(',') : ['BE'];
    const rounds = d ? d.rounds : ['Aptitude Test', 'Technical Interview', 'HR Interview'];
    return new Promise((resolve) => {
      let saved = false;
      modal({
        title: d ? 'Edit drive' : 'Create a placement drive', subtitle: d ? `${esc(d.company_name)} — ${esc(d.role)}` : 'Students see it immediately, with eligibility checked against these criteria.',
        size: 'lg',
        body: `<form novalidate>
          <div class="form-error" style="margin-bottom:14px"></div>
          <div class="form-grid">
            <div class="field"><label class="req">Company</label><select class="select" name="company_id">${companies.map((c) =>
              `<option value="${c.id}" ${(d ? d.company_id : companyId) === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label class="req">Job role</label><input class="input" name="role" value="${v('role')}" placeholder="e.g. Software Engineer"></div>
            <div class="field"><label class="req">Job type</label><select class="select" name="job_type">${META.jobTypes.map((t) => `<option ${d && d.job_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="field"><label class="req">CTC / stipend-equivalent (₹ LPA)</label><input class="input" name="ctc_lpa" type="number" step="0.01" min="0" value="${v('ctc_lpa')}" placeholder="e.g. 7.5"></div>
            <div class="field"><label>Location</label><input class="input" name="location" value="${v('location')}" placeholder="e.g. Mumbai / Pune"></div>
            <div class="field"><label>Drive date</label><input class="input" type="date" name="drive_date" value="${v('drive_date')}"></div>
            <div class="field"><label class="req">Registration deadline</label><input class="input" type="datetime-local" name="deadline" value="${d ? esc(d.deadline.replace(' ', 'T')) : defDeadline}"></div>
            <div class="field"><label>Description</label><input class="input" name="description" value="${v('description')}" placeholder="Short summary shown to students"></div>
          </div>
          <h3 style="margin:22px 0 4px">Eligibility criteria</h3><p class="small muted" style="margin-bottom:12px">Checked automatically for every student. You can still override while assigning.</p>
          <div class="form-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
            <div class="field"><label>Min CGPA</label><input class="input" name="min_cgpa" type="number" step="0.01" min="0" max="10" value="${v('min_cgpa', '6.5')}"></div>
            <div class="field"><label>Max backlogs</label><input class="input" name="max_backlogs" type="number" min="0" value="${v('max_backlogs', '0')}"></div>
            <div class="field"><label>Min 10th %</label><input class="input" name="min_tenth" type="number" step="0.01" min="0" max="100" value="${v('min_tenth', '0')}"></div>
            <div class="field"><label>Min 12th/Dip %</label><input class="input" name="min_twelfth" type="number" step="0.01" min="0" max="100" value="${v('min_twelfth', '0')}"></div>
          </div>
          <div class="field" style="margin-top:14px"><span class="label-text req">Eligible branches</span><div class="chip-toggle">${Object.entries(META.branches).map(([k, n]) =>
            `<label title="${esc(n)}"><input type="checkbox" name="allowed_branches" value="${k}" ${branches.includes(k) ? 'checked' : ''}>${k}</label>`).join('')}</div></div>
          <div class="field" style="margin-top:14px"><span class="label-text req">Eligible year</span><div class="chip-toggle">
            <label><input type="checkbox" name="eligible_years" value="BE" ${years.includes('BE') ? 'checked' : ''}>Final year (BE)</label>
            <label><input type="checkbox" name="eligible_years" value="TE" ${years.includes('TE') ? 'checked' : ''}>Third year (TE)</label></div></div>
          <div class="field" style="margin-top:14px"><label class="req">Selection rounds</label>
            <textarea class="textarea" name="rounds" rows="4" placeholder="One round per line">${esc(rounds.join('\n'))}</textarea>
            <span class="hint">One per line, in order. Students see these as steps in their tracker.</span></div>
        </form>`,
        actions: [{ label: 'Cancel' }, { label: d ? 'Save changes' : 'Publish drive', variant: 'primary', onClick: async ({ body }) => {
          const data = formData($('form', body));
          const r = await api(d ? `/api/tpo/drives/${d.id}` : '/api/tpo/drives', { method: d ? 'PUT' : 'POST', body: data });
          saved = true; toast(d ? 'Drive updated' : 'Drive published — students can see it now');
          resolve(d ? d.id : r.id);
        } }],
        onClose: () => { if (!saved) resolve(null); },
      });
    });
  }

  window.P = {
    barChart, assignToDrive, driveForm,
    $, $$, esc, icon, api, toast, fail, modal, confirm: confirmDialog, formData, showFormError, busy, download, debounce, qs, plural,
    utc, local, fmtDate, fmtDateTime, relTime, countdown, ctc, cgpa, initials, avatar, logoTile, branchName, get meta() { return META; },
    appStatusBadge, pipeline, criteriaChips, empty, page, setTheme, getTheme,
  };
})();
