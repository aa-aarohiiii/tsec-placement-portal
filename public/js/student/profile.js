/* Student: edit profile + upload resume */
P.page({ title: 'My Profile' }, async (me, root) => {
  const { esc, icon, api, toast, fail, utc, fmtDate } = P;
  let p = await api('/api/student/profile');

  function render() {
    const locked = !!p.is_verified;
    const dis = locked ? 'disabled' : '';
    const v = (k) => esc(p[k] ?? '');
    root.innerHTML = `
      <div class="page-head"><div><h1>My profile</h1><p>This is exactly what the TPO and recruiters see. Keep it accurate.</p></div></div>
      ${P.qs('welcome') ? `<div class="banner info" style="margin-bottom:16px">${icon('sparkle')}<div><b>Welcome aboard, ${esc(p.name.split(' ')[0])}!</b> Fill in your academic details and upload your resume. The TPO will verify your profile, and then you can start applying to drives.</div></div>` : ''}
      ${!locked && p.tpo_remark ? `<div class="banner bad" style="margin-bottom:16px">${icon('shieldAlert')}<div><b>Changes requested by TPO:</b> ${esc(p.tpo_remark)}</div></div>` : ''}
      <div class="grid main-side">
        <form id="pf" class="card" novalidate>
          <div class="form-section">
            <div class="form-error"></div>
            <h3>Personal details</h3><p>Your contact details are shared with recruiters when you apply.</p>
            <div class="form-grid">
              <div class="field span-2"><label class="req">Full name</label><input class="input" name="name" value="${v('name')}" required></div>
              <div class="field"><label>College email</label><input class="input" value="${v('email')}" disabled><span class="hint">Used for login. Contact the TPO to change it.</span></div>
              <div class="field"><label>Mobile number</label><input class="input mono" name="phone" value="${v('phone')}" placeholder="10-digit number" inputmode="numeric"></div>
              <div class="field"><label>Date of birth</label><input class="input" type="date" name="dob" value="${v('dob')}" min="${new Date().getFullYear() - 40}-01-01" max="${new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().slice(0, 10)}"><span class="hint">You must be at least 16 years old.</span></div>
              <div class="field"><label>Gender</label><select class="select" name="gender"><option value="">Prefer not to say</option>
                ${['Male', 'Female', 'Other'].map((g) => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
            </div>
          </div>

          <div class="form-section">
            <div class="row between"><h3>Academic details</h3>${locked ? `<span class="badge ok plain">${icon('lock', 'sm')}Locked after verification</span>` : ''}</div>
            <p>${locked ? 'These were checked against your marksheets by the TPO. To correct them, ask the TPO office to unlock your profile.' : 'Enter these exactly as on your latest marksheets — the TPO will verify them.'}</p>
            <div class="form-grid three">
              <div class="field"><label class="req">Roll number</label><input class="input mono" name="roll_no" value="${v('roll_no')}" ${dis}></div>
              <div class="field"><label>Branch</label><input class="input" value="${esc(P.branchName(p.branch))}" disabled></div>
              <div class="field"><label>Year</label><input class="input" value="${p.year === 'BE' ? 'Final year (BE)' : 'Third year (TE)'}" disabled></div>
              <div class="field"><label class="req">CGPA (out of 10)</label><input class="input mono" name="cgpa" type="number" step="0.01" min="0" max="10" value="${v('cgpa')}" ${dis}></div>
              <div class="field"><label>Active backlogs (KTs)</label><input class="input mono" name="backlogs" type="number" min="0" max="30" value="${v('backlogs')}" ${dis}></div>
              <div class="field"><label class="req">10th %</label><input class="input mono" name="tenth_pct" type="number" step="0.01" min="0" max="100" value="${v('tenth_pct')}" ${dis}></div>
              <div class="field"><label>12th %</label><input class="input mono" name="twelfth_pct" type="number" step="0.01" min="0" max="100" value="${v('twelfth_pct')}" ${dis}></div>
              <div class="field"><label>Diploma %</label><input class="input mono" name="diploma_pct" type="number" step="0.01" min="0" max="100" value="${v('diploma_pct')}" ${dis}><span class="hint">Direct second-year students only.</span></div>
            </div>
          </div>

          <div class="form-section">
            <h3>Skills &amp; links</h3><p>Recruiters scan these first. Separate skills with commas.</p>
            <div class="form-grid">
              <div class="field span-2"><label>Skills</label><input class="input" name="skills" value="${v('skills')}" placeholder="e.g. Java, React, SQL, Machine Learning">
                <div class="row wrap" id="skill-preview" style="gap:6px;margin-top:4px"></div></div>
              <div class="field"><label>LinkedIn URL</label><input class="input" name="linkedin" value="${v('linkedin')}" placeholder="https://www.linkedin.com/in/…"></div>
              <div class="field"><label>GitHub URL</label><input class="input" name="github" value="${v('github')}" placeholder="https://github.com/…"></div>
              <div class="field span-2"><label>About you</label><textarea class="textarea" name="about" maxlength="600" placeholder="Two or three lines about your interests and what you're looking for.">${v('about')}</textarea>
                <span class="hint"><span id="about-n">${(p.about || '').length}</span>/600</span></div>
            </div>
          </div>
          <div class="card-foot row between"><span class="small faint">Last updated ${fmtDate(utc(p.updated_at))}</span>
            <button class="btn primary" type="submit">${icon('check')}Save changes</button></div>
        </form>

        <div class="stack" style="gap:16px">
          <div class="card">
            <div class="card-head"><h2>Resume</h2>${p.resume_path ? '<span class="badge ok">Uploaded</span>' : '<span class="badge bad">Required</span>'}</div>
            <div class="card-body stack">
              ${p.resume_path ? `<div class="file-row"><span class="file-icon">PDF</span>
                <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:500">${esc(p.resume_name || 'resume.pdf')}</div>
                  <div class="tiny faint">Uploaded ${fmtDate(utc(p.resume_uploaded_at))}</div></div>
                <a class="btn sm" href="/api/files/resume/${p.id}" target="_blank" rel="noopener">${icon('eye', 'sm')}View</a></div>` : ''}
              <label class="dropzone" id="dz">${icon('upload')}
                <div style="font-weight:500">${p.resume_path ? 'Replace resume' : 'Upload your resume'}</div>
                <div class="small faint">PDF only · max 2 MB · drag &amp; drop or click</div>
                <input type="file" accept="application/pdf,.pdf" id="file" hidden></label>
              <div id="up-progress" class="hidden"><div class="progress"><i style="width:0"></i></div><div class="tiny faint" style="margin-top:4px">Uploading…</div></div>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Verification</h2></div>
            <div class="card-body">
              ${locked ? `<div class="row" style="gap:10px;color:var(--ok)">${icon('shield', 'lg')}<div><b>Verified by TPO</b><div class="small muted">on ${fmtDate(utc(p.verified_at))}</div></div></div>`
                : `<div class="row" style="gap:10px;color:var(--warn)">${icon('shieldAlert', 'lg')}<div><b>Pending verification</b><div class="small muted">Complete every required field and upload your resume.</div></div></div>`}
              <div style="margin-top:16px"><div class="row between small"><span class="muted">Profile completion</span><b class="num">${p.completion.percent}%</b></div>
                <div class="progress ${p.completion.percent === 100 ? 'ok' : ''}" style="margin-top:6px"><i style="width:${p.completion.percent}%"></i></div>
                ${p.completion.missing.length ? `<p class="tiny faint" style="margin-top:8px">Missing: ${p.completion.missing.map(esc).join(', ')}</p>` : ''}</div>
            </div>
          </div>
        </div>
      </div>`;
    wire();
  }

  function wire() {
    const form = P.$('#pf');
    const skills = form.elements.skills;
    const drawSkills = () => {
      P.$('#skill-preview').innerHTML = skills.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20).map((s) => `<span class="tag">${esc(s)}</span>`).join('');
    };
    skills.addEventListener('input', drawSkills); drawSkills();
    form.elements.about.addEventListener('input', (e) => { P.$('#about-n').textContent = e.target.value.length; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      P.$('.form-error', form).classList.remove('show');
      const data = P.formData(form);
      await P.busy(P.$('button[type=submit]', form), async () => {
        try {
          await api('/api/student/profile', { method: 'PUT', body: data });
          p = await api('/api/student/profile');
          render();
          toast('Profile saved');
        } catch (err) { P.showFormError(form, err); }
      });
    });

    // Resume upload (click or drag & drop)
    const dz = P.$('#dz'); const input = P.$('#file');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) upload(input.files[0]); });
  }

  function upload(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return fail(new Error('Only PDF files are allowed.'));
    if (file.size > 2 * 1024 * 1024) return fail(new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB. Resumes must be under 2 MB.`));
    const fd = new FormData(); fd.append('resume', file);
    // XMLHttpRequest (not fetch) so we can show upload progress.
    const xhr = new XMLHttpRequest();
    const bar = P.$('#up-progress'); bar.classList.remove('hidden');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) P.$('i', bar).style.width = `${(e.loaded / e.total) * 100}%`; };
    xhr.onload = async () => {
      bar.classList.add('hidden');
      let res = {}; try { res = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) { toast('Resume uploaded'); p = await api('/api/student/profile'); render(); }
      else fail(new Error(res.error || `Upload failed (server replied ${xhr.status}). Check the server window for details.`));
    };
    xhr.onerror = () => { bar.classList.add('hidden'); fail(new Error('Upload failed — the server stopped or is not running. Check the black window, then run npm start again.')); };
    xhr.open('POST', '/api/student/resume');
    xhr.send(fd);
  }

  render();
});
