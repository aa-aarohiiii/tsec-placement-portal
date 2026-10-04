/* TPO: student directory — search, filter, sort, bulk verify, bulk assign to drive, export */
P.page({ title: 'Students' }, async (me, root) => {
  const { esc, icon, cgpa, ctc, api, toast, fail } = P;
  const PAGE = 15;
  const params = new URLSearchParams(location.search);
  const f = {
    q: params.get('q') || '', branch: params.get('branch') || '', year: params.get('year') || '', verified: params.get('verified') || '',
    placed: params.get('placed') || '', minCgpa: params.get('minCgpa') || '', maxBacklogs: params.get('maxBacklogs') || '', resume: params.get('resume') || '',
    sort: params.get('sort') || 'name', dir: params.get('dir') || 'asc',
  };
  let rows = [];
  let page = 1;
  const selected = new Set();

  const opt = (val, label, cur) => `<option value="${val}" ${String(cur) === String(val) ? 'selected' : ''}>${label}</option>`;
  root.innerHTML = `
    <div class="page-head"><div><h1>Students</h1><p>Every registered student. Open a profile to review the resume and verify details.</p></div>
      <button class="btn" id="export">${icon('download')}Export CSV</button></div>
    <div class="card">
      <div class="toolbar">
        <div class="input-icon" style="width:260px">${icon('search')}<input class="input" id="q" placeholder="Name, roll no, email or skill" value="${esc(f.q)}"></div>
        <select class="select" data-f="branch">${opt('', 'All branches', f.branch)}${Object.entries(P.meta.branches).map(([k, v]) => opt(k, esc(v), f.branch)).join('')}</select>
        <select class="select" data-f="year">${opt('', 'TE + BE', f.year)}${opt('BE', 'BE only', f.year)}${opt('TE', 'TE only', f.year)}</select>
        <select class="select" data-f="verified">${opt('', 'Any status', f.verified)}${opt('1', 'Verified', f.verified)}${opt('0', 'Pending verification', f.verified)}</select>
        <select class="select" data-f="placed">${opt('', 'Placed + unplaced', f.placed)}${opt('1', 'Placed', f.placed)}${opt('0', 'Not placed', f.placed)}</select>
        <select class="select" data-f="minCgpa">${opt('', 'Any CGPA', f.minCgpa)}${[6, 6.5, 7, 7.5, 8, 8.5, 9].map((c) => opt(c, `CGPA ≥ ${c}`, f.minCgpa)).join('')}</select>
        <select class="select" data-f="maxBacklogs">${opt('', 'Any backlogs', f.maxBacklogs)}${opt(0, 'No backlogs', f.maxBacklogs)}${opt(1, '≤ 1 backlog', f.maxBacklogs)}${opt(2, '≤ 2 backlogs', f.maxBacklogs)}</select>
        <button class="btn ghost sm" id="clear">Clear</button>
      </div>
      <div class="bulkbar hidden" id="bulk">
        <span id="sel-n"></span><div class="grow"></div>
        <button class="btn sm" id="b-verify">${icon('shield', 'sm')}Verify</button>
        <button class="btn sm primary" id="b-assign">${icon('userPlus', 'sm')}Assign to drive</button>
        <button class="btn sm ghost" id="b-clear">Clear selection</button>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr>
        <th class="check-col"><input type="checkbox" id="all" class="check" aria-label="Select all on this page"></th>
        <th class="sortable" data-s="name">Student</th><th class="sortable" data-s="branch">Branch</th>
        <th class="sortable" data-s="cgpa" style="text-align:right">CGPA</th><th style="text-align:center">KTs</th>
        <th>Status</th><th>Placement</th><th class="hide-sm" style="text-align:center">Apps</th><th></th>
      </tr></thead><tbody id="tbody"></tbody></table></div>
      <div class="pager" id="pager"></div>
    </div>`;

  const query = () => new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString();

  async function load() {
    P.$('#tbody').innerHTML = `<tr><td colspan="9"><div class="page-loading" style="padding:40px"><span class="spinner"></span></div></td></tr>`;
    rows = await api('/api/tpo/students?' + query());
    history.replaceState(null, '', '?' + query());
    page = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
    render();
  }

  function render() {
    P.$$('th.sortable').forEach((th) => {
      th.querySelector('.arrow')?.remove();
      if (th.dataset.s === f.sort) th.insertAdjacentHTML('beforeend', `<span class="arrow">${f.dir === 'asc' ? '▲' : '▼'}</span>`);
    });
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    const tb = P.$('#tbody');
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="9">${P.empty('users', 'No students match these filters', 'Try clearing a filter or two.')}</td></tr>`;
    } else {
      tb.innerHTML = slice.map((s) => `<tr class="${selected.has(s.id) ? 'selected' : ''}">
        <td class="check-col"><input type="checkbox" class="check" data-id="${s.id}" ${selected.has(s.id) ? 'checked' : ''} aria-label="Select ${esc(s.name)}"></td>
        <td><a class="person" href="/tpo/student.html?id=${s.id}" style="color:inherit">${P.avatar(s.name)}<span class="who"><b>${esc(s.name)}</b><span class="mono">${esc(s.roll_no)}</span> <span>· ${s.year}</span></span></a></td>
        <td title="${esc(P.branchName(s.branch))}">${esc(s.branch)}</td>
        <td style="text-align:right" class="num"><b style="font-weight:600">${cgpa(s.cgpa)}</b></td>
        <td style="text-align:center" class="num ${s.backlogs ? '' : 'faint'}">${s.backlogs ?? 0}</td>
        <td>${s.is_verified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Pending</span>'}${s.has_resume ? '' : ' <span class="badge bad plain" title="No resume uploaded">No CV</span>'}</td>
        <td>${s.best_ctc != null ? `<div class="small" style="font-weight:500">${esc(s.placed_company)}</div><div class="tiny muted">${ctc(s.best_ctc)}</div>` : '<span class="faint small">—</span>'}</td>
        <td class="hide-sm num" style="text-align:center">${s.app_count}</td>
        <td class="actions"><a class="btn sm" href="/tpo/student.html?id=${s.id}">View</a></td></tr>`).join('');
    }
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    P.$('#pager').innerHTML = `<span>${rows.length ? `Showing ${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, rows.length)} of ${rows.length}` : '0 students'}</span>
      <div class="row"><button class="btn sm icon-only" id="prev" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevronLeft', 'sm')}</button>
        <span class="num">Page ${page} / ${pages}</span>
        <button class="btn sm icon-only" id="next" ${page >= pages ? 'disabled' : ''} aria-label="Next page">${icon('chevronRight', 'sm')}</button></div>`;
    P.$('#prev').onclick = () => { page--; render(); };
    P.$('#next').onclick = () => { page++; render(); };

    P.$$('#tbody [data-id]').forEach((c) => c.onchange = () => { c.checked ? selected.add(+c.dataset.id) : selected.delete(+c.dataset.id); c.closest('tr').classList.toggle('selected', c.checked); bulk(); });
    const all = P.$('#all');
    all.checked = slice.length > 0 && slice.every((s) => selected.has(s.id));
    all.onchange = () => { slice.forEach((s) => all.checked ? selected.add(s.id) : selected.delete(s.id)); render(); };
    bulk();
  }

  function bulk() {
    P.$('#bulk').classList.toggle('hidden', !selected.size);
    P.$('#sel-n').textContent = `${P.plural(selected.size, 'student')} selected`;
  }

  // filters
  P.$('#q').addEventListener('input', P.debounce((e) => { f.q = e.target.value.trim(); page = 1; load(); }, 250));
  P.$$('[data-f]').forEach((sel) => sel.onchange = () => { f[sel.dataset.f] = sel.value; page = 1; load(); });
  P.$('#clear').onclick = () => { Object.assign(f, { q: '', branch: '', year: '', verified: '', placed: '', minCgpa: '', maxBacklogs: '', resume: '' });
    P.$('#q').value = ''; P.$$('[data-f]').forEach((s) => { s.value = ''; }); page = 1; load(); };
  P.$$('th.sortable').forEach((th) => th.onclick = () => {
    f.dir = f.sort === th.dataset.s && f.dir === 'asc' ? 'desc' : 'asc'; f.sort = th.dataset.s; load();
  });

  // bulk actions
  P.$('#b-clear').onclick = () => { selected.clear(); render(); };
  P.$('#b-verify').onclick = async () => {
    const ok = await P.confirm({ title: `Verify ${P.plural(selected.size, 'student')}?`, message: 'Verified students can apply to drives. Their academic details get locked. Students without CGPA or resume are skipped.', confirmText: 'Verify' });
    if (!ok) return;
    try {
      const r = await api('/api/tpo/students/verify-bulk', { method: 'POST', body: { ids: [...selected] } });
      toast(`${P.plural(r.verified, 'student')} verified${r.skipped.length ? ` · skipped ${r.skipped.length} (incomplete profile)` : ''}`);
      selected.clear(); load();
    } catch (e) { fail(e); }
  };
  P.$('#b-assign').onclick = async () => {
    const r = await P.assignToDrive([...selected]).catch((e) => { fail(e); return null; });
    if (r && r.assigned.length) { selected.clear(); load(); }
  };
  P.$('#export').onclick = () => P.download('/api/tpo/export/students.csv?' + query());

  await load();
});
