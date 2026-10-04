/* Student: browse drives, see eligibility per criterion, apply */
P.page({ title: 'Placement Drives' }, async (me, root) => {
  const { esc, icon, ctc, countdown, fmtDate, local, api, toast, fail } = P;
  let data;
  let tab = P.qs('tab') || 'open';
  let q = '';
  let type = '';

  root.innerHTML = `
    <div class="page-head"><div><h1>Placement drives</h1><p>Every drive published by the T&amp;P cell, with your eligibility checked against each criterion.</p></div></div>
    <div id="offer-note"></div>
    <div class="card" style="margin-bottom:16px">
      <div class="toolbar" style="border-bottom:0">
        <div class="segmented" id="tabs"></div>
        <div class="grow"></div>
        <select class="select" id="type" style="width:170px"><option value="">All job types</option>${P.meta.jobTypes.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
        <div class="input-icon" style="width:240px">${icon('search')}<input class="input" id="q" placeholder="Search company or role"></div>
      </div>
    </div>
    <div id="grid" class="grid cols-3"></div>`;

  const isOpen = (d) => d.status === 'OPEN' && local(d.deadline) > new Date();
  const TABS = [
    ['open', 'Open', (d) => isOpen(d)],
    ['eligible', 'Eligible for me', (d) => isOpen(d) && d.eligibility.eligible && !activeApp(d)],
    ['applied', 'Applied', (d) => !!activeApp(d)],
    ['closed', 'Closed', (d) => !isOpen(d)],
  ];
  const activeApp = (d) => d.application && d.application.status !== 'WITHDRAWN';

  async function load() {
    data = await api('/api/student/drives');
    if (data.offer) {
      P.$('#offer-note').innerHTML = `<div class="banner info" style="margin-bottom:16px">${icon('info')}<div>You hold an offer from <b>${esc(data.offer.company)}</b> (${ctc(data.offer.ctc_lpa)}). Under the dream-offer rule you can apply only to drives paying at least <b>${ctc(+(data.offer.ctc_lpa * 1.5).toFixed(2))}</b>.</div></div>`;
    }
    render();
  }

  function render() {
    P.$('#tabs').innerHTML = TABS.map(([k, label, fn]) =>
      `<button class="${k === tab ? 'active' : ''}" data-tab="${k}">${label} <span class="n">${data.drives.filter(fn).length}</span></button>`).join('');
    P.$$('#tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', `?tab=${tab}`); render(); });

    const filter = TABS.find((t) => t[0] === tab)[2];
    const term = q.toLowerCase();
    const list = data.drives.filter(filter)
      .filter((d) => !type || d.job_type === type)
      .filter((d) => !term || `${d.company_name} ${d.role} ${d.location}`.toLowerCase().includes(term));

    const grid = P.$('#grid');
    if (!list.length) {
      grid.innerHTML = `<div class="card" style="grid-column:1/-1">${P.empty('briefcase',
        tab === 'eligible' ? 'No open drives match your profile right now' : tab === 'applied' ? "You haven't applied to any drive yet" : 'No drives here',
        tab === 'eligible' ? 'Check the Open tab to see what criteria you are missing.' : '')}</div>`;
      return;
    }
    grid.innerHTML = list.map(card).join('');
    P.$$('[data-view]', grid).forEach((b) => b.onclick = () => details(data.drives.find((d) => d.id === +b.dataset.view)));
    P.$$('[data-apply]', grid).forEach((b) => b.onclick = () => apply(data.drives.find((d) => d.id === +b.dataset.apply)));
  }

  function actionFor(d) {
    const a = activeApp(d) ? d.application : null;
    if (a) return P.appStatusBadge(a);
    if (!isOpen(d)) return '<span class="badge plain">Registrations closed</span>';
    if (d.eligibility.eligible) return `<button class="btn primary sm" data-apply="${d.id}">Apply</button>`;
    return `<span class="badge bad" title="${esc(d.eligibility.reasons.join('\n'))}">Not eligible</span>`;
  }

  function card(d) {
    const cd = countdown(d.deadline);
    return `<article class="card drive-card">
      <div class="top">${P.logoTile(d.company_name)}
        <div class="grow"><div class="co">${esc(d.company_name)}${d.application?.assigned_by_tpo && activeApp(d) ? ' · <span class="badge brand plain" style="height:18px">Assigned by TPO</span>' : ''}</div>
          <div class="role">${esc(d.role)}</div></div></div>
      <div class="facts">
        <span>${icon('rupee', 'sm')}<b class="ctc">${ctc(d.ctc_lpa)}</b></span>
        <span>${icon('briefcase', 'sm')}${esc(d.job_type)}</span>
        <span>${icon('mapPin', 'sm')}${esc(d.location || '—')}</span>
      </div>
      <div class="criteria">${P.criteriaChips(d.eligibility.checks)}</div>
      <div class="bottom">
        <span class="countdown ${cd.urgent && !cd.closed ? 'urgent' : ''}">${icon('clock', 'sm')}${cd.closed ? 'Closed ' + fmtDate(local(d.deadline)) : cd.text}</span>
        <div class="row"><button class="btn ghost sm" data-view="${d.id}">Details</button>${actionFor(d)}</div>
      </div>
    </article>`;
  }

  function details(d) {
    const a = activeApp(d) ? d.application : null;
    const canApply = !a && isOpen(d) && d.eligibility.eligible;
    const m = P.modal({
      title: d.role, subtitle: `${esc(d.company_name)} · ${esc(d.company_sector || '')}`, size: 'lg',
      body: `
        <div class="grid cols-4" style="gap:10px;margin-bottom:18px">
          <div class="card stat" style="padding:12px"><div class="label">CTC</div><div class="ctc" style="font-size:17px;margin-top:4px">${ctc(d.ctc_lpa)}</div></div>
          <div class="card stat" style="padding:12px"><div class="label">Type</div><div style="font-weight:600;margin-top:4px">${esc(d.job_type)}</div></div>
          <div class="card stat" style="padding:12px"><div class="label">Apply by</div><div style="font-weight:600;margin-top:4px">${P.fmtDateTime(local(d.deadline))}</div></div>
          <div class="card stat" style="padding:12px"><div class="label">Drive date</div><div style="font-weight:600;margin-top:4px">${d.drive_date ? fmtDate(local(d.drive_date)) : 'TBA'}</div></div>
        </div>
        ${a ? `<div style="margin-bottom:18px"><div class="label-text" style="margin-bottom:8px">Your progress</div>${P.pipeline(a, d.rounds)}</div>` : ''}
        <h3 style="margin-bottom:6px">About the role</h3>
        <p class="muted" style="white-space:pre-line">${esc(d.description || 'No description provided.')}</p>
        <div class="row small muted" style="margin-top:8px;gap:14px">${icon('mapPin', 'sm')}${esc(d.location || '—')}
          ${d.company_website ? `<a href="${esc(d.company_website)}" target="_blank" rel="noopener" class="row" style="gap:4px">${icon('external', 'sm')}Company website</a>` : ''}</div>
        <h3 style="margin:20px 0 8px">Selection process</h3>
        <ol style="margin:0;padding-left:20px;color:var(--text-2)">${d.rounds.map((r) => `<li style="padding:2px 0">${esc(r)}</li>`).join('')}</ol>
        <h3 style="margin:20px 0 8px">Your eligibility</h3>
        <div class="card"><ul class="list">${d.eligibility.checks.map((c) => `
          <li style="padding:9px 14px"><span style="color:var(--${c.ok ? 'ok' : 'bad'})">${icon(c.ok ? 'check' : 'x')}</span>
            <span class="grow">${esc(c.label)}</span><span class="small muted">${esc(c.detail)}</span></li>`).join('')}</ul></div>
        <p class="small faint" style="margin-top:12px">${P.plural(d.applicant_count, 'student')} registered so far.</p>`,
      actions: [
        ...(a && a.status === 'ACTIVE' && a.stage === 0 ? [{ label: 'Withdraw application', variant: 'danger', onClick: () => withdraw(d) }] : []),
        { label: 'Close' },
        ...(canApply ? [{ label: 'Apply now', variant: 'primary', onClick: () => { m.close(); apply(d); return false; } }] : []),
      ],
    });
  }

  async function apply(d) {
    const ok = await P.confirm({
      title: `Apply to ${d.company_name}?`,
      message: `You're applying for <b>${esc(d.role)}</b> (${ctc(d.ctc_lpa)}). Your verified profile and current resume will be shared with the recruiter.<br><br>
        <span class="small">By applying you agree to attend every round. Selected students must accept the offer as per the T&amp;P code of conduct.</span>`,
      confirmText: 'Confirm & apply',
    });
    if (!ok) return;
    try {
      const r = await api(`/api/student/drives/${d.id}/apply`, { method: 'POST' });
      toast(r.message);
      tab = 'applied';
      await load();
    } catch (e) { fail(e); }
  }

  async function withdraw(d) {
    const ok = await P.confirm({ title: 'Withdraw application?', message: `You will be removed from the <b>${esc(d.company_name)}</b> drive. You can re-apply before the deadline.`, confirmText: 'Withdraw', danger: true });
    if (!ok) return false;
    await api(`/api/student/applications/${d.application.id}/withdraw`, { method: 'POST' });
    toast('Application withdrawn');
    await load();
  }

  P.$('#q').addEventListener('input', P.debounce((e) => { q = e.target.value; render(); }, 150));
  P.$('#type').onchange = (e) => { type = e.target.value; render(); };
  await load();
  const open = +P.qs('open');
  if (open) { const d = data.drives.find((x) => x.id === open); if (d) details(d); }
});
