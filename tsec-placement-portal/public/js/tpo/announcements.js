/* TPO: post announcements to everyone, a branch, or one drive's applicants */
P.page({ title: 'Announcements' }, async (me, root) => {
  const { esc, icon, api, toast, fail, utc, relTime, fmtDateTime } = P;
  const drives = (await api('/api/tpo/drives'));
  let list = [];

  root.innerHTML = `
    <div class="page-head"><div><h1>Announcements</h1><p>Students see these in their portal, with an unread badge until they open them.</p></div></div>
    <div class="grid side-main">
      <form class="card" id="compose" novalidate>
        <div class="card-head"><h2>New announcement</h2></div>
        <div class="card-body stack">
          <div class="form-error"></div>
          <div class="field"><label class="req">Title</label><input class="input" name="title" maxlength="120" placeholder="e.g. Pre-placement talk tomorrow"></div>
          <div class="field"><label class="req">Message</label><textarea class="textarea" name="body" rows="6" maxlength="3000" placeholder="Venue, timing, what to carry…"></textarea></div>
          <div class="field"><label>Send to</label>
            <select class="select" name="audience" id="aud"><option value="ALL">All students</option><option value="BRANCH">One branch</option><option value="DRIVE">Applicants of one drive</option></select></div>
          <div class="field hidden" id="aud-branch"><label>Branch</label><select class="select" name="audience_value_branch">${Object.entries(P.meta.branches).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          <div class="field hidden" id="aud-drive"><label>Drive</label><select class="select" name="audience_value_drive">${drives.map((d) => `<option value="${d.id}">${esc(d.company_name)} — ${esc(d.role)}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" name="is_pinned" data-single>Pin to the top</label>
        </div>
        <div class="card-foot row" style="justify-content:flex-end"><button class="btn primary" type="submit">${icon('send')}Post announcement</button></div>
      </form>
      <div class="card"><div class="card-head"><h2>Posted</h2><span class="small muted" id="n"></span></div><div id="list"></div></div>
    </div>`;

  const aud = P.$('#aud');
  aud.onchange = () => { P.$('#aud-branch').classList.toggle('hidden', aud.value !== 'BRANCH'); P.$('#aud-drive').classList.toggle('hidden', aud.value !== 'DRIVE'); };

  async function load() {
    list = await api('/api/tpo/announcements');
    P.$('#n').textContent = P.plural(list.length, 'announcement');
    P.$('#list').innerHTML = list.length ? list.map((a) => `
      <article class="ann">
        <div class="row" style="align-items:flex-start">
          <h3 class="grow">${a.is_pinned ? `<span class="badge brand plain">${icon('pin', 'sm')}Pinned</span>` : ''}${esc(a.title)}</h3>
          <button class="btn sm ghost icon-only" data-pin="${a.id}" data-v="${a.is_pinned ? 0 : 1}" title="${a.is_pinned ? 'Unpin' : 'Pin to top'}" aria-label="${a.is_pinned ? 'Unpin' : 'Pin'}">${icon('pin', 'sm')}</button>
          <button class="btn sm ghost icon-only danger" data-del="${a.id}" aria-label="Delete">${icon('trash', 'sm')}</button></div>
        <p class="body">${esc(a.body)}</p>
        <div class="meta"><span title="${fmtDateTime(utc(a.created_at))}">${relTime(utc(a.created_at))}</span><span>·</span>
          <span class="tag">${a.audience === 'ALL' ? 'All students' : a.audience === 'BRANCH' ? esc(P.branchName(a.audience_value)) : 'Applicants · ' + esc(a.drive_label || 'deleted drive')}</span></div>
      </article>`).join('') : P.empty('megaphone', 'Nothing posted yet', 'Your first announcement will appear here.');
    P.$$('[data-pin]').forEach((b) => b.onclick = async () => {
      try { await api(`/api/tpo/announcements/${b.dataset.pin}/pin`, { method: 'PATCH', body: { is_pinned: b.dataset.v === '1' } }); load(); } catch (e) { fail(e); }
    });
    P.$$('[data-del]').forEach((b) => b.onclick = async () => {
      const ok = await P.confirm({ title: 'Delete announcement?', message: 'Students will no longer see it.', confirmText: 'Delete', danger: true });
      if (!ok) return;
      try { await api(`/api/tpo/announcements/${b.dataset.del}`, { method: 'DELETE' }); toast('Announcement deleted'); load(); } catch (e) { fail(e); }
    });
  }

  P.$('#compose').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = P.formData(form);
    const body = { title: f.title, body: f.body, audience: f.audience, is_pinned: f.is_pinned,
      audience_value: f.audience === 'BRANCH' ? f.audience_value_branch : f.audience === 'DRIVE' ? f.audience_value_drive : null };
    P.$('.form-error', form).classList.remove('show');
    await P.busy(P.$('button[type=submit]', form), async () => {
      try { await api('/api/tpo/announcements', { method: 'POST', body }); form.reset(); aud.onchange(); toast('Announcement posted'); load(); }
      catch (err) { P.showFormError(form, err); }
    });
  });
  await load();
});
