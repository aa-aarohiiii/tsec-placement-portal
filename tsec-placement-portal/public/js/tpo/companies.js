/* TPO: recruiting companies — add, edit, delete */
P.page({ title: 'Companies' }, async (me, root) => {
  const { esc, icon, ctc, api, toast, fail } = P;
  let list = [];
  let q = '';

  root.innerHTML = `
    <div class="page-head"><div><h1>Companies</h1><p>Recruiters visiting TSEC, their contacts, and how many offers each has made.</p></div>
      <button class="btn primary" id="add">${icon('plus')}Add company</button></div>
    <div class="card">
      <div class="toolbar"><div class="input-icon" style="width:280px">${icon('search')}<input class="input" id="q" placeholder="Search companies or sectors"></div>
        <div class="grow"></div><span class="small muted" id="count"></span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th>Sector</th><th class="hide-sm">Contact</th>
        <th style="text-align:center">Drives</th><th style="text-align:center">Offers</th><th style="text-align:right">Top CTC</th><th></th></tr></thead>
        <tbody id="tbody"></tbody></table></div>
    </div>`;

  async function load() { list = await api('/api/tpo/companies'); render(); }

  function render() {
    const term = q.toLowerCase();
    const rows = list.filter((c) => !term || `${c.name} ${c.sector} ${c.hq}`.toLowerCase().includes(term));
    P.$('#count').textContent = P.plural(rows.length, 'company', 'companies');
    P.$('#tbody').innerHTML = rows.length ? rows.map((c) => `<tr>
      <td><div class="person">${P.logoTile(c.name)}<span class="who"><b>${esc(c.name)}</b><span>${esc(c.hq || '')}${c.website ? ` · <a href="${esc(c.website)}" target="_blank" rel="noopener">website</a>` : ''}</span></span></div></td>
      <td>${c.sector ? `<span class="tag">${esc(c.sector)}</span>` : '<span class="faint">—</span>'}</td>
      <td class="hide-sm"><div class="small">${esc(c.contact_name || '—')}</div>${c.contact_email ? `<a class="tiny" href="mailto:${esc(c.contact_email)}">${esc(c.contact_email)}</a>` : ''}</td>
      <td style="text-align:center" class="num">${c.drive_count ? `<a href="/tpo/drives.html?company=${c.id}">${c.drive_count}</a>` : '0'}</td>
      <td style="text-align:center" class="num">${c.offer_count}</td>
      <td style="text-align:right" class="ctc">${c.max_ctc ? ctc(c.max_ctc) : '<span class="faint">—</span>'}</td>
      <td class="actions">
        <a class="btn sm" href="/tpo/drives.html?new=1&company=${c.id}" title="Create a drive for this company">${icon('plus', 'sm')}Drive</a>
        <button class="btn sm ghost icon-only" data-edit="${c.id}" aria-label="Edit ${esc(c.name)}">${icon('edit', 'sm')}</button>
        <button class="btn sm ghost icon-only danger" data-del="${c.id}" aria-label="Delete ${esc(c.name)}">${icon('trash', 'sm')}</button></td></tr>`).join('')
      : `<tr><td colspan="7">${P.empty('building', list.length ? 'No companies match your search' : 'No companies yet', '', list.length ? '' : '<button class="btn primary" onclick="document.getElementById(\'add\').click()">Add the first company</button>')}</td></tr>`;
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
      </form>`,
      actions: [{ label: 'Cancel' }, { label: c.id ? 'Save changes' : 'Add company', variant: 'primary', onClick: async ({ body }) => {
        const data = P.formData(P.$('form', body));
        await api(c.id ? `/api/tpo/companies/${c.id}` : '/api/tpo/companies', { method: c.id ? 'PUT' : 'POST', body: data });
        toast(c.id ? 'Company updated' : `${data.name} added`); load();
      } }],
    });
  }

  async function del(c) {
    const ok = await P.confirm({
      title: `Delete ${c.name}?`, danger: true, confirmText: 'Delete company',
      message: c.drive_count ? `This also deletes <b>${P.plural(c.drive_count, 'drive')}</b> and every application in them (including ${P.plural(c.offer_count, 'offer')}). This cannot be undone.` : 'This cannot be undone.',
    });
    if (!ok) return;
    try { await api(`/api/tpo/companies/${c.id}`, { method: 'DELETE' }); toast(`${c.name} deleted`); load(); } catch (e) { fail(e); }
  }

  P.$('#add').onclick = () => form();
  P.$('#q').addEventListener('input', (e) => { q = e.target.value; render(); });
  await load();
});
