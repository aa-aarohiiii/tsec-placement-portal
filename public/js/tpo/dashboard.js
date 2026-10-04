/* TPO dashboard: headline numbers, branch placement, CTC spread, company offers, to-dos */
P.page({ title: 'Dashboard' }, async (me, root) => {
  const { esc, icon, ctc, cgpa, countdown, utc, relTime } = P;
  const s = await P.api('/api/tpo/stats');
  const t = s.totals;

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Placement overview</h1><p>Season 2026–27 · live numbers from every drive recorded in the portal.</p></div>
      <div class="row"><a class="btn" href="/tpo/reports.html">${icon('download')}Reports</a><a class="btn primary" href="/tpo/drives.html?new=1">${icon('plus')}New drive</a></div>
    </div>

    ${!t.students && !t.companies ? `<div class="card" style="margin-bottom:16px"><div class="card-body">
      <h2 style="margin-bottom:4px">Welcome — let's set up placements for this season</h2>
      <p class="muted small" style="margin-bottom:14px">The portal is empty. Four quick steps:</p>
      <ol class="stack" style="gap:8px;margin:0;padding-left:20px">
        <li><b>Change the TPO password</b> — top-right menu → Change password.</li>
        <li>${s.emailEnabled ? '<b>Email is set up</b> — students will receive OTP codes and updates.' : '<b>Set up email</b> — add a Gmail address and app password in the <code>.env</code> file, then restart the server. Until then, OTP codes print in the server window.'}</li>
        <li><b>Add companies</b>, then <b>create drives</b> with eligibility rules.</li>
        <li><b>Share the portal link</b> with students so they can register with their email.</li>
      </ol>
      <div class="row" style="margin-top:16px"><a class="btn primary" href="/tpo/companies.html">${icon('building')}Add first company</a></div></div></div>` : ''}
    <div class="grid cols-4" style="margin-bottom:16px">
      <div class="card stat accent"><div class="label">${icon('trending', 'sm')}Placement rate (BE)</div>
        <div class="value">${t.placementRate}<small>%</small></div><div class="sub">${t.placed} of ${t.beStudents} final-year students placed</div></div>
      <div class="card stat"><div class="label">${icon('award', 'sm')}Highest CTC</div><div class="value">${t.highestCtc ? `${t.highestCtc}<small>LPA</small>` : '—'}</div>
        <div class="sub">Average ${t.averageCtc} · Median ${t.medianCtc} LPA</div></div>
      <a class="card stat" href="/tpo/drives.html" style="color:inherit;text-decoration:none"><div class="label">${icon('briefcase', 'sm')}Drives open now</div>
        <div class="value">${t.activeDrives}</div><div class="sub">${t.offers} offers from ${t.companies} companies so far</div></a>
      <a class="card stat" href="/tpo/students.html?verified=0" style="color:inherit;text-decoration:none"><div class="label">${icon('shieldAlert', 'sm')}Pending verification</div>
        <div class="value">${t.pending}</div><div class="sub">${t.verified} of ${t.students} students verified</div></a>
    </div>

    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-head"><div><h2>Branch-wise placement</h2><p class="tiny faint">Final-year students placed, by branch</p></div></div>
        <div class="card-body stack" style="gap:14px">${s.branchStats.map((b) => `
          <div class="bar-row" title="${esc(b.name)}: ${b.placed} of ${b.total} placed">
            <span>${esc(b.name)}</span><span class="small muted num">${b.placed}/${b.total} · <b style="color:var(--text)">${b.rate}%</b></span>
            <div class="progress"><i style="width:${b.rate}%"></i></div></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>CTC distribution</h2><p class="tiny faint">Placed students by best offer (₹ LPA)</p></div></div>
        <div class="card-body"><div class="chart-box sm"><canvas id="ctc-chart" aria-label="Bar chart: number of placed students in each CTC band"></canvas></div></div>
      </div>
    </div>

    <div class="grid cols-3" style="margin-bottom:16px">
      <div class="card">
        <div class="card-head"><h2>Offers by company</h2></div>
        <div class="card-body">${s.companyOffers.length ? '<div class="chart-box sm"><canvas id="co-chart" aria-label="Bar chart: offers per company"></canvas></div>' : P.empty('building', 'No offers yet')}</div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Awaiting verification</h2><a class="small" href="/tpo/students.html?verified=0">View all →</a></div>
        ${s.pendingVerifications.length ? `<ul class="list">${s.pendingVerifications.map((p) => `
          <li><a class="person grow" href="/tpo/student.html?id=${p.id}" style="color:inherit;text-decoration:none">${P.avatar(p.name)}
            <span class="who"><b>${esc(p.name)}</b><span>${esc(p.roll_no)} · ${esc(p.branch)} · CGPA ${cgpa(p.cgpa)}</span></span></a>
            ${p.has_resume ? `<span class="badge plain" title="Profile completion">${p.completion}% done</span>` : '<span class="badge bad plain">No resume</span>'}</li>`).join('')}</ul>`
          : P.empty('shield', 'All caught up', 'Every student profile is verified.')}
      </div>
      <div class="card">
        <div class="card-head"><h2>Closing soon</h2><a class="small" href="/tpo/drives.html">All drives →</a></div>
        ${s.closingSoon.length ? `<ul class="list">${s.closingSoon.map((d) => {
          const cd = countdown(d.deadline);
          return `<li><a class="grow" href="/tpo/drive.html?id=${d.id}" style="color:inherit;text-decoration:none;min-width:0">
            <div class="ellipsis" style="font-weight:600">${esc(d.company_name)}</div><div class="small muted ellipsis">${esc(d.role)}</div></a>
            <div style="text-align:right"><div class="small num"><b>${d.applicant_count}</b> <span class="muted">applied</span></div>
            <div class="countdown ${cd.urgent ? 'urgent' : ''}">${cd.text}</div></div></li>`;
        }).join('')}</ul>` : P.empty('calendar', 'No open drives', '', '<a class="btn primary sm" href="/tpo/drives.html?new=1">Create a drive</a>')}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Recent registrations</h2></div>
      ${s.recentApplications.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Drive</th><th>How</th><th class="hide-sm">When</th></tr></thead><tbody>
        ${s.recentApplications.map((a) => `<tr>
          <td><a class="person" href="/tpo/student.html?id=${a.student_id}" style="color:inherit">${P.avatar(a.name)}<span class="who"><b>${esc(a.name)}</b><span>${esc(P.branchName(a.branch))}</span></span></a></td>
          <td><a href="/tpo/drive.html?id=${a.drive_id}">${esc(a.company_name)}</a><div class="small muted">${esc(a.role)}</div></td>
          <td>${a.assigned_by_tpo ? '<span class="badge brand plain">Assigned by TPO</span>' : '<span class="badge plain">Self-applied</span>'}</td>
          <td class="small muted hide-sm">${relTime(utc(a.created_at))}</td></tr>`).join('')}</tbody></table></div>`
        : P.empty('clipboard', 'No registrations yet')}
    </div>`;

  function drawCharts() {
    P.barChart(P.$('#ctc-chart'), {
      labels: s.ctcBands.map((b) => b.label), values: s.ctcBands.map((b) => b.count),
      tooltip: (v) => `${P.plural(v, 'student')}`, axisTitle: 'Students',
    });
    const co = P.$('#co-chart');
    if (co) P.barChart(co, {
      labels: s.companyOffers.map((c) => c.name.length > 18 ? c.name.slice(0, 17) + '…' : c.name), values: s.companyOffers.map((c) => c.offers),
      horizontal: true, tooltip: (v, i) => `${P.plural(v, 'offer')} · up to ${ctc(s.companyOffers[i].ctc)}`,
    });
  }
  drawCharts();
  document.addEventListener('themechange', drawCharts);
});
