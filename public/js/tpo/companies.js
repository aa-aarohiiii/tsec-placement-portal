/* TPO: recruiting companies — add, edit, delete, and the roles each one is hiring for */
P.page({ title: 'Companies' }, async (me, root) => {
  const { esc, icon, ctc, api, toast, fail, local } = P;
  let list = [];
  let q = '';

  root.innerHTML = `
    <div class="page-head"><div><h1>Companies</h1><p>Recruiters visiting TSEC, the roles they are hiring for, their contacts, and how many offers each has made.</p></div>
      <button class="btn primary" id="add">${icon('plus')}Add company</button></div>
    <div class="card">
      <div class="toolbar"><div class="input-icon" style="width:280px">${icon('search')}<input class="input" id="q" placeholder="Search company, sector or role"></div>
        <div class="grow"></div><span class="small muted" id="count"></span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th>Roles offered</th><th class="hide-sm">Contact</th>
        <th style="text-align:center">Offers</th><th style="text-align:right">Top CTC</th><th></th></tr></thead>
        <tbody id="tbody"></tbody></table></div>
    </div>`;

  async function load() { list = await api('/api/tpo/companies'); render(); }

  /** One small chip per role: "Software Engineer · ₹14 LPA", green dot if registrations are open. */
  function rolesCell(c) {
    if (!c.roles.length) {
      return `<span class="faint small">No roles yet</span><br><a class="small" href="/tpo/drives.html?new=1&company=${c.id}">+ Add a role (create drive)</a>`;
    }
    const now = new Date();
    return `<div class="stack" style="gap:6px">${c.roles.map((r) => {
      const open = r.status === 'OPEN' && local(r.deadline) > now;
      return `<a href="/tpo/drive.html?id=${r.id}" style="color:inherit;text-decoration:none" title="${esc(r.job_type)} · ${r.applicants} registered">
        <span class="row" style="gap:6px;flex-wrap:wrap">
          <span class="badge ${open ? 'ok' : ''}" style="max-width:100%"><span class="ellipsis" style="max-width:220px">${esc(r.role)}</span></span>
          <span class="small muted nowrap">${ctc(r.ctc_lpa)} · ${esc(r.job_type)}</span>
        </span></a>`;
    }).join('')}</div>`;
  }

  function render() {
    const term = q.toLowerCase();
    const rows = list.filter((c) => !term || `${c.name} ${c.sector} ${c.hq} ${c.roles.map((r) => r.role).join(' ')}`.toLowerCase().includes(term));
    P.$('#count').textContent = P.plural(rows.length, 'company', 'companies');
    P.$('#tbody').innerHTML = rows.length ? rows.map((c) => `<tr>
      <td style="vertical-align:top"><div class="person">${P.logoTile(c.name)}<span class="who"><b>${esc(c.name)}</b>
        <span>${esc(c.sector || '')}${c.hq ? ' · ' + esc(c.hq) : ''}${c.website ? ` · <a href="${esc(c.website)}" target="_blank" rel="noopener">website</a>` : ''}</span></span></div></td>
      <td style="vertical-align:top">${rolesCell(c)}</td>
      <td class="hide-sm" style="vertical-align:top"><div class="small">${esc(c.contact_name || '—')}</div>${c.contact_email ? `<a class="tiny" href="mailto:${esc(c.contact_email)}">${esc(c.contact_email)}</a>` : ''}</td>
      <td style="text-align:center;vertical-align:top" class="num">${c.offer_count}</td>
      <td style="text-align:right;vertical-align:top" class="ctc">${c.max_ctc ? ctc(c.max_ctc) : '<span class="faint">—</span>'}</td>
      <td class="actions" style="vertical-align:top">
        <a class="btn sm" href="/tpo/drives.html?new=1&company=${c.id}" title="Add a new role (drive) for this company">${icon('plus', 'sm')}Role</a>
        <button class="btn sm ghost icon-only" data-edit="${c.id}" aria-label="Edit ${esc(c.name)}">${icon('edit', 'sm')}</button>
        <button class="btn sm ghost icon-only danger" data-del="${c.id}" aria-label="Delete ${esc(c.name)}">${icon('trash', 'sm')}</button></td></tr>`).join('')
      : `<tr><td colspan="6">${P.empty('building', list.length ? 'No companies match your search' : 'No companies yet', '', list.length ? '' : '<button class="btn primary" onclick="document.getElementById(\'add\').click()">Add the first company</button>')}</td></tr>`;
    P.$$('[data-edit]').forEach((b) => b.onclick = () => form(list.find((c) => c.id === +b.dataset.edit)));
    P.$$('[data-del]').forEach((b) => b.onclick = () => del(list.find((c) => c.id === +b.dataset.del)));
  }

  function form(c = {}) {
    const v = (k) => esc(c[k] || '');
    P.modal({
      title: c.id ? `Edit ${c.name}` : 'Add company', size: 'lg',
      body: `<form class="form-grid" novalidate><div class="form-error span-all"></div>
        <div class="field"><label class="req">Company name</label><input class="input" name="name" value="${v('name')}" required></div>
        <div class="field"><label>Sector</label><input class="input" name="sector" value="${v('sector')}" placeholder="e.g. IT Services, Banking" list="sectors">
          <datalist id="sectors">${[...new Set(list.map((x) => x.sector).filter(Boolean))].map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div>
        <div class="field"><label>Website</label><input class="input" name="website" value="${v('website')}" placeholder="https://…"></div>
        <div class="field"><label>Headquarters</label><input class="input" name="hq" value="${v('hq')}" placeholder="City"></div>
        <div class="field"><label>Contact person</label><input class="input" name="contact_name" value="${v('contact_name')}"></div>
        <div class="field"><label>Contact email</label><input class="input" name="contact_email" type="email" value="${v('contact_email')}"></div>
        <div class="field"><label>Contact phone</label><input class="input" name="contact_phone" value="${v('contact_phone')}"></div>
        <div class="field span-all"><label>Notes</label><textarea class="textarea" name="notes" placeholder="Bond details, past visits, preferences…">${v('notes')}</textarea></div>
        ${c.id ? '' : '<p class="small muted span-all">After saving, click <b>+ Role</b> on the company to add each role they are hiring for (role, CTC, eligibility and rounds).</p>'}
      </form>`,
      actions: [{ label: 'Cancel' }, { label: c.id ? 'Save changes' : 'Add company', variant: 'primary', onClick: async ({ body }) => {
        const data = P.formData(P.$('form', body));
        await api(c.id ? `/api/tpo/companies/${c.id}` : '/api/tpo/companies', { method: c.id ? 'PUT' : 'POST', body: data });
        toast(c.id ? 'Company updated' : `${data.name} added — now add the roles they are hiring for`); load();
      } }],
    });
  }

  async function del(c) {
    const ok = await P.confirm({
      title: `Delete ${c.name}?`, danger: true, confirmText: 'Delete company',
      message: c.drive_count ? `This also deletes <b>${P.plural(c.drive_count, 'role/drive', 'roles/drives')}</b> and every application in them (including ${P.plural(c.offer_count, 'offer')}). This cannot be undone.` : 'This cannot be undone.',
    });
    if (!ok) return;
    try { await api(`/api/tpo/companies/${c.id}`, { method: 'DELETE' }); toast(`${c.name} deleted`); load(); } catch (e) { fail(e); }
  }

  P.$('#add').onclick = () => form();
  P.$('#q').addEventListener('input', (e) => { q = e.target.value; render(); });
  await load();
});
