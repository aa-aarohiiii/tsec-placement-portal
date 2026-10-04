/* Student: all applications with a round-by-round tracker */
P.page({ title: 'My Applications' }, async (me, root) => {
  const { esc, icon, ctc, utc, fmtDate, relTime, api, toast, fail } = P;
  let tab = P.qs('tab') || 'all';
  let apps = [];

  root.innerHTML = `
    <div class="page-head"><div><h1>My applications</h1><p>Track where you stand in every drive. The TPO updates these after each round.</p></div>
      <a class="btn" href="/student/drives.html?tab=eligible">${icon('plus')}Find more drives</a></div>
    <div class="card"><div class="toolbar"><div class="segmented" id="tabs"></div></div><div id="list"></div></div>`;

  const TABS = [
    ['all', 'All', (a) => a.status !== 'WITHDRAWN'],
    ['active', 'In process', (a) => a.status === 'ACTIVE'],
    ['selected', 'Selected', (a) => a.status === 'SELECTED'],
    ['rejected', 'Not selected', (a) => a.status === 'REJECTED'],
    ['withdrawn', 'Withdrawn', (a) => a.status === 'WITHDRAWN'],
  ];

  async function load() { apps = await api('/api/student/applications'); render(); }

  function render() {
    P.$('#tabs').innerHTML = TABS.map(([k, l, f]) => `<button class="${k === tab ? 'active' : ''}" data-t="${k}">${l} <span class="n">${apps.filter(f).length}</span></button>`).join('');
    P.$$('#tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; history.replaceState(null, '', `?tab=${tab}`); render(); });
    const list = apps.filter(TABS.find((t) => t[0] === tab)[2]);
    const box = P.$('#list');
    if (!list.length) {
      box.innerHTML = P.empty('clipboard', tab === 'all' ? 'No applications yet' : 'Nothing here', tab === 'all' ? 'Apply to a drive and track every round here.' : '',
        tab === 'all' ? `<a class="btn primary" href="/student/drives.html?tab=eligible">Browse eligible drives</a>` : '');
      return;
    }
    box.innerHTML = list.map((a) => `
      <div style="padding:18px;border-bottom:1px solid var(--border)">
        <div class="row" style="gap:12px;align-items:flex-start">
          ${P.logoTile(a.company_name)}
          <div class="grow">
            <div class="row wrap" style="gap:8px"><b style="font-size:15px;font-weight:600">${esc(a.role)}</b>${P.appStatusBadge(a)}
              ${a.assigned_by_tpo ? '<span class="badge brand plain">Assigned by TPO</span>' : ''}</div>
            <div class="small muted" style="margin-top:2px">${esc(a.company_name)} · <span class="ctc">${ctc(a.ctc_lpa)}</span> · ${esc(a.job_type)} · ${esc(a.location || '')}</div>
          </div>
          <div class="small faint hide-sm" style="text-align:right">Applied ${fmtDate(utc(a.created_at))}<br>Updated ${relTime(utc(a.updated_at))}</div>
        </div>
        <div style="margin-top:16px">${P.pipeline(a, a.rounds)}</div>
        ${a.status === 'ACTIVE' && a.stage === 0 ? `<div class="row" style="justify-content:flex-end;margin-top:10px">
          <button class="btn sm danger" data-w="${a.id}">${icon('x', 'sm')}Withdraw</button></div>` : ''}
        ${a.status === 'SELECTED' ? `<div class="banner ok" style="margin-top:14px">${icon('award')}<div><b>You've been selected!</b> The T&amp;P cell will share your offer letter and joining details by email.</div></div>` : ''}
      </div>`).join('');
    P.$$('[data-w]', box).forEach((b) => b.onclick = async () => {
      const a = apps.find((x) => x.id === +b.dataset.w);
      const ok = await P.confirm({ title: 'Withdraw application?', message: `You'll be removed from the <b>${esc(a.company_name)}</b> drive. You can re-apply before the deadline.`, confirmText: 'Withdraw', danger: true });
      if (!ok) return;
      try { await api(`/api/student/applications/${a.id}/withdraw`, { method: 'POST' }); toast('Application withdrawn'); await load(); } catch (e) { fail(e); }
    });
  }
  await load();
});
