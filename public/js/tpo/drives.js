/* TPO: all drives — create, edit, open/close, delete, jump to manage */
P.page({ title: 'Drives' }, async (me, root) => {
  const { esc, icon, ctc, api, toast, fail, countdown, local, fmtDate } = P;
  let list = [];
  let tab = 'live';
  let q = '';
  const companyFilter = +P.qs('company') || null;

  root.innerHTML = `
    <div class="page-head"><div><h1>Drives</h1><p>Create drives, set eligibility, and manage each drive's applicants round by round.</p></div>
      <button class="btn primary" id="new">${icon('plus')}New drive</button></div>
    <div class="card">
      <div class="toolbar"><div class="segmented" id="tabs"></div>
        ${companyFilter ? '<span class="badge brand plain" id="cf"></span><a class="small" href="/tpo/drives.html">Show all companies</a>' : ''}
        <div class="grow"></div>
        <div class="input-icon" style="width:260px">${icon('search')}<input class="input" id="q" placeholder="Search company or role"></div></div>
      <div class="table-wrap"><table class="table"><thead><tr>
        <th>Drive</th><th style="text-align:right">CTC</th><th class="hide-sm">Eligibility</th><th>Deadline</th>
        <th style="text-align:center">Registered</th><th style="text-align:center">Selected</th><th>Status</th><th></th></tr></thead>
        <tbody id="tbody"></tbody></table></div>
    </div>`;

  const TABS = [['live', 'Accepting registrations', (d) => d.is_live], ['past', 'Closed / past deadline', (d) => !d.is_live], ['all', 'All', () => true]];

  async function load() {
    list = await api('/api/tpo/drives');
    if (companyFilter) { list = list.filter((d) => d.company_id === companyFilter); if (list[0]) P.$('#cf').textContent = list[0].company_name; tab = 'all'; }
    render();
  }

  function render() {
    P.$('#tabs').innerHTML = TABS.map(([k, l, f]) => `<button class="${k === tab ? 'active' : ''}" data-t="${k}">${l} <span class="n">${list.filter(f).length}</span></button>`).join('');
    P.$$('#tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
    const term = q.toLowerCase();
    const rows = list.filter(TABS.find((t) => t[0] === tab)[2]).filter((d) => !term || `${d.company_name} ${d.role}`.toLowerCase().includes(term));
    P.$('#tbody').innerHTML = rows.length ? rows.map((d) => {
      const cd = countdown(d.deadline);
      return `<tr>
        <td><a class="person" href="/tpo/drive.html?id=${d.id}" style="color:inherit">${P.logoTile(d.company_name)}
          <span class="who"><b>${esc(d.role)}</b><span>${esc(d.company_name)} · ${esc(d.job_type)}</span></span></a></td>
        <td style="text-align:right" class="ctc">${ctc(d.ctc_lpa)}</td>
        <td class="hide-sm small muted">CGPA ≥ ${d.min_cgpa} · ${d.max_backlogs ? `≤${d.max_backlogs} KT` : 'No KT'}<br>${esc(d.allowed_branches.replace(/,/g, ', '))} · ${esc(d.eligible_years)}</td>
        <td class="small"><div>${fmtDate(local(d.deadline))}</div><div class="countdown ${d.is_live && cd.urgent ? 'urgent' : ''}">${d.is_live ? cd.text : d.drive_date ? 'Drive ' + fmtDate(local(d.drive_date)) : ''}</div></td>
        <td style="text-align:center" class="num">${d.applicant_count}</td>
        <td style="text-align:center" class="num">${d.selected_count ? `<b style="color:var(--ok)">${d.selected_count}</b>` : '0'}</td>
        <td>${d.status === 'CLOSED' ? '<span class="badge">Closed</span>' : d.is_live ? '<span class="badge ok">Open</span>' : '<span class="badge warn">Deadline passed</span>'}</td>
        <td class="actions"><a class="btn sm primary" href="/tpo/drive.html?id=${d.id}">Manage</a>
          <button class="btn sm ghost icon-only" data-more="${d.id}" aria-label="More actions">${icon('moreH', 'sm')}</button></td></tr>`;
    }).join('') : `<tr><td colspan="8">${P.empty('briefcase', 'No drives here', tab === 'live' ? 'Create a drive to start accepting registrations.' : '', tab === 'live' ? '<button class="btn primary" id="empty-new">Create a drive</button>' : '')}</td></tr>`;
    P.$('#empty-new')?.addEventListener('click', create);
    P.$$('[data-more]').forEach((b) => b.onclick = () => more(b, list.find((d) => d.id === +b.dataset.more)));
  }

  function more(btn, d) {
    const open = btn.parentElement.querySelector('.popover');
    P.$$('.popover').forEach((p) => p.remove());
    if (open) return;
    btn.parentElement.style.position = 'relative';
    const pop = document.createElement('div');
    pop.className = 'popover menu';
    pop.style.textAlign = 'left';
    pop.innerHTML = `<button data-a="edit">${icon('edit')}Edit drive</button>
      <button data-a="toggle">${icon(d.status === 'OPEN' ? 'lock' : 'unlock')}${d.status === 'OPEN' ? 'Close registrations' : 'Reopen registrations'}</button>
      <button data-a="csv">${icon('download')}Export applicants</button><hr>
      <button data-a="del" style="color:var(--bad)">${icon('trash')}Delete drive</button>`;
    btn.parentElement.appendChild(pop);
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off); } }));
    pop.onclick = async (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      pop.remove();
      try {
        if (a === 'edit') { const id = await P.driveForm({ ...d }); if (id) load(); }
        if (a === 'toggle') {
          await api(`/api/tpo/drives/${d.id}/status`, { method: 'PATCH', body: { status: d.status === 'OPEN' ? 'CLOSED' : 'OPEN' } });
          toast(d.status === 'OPEN' ? 'Registrations closed' : 'Drive reopened'); load();
        }
        if (a === 'csv') P.download(`/api/tpo/export/drive/${d.id}.csv`);
        if (a === 'del') {
          const ok = await P.confirm({ title: 'Delete this drive?', danger: true, confirmText: 'Delete drive',
            message: `<b>${esc(d.company_name)} — ${esc(d.role)}</b> and its ${P.plural(d.applicant_count, 'registration')} will be permanently deleted.${d.selected_count ? ` <b>${P.plural(d.selected_count, 'offer')}</b> recorded here will be lost.` : ''}` });
          if (ok) { await api(`/api/tpo/drives/${d.id}`, { method: 'DELETE' }); toast('Drive deleted'); load(); }
        }
      } catch (err) { fail(err); }
    };
  }

  async function create() {
    const id = await P.driveForm(null, { companyId: +P.qs('company') || null }).catch((e) => { fail(e); return null; });
    history.replaceState(null, '', location.pathname + (companyFilter ? `?company=${companyFilter}` : ''));
    if (id) location.href = `/tpo/drive.html?id=${id}&created=1`;
  }

  P.$('#new').onclick = create;
  P.$('#q').addEventListener('input', (e) => { q = e.target.value; render(); });
  await load();
  if (P.qs('new')) create();
});
