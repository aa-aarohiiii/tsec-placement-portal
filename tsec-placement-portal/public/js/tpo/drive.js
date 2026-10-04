/* TPO: manage one drive — funnel, applicants & round-by-round status, assign eligible students */
P.page({ title: 'Drive', crumb: 'Drives / Manage' }, async (me, root) => {
  const { esc, icon, ctc, cgpa, api, toast, fail, local, fmtDate, fmtDateTime, countdown, utc, relTime } = P;
  const id = +P.qs('id');
  let drive; let applicants = []; let pool = { eligible: [], ineligible: [] };
  let tab = 'applicants';
  let stageFilter = 'all';
  const sel = { applicants: new Set(), eligible: new Set(), ineligible: new Set() };

  async function load() {
    try {
      [drive, applicants, pool] = await Promise.all([api(`/api/tpo/drives/${id}`), api(`/api/tpo/drives/${id}/applicants`), api(`/api/tpo/drives/${id}/eligible`)]);
    } catch (e) {
      root.innerHTML = P.empty('briefcase', 'Drive not found', esc(e.message), '<a class="btn" href="/tpo/drives.html">Back to drives</a>'); return;
    }
    Object.values(sel).forEach((s) => s.clear());
    document.title = `${drive.company_name} — ${drive.role} · TSEC Placements`;
    render();
  }

  const active = () => applicants.filter((a) => a.status !== 'WITHDRAWN');

  function render() {
    const d = drive;
    const cd = countdown(d.deadline);
    const selected = applicants.filter((a) => a.status === 'SELECTED').length;
    root.innerHTML = `
      <a class="small" href="/tpo/drives.html" style="margin-bottom:14px;gap:4px;display:inline-flex;align-items:center">${icon('arrowLeft', 'sm')}All drives</a>
      ${P.qs('created') ? `<div class="banner ok" style="margin-bottom:16px">${icon('check')}<div><b>Drive published.</b> Eligible students can apply now — or assign them yourself from the <b>Eligible students</b> tab below.</div></div>` : ''}
      <div class="card" style="margin-bottom:16px">
        <div class="card-body row wrap" style="gap:16px;align-items:flex-start">
          ${P.logoTile(d.company_name, 'lg')}
          <div class="grow" style="min-width:240px">
            <div class="row wrap" style="gap:8px"><h1>${esc(d.role)}</h1>
              ${d.status === 'CLOSED' ? '<span class="badge">Closed</span>' : d.is_live ? '<span class="badge ok">Accepting registrations</span>' : '<span class="badge warn">Deadline passed</span>'}</div>
            <p class="muted" style="margin-top:3px">${esc(d.company_name)} · ${esc(d.job_type)} · ${esc(d.location || '—')}</p>
            <div class="row wrap small" style="gap:6px 18px;margin-top:10px">
              <span class="row" style="gap:5px">${icon('rupee', 'sm')}<b class="ctc">${ctc(d.ctc_lpa)}</b></span>
              <span class="row" style="gap:5px">${icon('clock', 'sm')}Deadline ${fmtDateTime(local(d.deadline))}${d.is_live ? ` <span class="countdown ${cd.urgent ? 'urgent' : ''}">(${cd.text.toLowerCase()})</span>` : ''}</span>
              <span class="row" style="gap:5px">${icon('calendar', 'sm')}Drive ${d.drive_date ? fmtDate(local(d.drive_date)) : 'TBA'}</span>
            </div>
            <div class="row wrap" style="gap:6px;margin-top:10px">
              <span class="tag">CGPA ≥ ${d.min_cgpa}</span><span class="tag">${d.max_backlogs ? `≤ ${d.max_backlogs} backlogs` : 'No backlogs'}</span>
              ${d.min_tenth ? `<span class="tag">10th ≥ ${d.min_tenth}%</span>` : ''}${d.min_twelfth ? `<span class="tag">12th ≥ ${d.min_twelfth}%</span>` : ''}
              <span class="tag">${esc(d.allowed_branches.replace(/,/g, ' · '))}</span><span class="tag">${esc(d.eligible_years)}</span></div>
          </div>
          <div class="row wrap">
            <button class="btn" id="edit">${icon('edit')}Edit</button>
            <button class="btn" id="toggle">${icon(d.status === 'OPEN' ? 'lock' : 'unlock')}${d.status === 'OPEN' ? 'Close registrations' : 'Reopen'}</button>
            <button class="btn" id="announce">${icon('megaphone')}Notify applicants</button>
            <button class="btn" id="csv">${icon('download')}CSV</button>
          </div>
        </div>
        <div class="card-foot"><div class="funnel" id="funnel">
          ${[['all', 'All registered', active().length], ...d.stageCounts.map((s, i) => [String(i), s.label, s.count]), ['sel', 'Selected', selected], ['rej', 'Not selected', d.rejected_count]]
            .map(([k, l, n]) => `<button class="f ${stageFilter === k ? 'active' : ''}" data-stage="${k}" title="${esc(l)}"><div class="n">${n}</div><div class="l">${esc(l)}</div></button>`).join('')}
        </div></div>
      </div>

      <div class="card">
        <div class="tabs" id="tabs">
          <button data-t="applicants" class="${tab === 'applicants' ? 'active' : ''}">${icon('clipboard', 'sm')}Registered <span class="n">${active().length}</span></button>
          <button data-t="eligible" class="${tab === 'eligible' ? 'active' : ''}">${icon('check', 'sm')}Eligible — not registered <span class="n">${pool.eligible.length}</span></button>
          <button data-t="ineligible" class="${tab === 'ineligible' ? 'active' : ''}">${icon('x', 'sm')}Not eligible <span class="n">${pool.ineligible.length}</span></button>
        </div>
        <div id="panel"></div>
      </div>`;

    P.$$('#tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
    P.$$('#funnel .f').forEach((b) => b.onclick = () => { stageFilter = b.dataset.stage; tab = 'applicants'; render(); });
    P.$('#edit').onclick = async () => { const r = await P.driveForm({ ...drive }).catch((e) => { fail(e); return null; }); if (r) load(); };
    P.$('#toggle').onclick = async () => {
      try { await api(`/api/tpo/drives/${id}/status`, { method: 'PATCH', body: { status: d.status === 'OPEN' ? 'CLOSED' : 'OPEN' } }); toast(d.status === 'OPEN' ? 'Registrations closed' : 'Drive reopened'); load(); }
      catch (e) { fail(e); }
    };
    P.$('#csv').onclick = () => P.download(`/api/tpo/export/drive/${id}.csv`);
    P.$('#announce').onclick = announce;

    if (tab === 'applicants') renderApplicants(); else renderPool(tab);
  }

  // ------------------------------------------------------------ registered students
  function renderApplicants() {
    const filt = (a) => {
      if (stageFilter === 'all') return a.status !== 'WITHDRAWN';
      if (stageFilter === 'sel') return a.status === 'SELECTED';
      if (stageFilter === 'rej') return a.status === 'REJECTED';
      return a.status === 'ACTIVE' && a.stage === +stageFilter;
    };
    const rows = applicants.filter(filt);
    const s = sel.applicants;
    const lastRound = drive.rounds.length;
    const panel = P.$('#panel');
    panel.innerHTML = `
      <div class="bulkbar ${s.size ? '' : 'hidden'}" id="bulk">
        <span>${P.plural(s.size, 'student')} selected</span><div class="grow"></div>
        <button class="btn sm primary" data-act="advance">${icon('arrowRight', 'sm')}Move to next round</button>
        <select class="select" id="set-stage" style="width:auto;height:28px;font-size:12.5px"><option value="">Move to…</option>
          ${['Applied', ...drive.rounds].map((r, i) => `<option value="${i}">${esc(r)}</option>`).join('')}</select>
        <button class="btn sm" data-act="select" style="color:var(--ok)">${icon('award', 'sm')}Mark selected</button>
        <button class="btn sm danger" data-act="reject">${icon('x', 'sm')}Reject</button>
        <button class="btn sm ghost" data-act="reactivate" title="Put rejected / selected students back in process">${icon('rotate', 'sm')}Reactivate</button>
        <button class="btn sm ghost danger" data-act="remove" title="Delete the registration">${icon('trash', 'sm')}Remove</button>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr>
        <th class="check-col"><input type="checkbox" class="check" id="all" aria-label="Select all"></th><th>Student</th><th>Branch</th>
        <th style="text-align:right">CGPA</th><th>Current status</th><th class="hide-sm">Registered</th><th>Resume</th><th></th></tr></thead><tbody>
        ${rows.map((a) => `<tr class="${s.has(a.id) ? 'selected' : ''}">
          <td class="check-col"><input type="checkbox" class="check" data-id="${a.id}" ${s.has(a.id) ? 'checked' : ''} aria-label="Select ${esc(a.name)}"></td>
          <td><a class="person" href="/tpo/student.html?id=${a.student_id}" style="color:inherit">${P.avatar(a.name)}<span class="who"><b>${esc(a.name)}</b><span class="mono">${esc(a.roll_no)}</span></span></a></td>
          <td>${esc(a.branch)} <span class="faint small">${a.year}</span></td>
          <td style="text-align:right" class="num"><b style="font-weight:600">${cgpa(a.cgpa)}</b></td>
          <td>${P.appStatusBadge(a)}${a.assigned_by_tpo ? ' <span class="badge brand plain" title="Registered by the TPO">TPO</span>' : ''}</td>
          <td class="hide-sm small muted">${relTime(utc(a.created_at))}</td>
          <td>${a.has_resume ? `<a class="btn sm ghost" href="/api/files/resume/${a.student_id}" target="_blank" rel="noopener">${icon('file', 'sm')}PDF</a>` : '<span class="faint small">—</span>'}</td>
          <td class="actions">${a.status === 'ACTIVE' ? (a.stage < lastRound
            ? `<button class="btn sm" data-quick="advance" data-id="${a.id}" title="Move to ${esc(drive.rounds[a.stage])}">Next ${icon('arrowRight', 'sm')}</button>`
            : `<button class="btn sm" data-quick="select" data-id="${a.id}" style="color:var(--ok)">${icon('award', 'sm')}Select</button>`) : ''}</td>
        </tr>`).join('')}</tbody></table></div>`
      : P.empty('users', stageFilter === 'all' ? 'No one has registered yet' : 'No students at this stage',
        stageFilter === 'all' ? `${P.plural(pool.eligible.length, 'student')} meet the criteria. Assign them from the next tab.` : '',
        stageFilter === 'all' && pool.eligible.length ? '<button class="btn primary" id="go-eligible">View eligible students</button>' : '')}`;

    P.$('#go-eligible')?.addEventListener('click', () => { tab = 'eligible'; render(); });
    wireChecks(panel, s, rows.map((r) => r.id), () => renderApplicants());
    P.$$('[data-act]', panel).forEach((b) => b.onclick = () => bulk(b.dataset.act, [...s]));
    P.$('#set-stage', panel).onchange = (e) => { if (e.target.value !== '') bulk('set_stage', [...s], +e.target.value); };
    P.$$('[data-quick]', panel).forEach((b) => b.onclick = () => bulk(b.dataset.quick, [+b.dataset.id], null, true));
  }

  async function bulk(action, ids, stage = null, quick = false) {
    if (!ids.length) return;
    const n = P.plural(ids.length, 'student');
    const confirmText = { select: `Mark ${n} as SELECTED?`, reject: `Reject ${n}?`, remove: `Remove ${n} from this drive?` }[action];
    if (confirmText && !quick) {
      const ok = await P.confirm({ title: confirmText, confirmText: 'Yes, continue', danger: action !== 'select',
        message: action === 'select' ? 'They will be notified and counted as placed. Under the dream-offer rule they can then only apply to higher-paying drives.'
          : action === 'reject' ? 'They will be notified that they did not move forward.' : 'Their registration is deleted. They are notified and may re-apply if registrations are open.' });
      if (!ok) return;
    }
    try {
      const r = await api('/api/tpo/applications/bulk', { method: 'POST', body: { ids, action, stage } });
      const verb = { advance: 'moved to next round', set_stage: 'moved', select: 'marked selected', reject: 'rejected', reactivate: 'reactivated', remove: 'removed' }[action];
      toast(`${P.plural(r.changed, 'student')} ${verb}${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}`, r.changed ? 'ok' : 'info');
      if (r.skipped.length && !r.changed) toast(r.skipped.join(', '), 'info', 6000);
      await load();
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------ eligible / ineligible pool
  function renderPool(which) {
    const rows = pool[which];
    const s = sel[which];
    const elig = which === 'eligible';
    const panel = P.$('#panel');
    panel.innerHTML = `
      <div class="toolbar" style="${rows.length ? '' : 'display:none'}">
        <span class="small muted grow">${elig ? 'Students who meet every criterion and have not registered yet.' : 'Students who miss at least one criterion. You can still register them as a TPO override.'}</span>
        ${elig ? `<button class="btn sm" id="assign-sel" ${s.size ? '' : 'disabled'}>${icon('userPlus', 'sm')}Assign selected (${s.size})</button>
          <button class="btn sm primary" id="assign-all">${icon('users', 'sm')}Assign all ${rows.length} eligible</button>`
        : `<button class="btn sm primary" id="assign-sel" ${s.size ? '' : 'disabled'}>${icon('alert', 'sm')}Override &amp; assign (${s.size})</button>`}
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr>
        <th class="check-col"><input type="checkbox" class="check" id="all" aria-label="Select all"></th><th>Student</th><th>Branch</th><th style="text-align:right">CGPA</th>
        <th style="text-align:center">KTs</th><th>${elig ? 'Profile' : 'Why not eligible'}</th></tr></thead><tbody>
        ${rows.map((st) => `<tr class="${s.has(st.id) ? 'selected' : ''}">
          <td class="check-col"><input type="checkbox" class="check" data-id="${st.id}" ${s.has(st.id) ? 'checked' : ''} aria-label="Select ${esc(st.name)}"></td>
          <td><a class="person" href="/tpo/student.html?id=${st.id}" style="color:inherit">${P.avatar(st.name)}<span class="who"><b>${esc(st.name)}</b><span class="mono">${esc(st.roll_no)}</span></span></a></td>
          <td>${esc(st.branch)} <span class="faint small">${st.year}</span></td>
          <td style="text-align:right" class="num"><b style="font-weight:600">${cgpa(st.cgpa)}</b></td>
          <td style="text-align:center" class="num">${st.backlogs ?? 0}</td>
          <td>${elig ? `${st.has_resume ? '<span class="badge ok plain">Resume</span>' : '<span class="badge bad plain">No resume</span>'} ${st.best_ctc ? `<span class="badge brand plain">Placed ${ctc(st.best_ctc)}</span>` : ''}`
            : `<span class="small" style="color:var(--bad)">${st.reasons.map(esc).join(' · ')}</span>`}</td></tr>`).join('')}
        </tbody></table></div>`
      : P.empty(elig ? 'check' : 'users', elig ? 'No one left to assign' : 'Everyone else is eligible', elig ? 'Every eligible student is already registered for this drive.' : '')}`;

    wireChecks(panel, s, rows.map((r) => r.id), () => renderPool(which));
    P.$('#assign-sel', panel)?.addEventListener('click', () => assign([...s], !elig));
    P.$('#assign-all', panel)?.addEventListener('click', async () => {
      const ok = await P.confirm({ title: `Assign all ${rows.length} eligible students?`, confirmText: 'Assign all',
        message: `Every student in this list is registered for <b>${esc(drive.company_name)} — ${esc(drive.role)}</b> and notified in their portal.` });
      if (ok) assign(rows.map((r) => r.id), false);
    });
  }

  async function assign(ids, force) {
    try {
      const r = await api(`/api/tpo/drives/${id}/assign`, { method: 'POST', body: { studentIds: ids, force } });
      toast(`${P.plural(r.assigned.length, 'student')} assigned${r.already.length ? ` · ${r.already.length} already registered` : ''}${r.ineligible.length ? ` · ${r.ineligible.length} not eligible` : ''}`);
      tab = 'applicants'; stageFilter = 'all';
      await load();
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------ helpers
  function wireChecks(panel, set, ids, rerender) {
    P.$$('[data-id].check', panel).forEach((c) => c.onchange = () => { c.checked ? set.add(+c.dataset.id) : set.delete(+c.dataset.id); rerender(); });
    const all = P.$('#all', panel);
    if (all) {
      all.checked = ids.length > 0 && ids.every((x) => set.has(x));
      all.onchange = () => { ids.forEach((x) => (all.checked ? set.add(x) : set.delete(x))); rerender(); };
    }
  }

  function announce() {
    P.modal({
      title: 'Notify applicants', subtitle: `Visible to the ${P.plural(active().length, 'student')} registered for this drive.`,
      body: `<form class="stack"><div class="form-error"></div>
        <div class="field"><label class="req">Title</label><input class="input" name="title" value="${esc(drive.company_name)}: "></div>
        <div class="field"><label class="req">Message</label><textarea class="textarea" name="body" rows="5" placeholder="Venue, reporting time, what to carry…"></textarea></div></form>`,
      actions: [{ label: 'Cancel' }, { label: `${icon('send', 'sm')}Post`, variant: 'primary', onClick: async ({ body }) => {
        const f = P.formData(P.$('form', body));
        await api('/api/tpo/announcements', { method: 'POST', body: { ...f, audience: 'DRIVE', audience_value: id } });
        toast('Announcement posted to applicants');
      } }],
    });
  }

  await load();
});
