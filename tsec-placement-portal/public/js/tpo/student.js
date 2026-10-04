/* TPO: one student's full profile, resume preview, verification, applications, assign */
P.page({ title: 'Student Profile', crumb: 'Students / Profile' }, async (me, root) => {
  const { esc, icon, cgpa, ctc, api, toast, fail, utc, fmtDate, local } = P;
  const id = +P.qs('id');
  if (!id) { root.innerHTML = P.empty('user', 'No student selected', '', '<a class="btn" href="/tpo/students.html">Back to students</a>'); return; }

  async function load() {
    let s;
    try { s = await api(`/api/tpo/students/${id}`); } catch (e) {
      root.innerHTML = P.empty('user', 'Student not found', esc(e.message), '<a class="btn" href="/tpo/students.html">Back to students</a>'); return;
    }
    document.title = `${s.name} · TSEC Placements`;
    const dash = (v) => (v === null || v === undefined || v === '' ? '<span class="faint">—</span>' : esc(v));
    const link = (u) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : '<span class="faint">—</span>');

    root.innerHTML = `
      <a class="small row" href="/tpo/students.html" style="margin-bottom:14px;gap:4px;display:inline-flex">${icon('arrowLeft', 'sm')}All students</a>
      <div class="card" style="margin-bottom:16px"><div class="card-body row wrap" style="gap:16px">
        ${P.avatar(s.name, 'lg')}
        <div class="grow">
          <div class="row wrap" style="gap:8px"><h1>${esc(s.name)}</h1>
            ${s.is_verified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Pending verification</span>'}
            ${s.offer ? `<span class="badge brand plain">${icon('award', 'sm')}Placed · ${esc(s.offer.company)}</span>` : ''}</div>
          <p class="muted" style="margin-top:4px"><span class="mono">${esc(s.roll_no)}</span> · ${esc(P.branchName(s.branch))} · ${s.year} · ${esc(s.email)}</p>
        </div>
        <div class="row wrap">
          ${s.is_verified
            ? `<button class="btn" id="unverify">${icon('unlock')}Unlock for edits</button>`
            : `<button class="btn" id="sendback">${icon('rotate')}Request changes</button><button class="btn primary" id="verify">${icon('shield')}Verify profile</button>`}
          <button class="btn ${s.is_verified ? 'primary' : ''}" id="assign">${icon('userPlus')}Assign to drive</button>
        </div>
      </div>
      ${s.tpo_remark && !s.is_verified ? `<div class="card-foot small"><b>Your last remark:</b> ${esc(s.tpo_remark)}</div>` : ''}</div>

      <div class="grid main-side wide-side">
        <div class="stack" style="gap:16px">
          <div class="grid cols-4" style="gap:12px">
            <div class="card stat"><div class="label">CGPA</div><div class="value">${cgpa(s.cgpa)}</div></div>
            <div class="card stat"><div class="label">Active backlogs</div><div class="value" style="${s.backlogs ? 'color:var(--bad)' : ''}">${s.backlogs ?? 0}</div></div>
            <div class="card stat"><div class="label">10th</div><div class="value">${s.tenth_pct ?? '—'}<small>${s.tenth_pct != null ? '%' : ''}</small></div></div>
            <div class="card stat"><div class="label">${s.diploma_pct != null && s.twelfth_pct == null ? 'Diploma' : '12th'}</div>
              <div class="value">${s.twelfth_pct ?? s.diploma_pct ?? '—'}<small>${(s.twelfth_pct ?? s.diploma_pct) != null ? '%' : ''}</small></div></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Resume</h2>${s.resume_path ? `<div class="row">
              <a class="btn sm" href="/api/files/resume/${s.id}" target="_blank" rel="noopener">${icon('external', 'sm')}Open</a>
              <a class="btn sm" href="/api/files/resume/${s.id}?download=1">${icon('download', 'sm')}Download</a></div>` : ''}</div>
            ${s.resume_path ? `<iframe src="/api/files/resume/${s.id}#toolbar=0&view=FitH" title="Resume of ${esc(s.name)}" style="width:100%;height:640px;border:0;border-radius:0 0 8px 8px;background:var(--surface-3)"></iframe>`
              : P.empty('file', 'No resume uploaded', 'The student must upload a PDF resume before you can verify the profile.')}
          </div>
          <div class="card">
            <div class="card-head"><h2>Profile details</h2><span class="small faint">Updated ${fmtDate(utc(s.updated_at))}</span></div>
            <div class="card-body"><dl class="kv">
              <dt>Phone</dt><dd class="mono">${dash(s.phone)}</dd>
              <dt>Date of birth</dt><dd>${s.dob ? fmtDate(local(s.dob)) : '<span class="faint">—</span>'}</dd>
              <dt>Gender</dt><dd>${dash(s.gender)}</dd>
              <dt>Skills</dt><dd>${s.skills ? `<div class="row wrap" style="gap:6px">${s.skills.split(',').map((k) => `<span class="tag">${esc(k.trim())}</span>`).join('')}</div>` : '<span class="faint">—</span>'}</dd>
              <dt>LinkedIn</dt><dd>${link(s.linkedin)}</dd>
              <dt>GitHub</dt><dd>${link(s.github)}</dd>
              <dt>About</dt><dd class="muted">${dash(s.about)}</dd>
              <dt>Registered</dt><dd>${fmtDate(utc(s.registered_at))}</dd>
              <dt>Completion</dt><dd><div class="row" style="gap:10px"><div class="progress grow" style="max-width:200px"><i style="width:${s.completion.percent}%"></i></div><span class="small num">${s.completion.percent}%</span></div>
                ${s.completion.missing.length ? `<div class="tiny faint" style="margin-top:4px">Missing: ${s.completion.missing.map(esc).join(', ')}</div>` : ''}</dd>
            </dl></div>
          </div>
        </div>

        <div class="stack" style="gap:16px">
          <div class="card">
            <div class="card-head"><h2>Applications</h2><span class="badge plain">${s.applications.length}</span></div>
            ${s.applications.length ? `<ul class="list">${s.applications.map((a) => `
              <li style="align-items:flex-start"><div class="grow" style="min-width:0">
                <a href="/tpo/drive.html?id=${a.drive_id}" style="font-weight:600">${esc(a.company_name)}</a>
                <div class="small muted ellipsis">${esc(a.role)} · ${ctc(a.ctc_lpa)}</div>
                <div style="margin-top:6px" class="row wrap">${P.appStatusBadge(a)}${a.assigned_by_tpo ? '<span class="badge brand plain">Assigned</span>' : ''}</div></div></li>`).join('')}</ul>`
              : P.empty('clipboard', 'No applications yet')}
          </div>
          <div class="card">
            <div class="card-head"><div><h2>Open drives</h2><p class="tiny faint">Eligibility checked against each drive's criteria</p></div></div>
            ${s.driveOptions.length ? `<ul class="list">${s.driveOptions.map((d) => `
              <li style="align-items:flex-start"><div class="grow" style="min-width:0">
                <div style="font-weight:600" class="ellipsis">${esc(d.company_name)}</div><div class="small muted ellipsis">${esc(d.role)} · ${ctc(d.ctc_lpa)}</div>
                ${d.eligibility.eligible ? '<span class="badge ok" style="margin-top:6px">Eligible</span>'
                  : `<div class="tiny" style="color:var(--bad);margin-top:5px">${d.eligibility.reasons.map(esc).join(' · ')}</div>`}</div>
                <button class="btn sm" data-assign="${d.id}">Assign</button></li>`).join('')}</ul>`
              : P.empty('briefcase', 'Nothing to assign', 'The student is registered for every open drive, or no drives are open.')}
          </div>
        </div>
      </div>`;

    const verify = P.$('#verify');
    if (verify) verify.onclick = () => P.busy(verify, async () => {
      try { await api(`/api/tpo/students/${id}/verify`, { method: 'PATCH', body: { verified: true } }); toast(`${s.name} verified`); load(); } catch (e) { fail(e); }
    });
    const back = P.$('#sendback') || P.$('#unverify');
    back.onclick = () => P.modal({
      title: s.is_verified ? 'Unlock profile for edits' : 'Request changes',
      subtitle: `${esc(s.name)} will be notified and can edit their academic details.`,
      body: `<form><div class="form-error"></div><div class="field"><label class="req">What needs to change?</label>
        <textarea class="textarea" name="remark" maxlength="300" placeholder="e.g. CGPA doesn't match the Sem 6 marksheet. Please re-check and upload the updated resume."></textarea></div></form>`,
      actions: [{ label: 'Cancel' }, { label: 'Send to student', variant: 'primary', onClick: async ({ body }) => {
        const remark = P.$('textarea', body).value.trim();
        if (!remark) throw new Error('Please tell the student what to change.');
        await api(`/api/tpo/students/${id}/verify`, { method: 'PATCH', body: { verified: false, remark } });
        toast('Sent back to student'); load();
      } }],
    });
    P.$('#assign').onclick = async () => { const r = await P.assignToDrive([id], { label: s.name }).catch((e) => { fail(e); return null; }); if (r) load(); };
    P.$$('[data-assign]').forEach((b) => b.onclick = async () => {
      try {
        const r = await api(`/api/tpo/drives/${b.dataset.assign}/assign`, { method: 'POST', body: { studentIds: [id] } });
        if (r.ineligible.length) {
          const ok = await P.confirm({ title: 'Student is not eligible', message: `${esc(r.ineligible[0].reasons.join(' · '))}<br><br>Assign anyway as a TPO override?`, confirmText: 'Assign anyway' });
          if (!ok) return;
          await api(`/api/tpo/drives/${b.dataset.assign}/assign`, { method: 'POST', body: { studentIds: [id], force: true } });
        }
        toast(`${s.name} assigned`); load();
      } catch (e) { fail(e); }
    });
  }
  await load();
});
