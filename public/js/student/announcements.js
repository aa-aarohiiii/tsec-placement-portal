/* Student: announcements from the T&P cell (everyone / my branch / my drives) */
P.page({ title: 'Announcements' }, async (me, root) => {
  const { esc, icon, utc, relTime, fmtDateTime } = P;
  const list = await P.api('/api/student/announcements'); // also marks them as seen
  const newCount = list.filter((a) => a.is_new).length;
  root.innerHTML = `
    <div class="page-head"><div><h1>Announcements</h1>
      <p>Notices from the Training &amp; Placement cell${newCount ? ` · <b style="color:var(--brand-text)">${newCount} new</b>` : ''}</p></div></div>
    <div class="card">${list.length ? list.map((a) => `
      <article class="ann ${a.is_new ? 'new' : ''}">
        <h3>${a.is_pinned ? `<span class="badge brand plain">${icon('pin', 'sm')}Pinned</span>` : ''}${esc(a.title)}${a.is_new ? '<span class="badge info">New</span>' : ''}</h3>
        <p class="body">${esc(a.body)}</p>
        <div class="meta"><span title="${fmtDateTime(utc(a.created_at))}">${relTime(utc(a.created_at))}</span>
          <span>·</span><span class="tag">${a.audience === 'ALL' ? 'All students' : a.audience === 'BRANCH' ? esc(P.branchName(a.audience_value)) : esc(a.drive_label || 'Drive applicants')}</span></div>
      </article>`).join('') : P.empty('megaphone', 'No announcements yet', 'Notices from the TPO will appear here.')}</div>`;
  // Clear the sidebar counter now that they've been seen.
  P.$$('.nav .count').forEach((c) => c.remove());
});
