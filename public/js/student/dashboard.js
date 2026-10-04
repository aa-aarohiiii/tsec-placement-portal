/* Student dashboard: status, profile completeness, stats, deadlines, offers, announcements */
P.page({ title: 'Dashboard' }, async (me, root) => {
  const { esc, icon, ctc, cgpa, countdown, utc, relTime, local, fmtDateTime } = P;
  const d = await P.api('/api/student/dashboard');
  const s = d.student;
  const first = s.name.split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Top status banner — what should the student do next?
  let banner = '';
  if (d.offers.length) {
    const o = d.offers[0];
    banner = `<div class="banner ok">${icon('award')}<div><b>Congratulations — you're placed at ${esc(o.company_name)}</b> as ${esc(o.role)} (${ctc(o.ctc_lpa)}). You can still apply to dream drives paying at least 1.5× your offer.</div></div>`;
  } else if (!s.is_verified && s.tpo_remark) {
    banner = `<div class="banner bad">${icon('shieldAlert')}<div><b>The TPO sent your profile back for changes.</b> Remark: “${esc(s.tpo_remark)}”. <a href="/student/profile.html">Update your profile →</a></div></div>`;
  } else if (!s.is_verified) {
    const ready = d.completion.percent === 100;
    banner = `<div class="banner warn">${icon('shieldAlert')}<div><b>Your profile is not verified yet.</b> ${ready
      ? 'Your profile is complete — the TPO office will verify it shortly. You can apply to drives once verified.'
      : `Complete your profile${s.has_resume ? '' : ' and upload your resume'} so the TPO can verify it. <a href="/student/profile.html">Complete profile →</a>`}</div></div>`;
  }

  const missing = d.completion.missing;
  root.innerHTML = `
    <div class="page-head">
      <div><h1>${greet}, ${esc(first)}</h1>
        <p><span class="mono">${esc(s.roll_no)}</span> · ${esc(P.branchName(s.branch))} · ${s.year === 'BE' ? 'Final Year' : 'Third Year'}</p></div>
      <a class="btn primary" href="/student/drives.html">${icon('briefcase')}Browse drives</a>
    </div>
    ${banner ? `<div style="margin-bottom:16px">${banner}</div>` : ''}

    <div class="grid cols-4" style="margin-bottom:16px">
      <a class="card stat accent" href="/student/drives.html?tab=eligible" style="color:inherit;text-decoration:none">
        <div class="label">${icon('target', 'sm')}Open drives you can apply to</div><div class="value">${d.stats.eligibleOpen}</div>
        <div class="sub">Eligible and not yet applied</div></a>
      <a class="card stat" href="/student/applications.html" style="color:inherit;text-decoration:none">
        <div class="label">${icon('clipboard', 'sm')}Applications</div><div class="value">${d.stats.applications}</div><div class="sub">All time</div></a>
      <a class="card stat" href="/student/applications.html?tab=active" style="color:inherit;text-decoration:none">
        <div class="label">${icon('layers', 'sm')}In process</div><div class="value">${d.stats.inProcess}</div><div class="sub">Awaiting next round</div></a>
      <div class="card stat"><div class="label">${icon('award', 'sm')}Offers</div><div class="value">${d.stats.offers}</div>
        <div class="sub">${d.offers.length ? 'Best: ' + ctc(d.offers[0].ctc_lpa) : 'Keep going!'}</div></div>
    </div>

    <div class="grid main-side">
      <div class="stack" style="gap:16px">
        <div class="card">
          <div class="card-head"><h2>Closing soon</h2><a class="small" href="/student/drives.html">All drives →</a></div>
          ${d.upcoming.length ? `<ul class="list">${d.upcoming.map((dr) => {
            const cd = countdown(dr.deadline);
            return `<li>${P.logoTile(dr.company_name)}
              <div class="grow" style="min-width:0"><div class="ellipsis"><b style="font-weight:600">${esc(dr.role)}</b></div>
                <div class="small muted ellipsis">${esc(dr.company_name)} · <span class="ctc">${ctc(dr.ctc_lpa)}</span> · ${esc(dr.location || '')}</div></div>
              <div style="text-align:right" class="hide-sm">
                ${dr.eligibility.eligible ? '<span class="badge ok">Eligible</span>' : '<span class="badge">Not eligible</span>'}
                <div class="countdown ${cd.urgent ? 'urgent' : ''}" style="margin-top:4px">${icon('clock', 'sm')}${cd.text}</div></div>
              <a class="btn sm" href="/student/drives.html?open=${dr.id}">View</a></li>`;
          }).join('')}</ul>` : P.empty('calendar', 'No open drives right now', 'New drives appear here as soon as the TPO publishes them.')}
        </div>

        ${d.offers.length ? `<div class="card"><div class="card-head"><h2>Your offers</h2></div><ul class="list">${d.offers.map((o) => `
          <li>${P.logoTile(o.company_name)}<div class="grow"><b style="font-weight:600">${esc(o.company_name)}</b>
            <div class="small muted">${esc(o.role)} · ${esc(o.job_type)} · ${esc(o.location || '')}</div></div>
            <div class="ctc" style="font-size:15px">${ctc(o.ctc_lpa)}</div></li>`).join('')}</ul></div>` : ''}

        <div class="card">
          <div class="card-head"><h2>Latest announcements</h2><a class="small" href="/student/announcements.html">View all →</a></div>
          ${d.announcements.length ? d.announcements.map((a) => `
            <div class="ann"><h3>${a.is_pinned ? `<span class="faint">${icon('pin', 'sm')}</span>` : ''}${esc(a.title)}</h3>
              <p class="body" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(a.body)}</p>
              <div class="meta">${relTime(utc(a.created_at))}${a.audience === 'BRANCH' ? ' · <span class="tag">Your branch</span>' : ''}${a.drive_label ? ` · <span class="tag">${esc(a.drive_label)}</span>` : ''}</div></div>`).join('')
            : P.empty('megaphone', 'No announcements yet')}
        </div>
      </div>

      <div class="stack" style="gap:16px">
        <div class="card">
          <div class="card-head"><h2>Profile strength</h2>${s.is_verified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Unverified</span>'}</div>
          <div class="card-body">
            <div class="row" style="gap:16px">
              <div class="ring" style="--p:${d.completion.percent}"><span>${d.completion.percent}%</span></div>
              <div class="small muted">${missing.length ? `Add <b style="color:var(--text)">${missing.length}</b> more detail${missing.length > 1 ? 's' : ''} to complete your profile.` : 'Your profile is complete. Recruiters see exactly what the TPO sees.'}</div>
            </div>
            ${missing.length ? `<ul class="list" style="margin-top:14px;border:1px solid var(--border);border-radius:6px">${missing.slice(0, 5).map((m) =>
              `<li style="padding:8px 12px;font-size:13px"><span class="faint">${icon('circle', 'sm')}</span>${esc(m)}</li>`).join('')}</ul>` : ''}
            <a class="btn block" style="margin-top:14px" href="/student/profile.html">${icon('edit')}Edit profile</a>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Academic snapshot</h2></div>
          <div class="card-body"><dl class="kv">
            <dt>CGPA</dt><dd class="mono">${cgpa(s.cgpa)}</dd>
            <dt>Branch</dt><dd>${esc(P.branchName(s.branch))}</dd>
            <dt>Resume</dt><dd>${s.has_resume ? `<a href="/api/files/resume/${me.student.id}" target="_blank" rel="noopener">View PDF ${icon('external', 'sm')}</a>` : '<span class="badge bad">Missing</span>'}</dd>
          </dl></div>
        </div>
      </div>
    </div>`;
  // Inline icons inside links need inline-flex to align.
  root.querySelectorAll('.kv a').forEach((a) => { a.style.display = 'inline-flex'; a.style.gap = '4px'; a.style.alignItems = 'center'; });
});
