/* TPO: reports & CSV exports (open in Excel) */
P.page({ title: 'Reports & Exports' }, async (me, root) => {
  const { esc, icon, ctc } = P;
  const s = await P.api('/api/tpo/stats');
  const t = s.totals;
  const exports = [
    ['placements', 'Placement report', 'Every offer: student, branch, company, role, CTC and date.', '/api/tpo/export/placements.csv'],
    ['branch', 'Branch-wise summary', 'Final-year students, number placed, placement %, highest and average CTC per branch.', '/api/tpo/export/branch-report.csv'],
    ['students', 'All students', 'Complete student master list with academics, verification and placement status.', '/api/tpo/export/students.csv'],
    ['unplaced', 'Unplaced BE students', 'Verified final-year students still without an offer — useful for targeting upcoming drives.', '/api/tpo/export/students.csv?year=BE&placed=0&verified=1'],
  ];
  root.innerHTML = `
    <div class="page-head"><div><h1>Reports &amp; exports</h1><p>Download CSV files for NAAC/NIRF reporting, management reviews or company shortlists. They open directly in Excel.</p></div>
      <button class="btn" onclick="window.print()">${icon('file')}Print this page</button></div>
    <div class="grid cols-2" style="margin-bottom:16px">${exports.map(([k, title, desc, url]) => `
      <div class="card"><div class="card-body row" style="gap:14px;align-items:flex-start">
        <span class="file-icon" style="background:var(--ok-soft);color:var(--ok)">CSV</span>
        <div class="grow"><h3>${title}</h3><p class="small muted" style="margin-top:3px">${desc}</p></div>
        <button class="btn sm no-print" data-url="${url}">${icon('download', 'sm')}Download</button></div></div>`).join('')}</div>

    <div class="card">
      <div class="card-head"><h2>Branch-wise placement summary</h2><span class="small muted">Final-year (BE) students</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Branch</th><th style="text-align:right">Students</th><th style="text-align:right">Placed</th>
        <th style="width:34%">Placement rate</th></tr></thead><tbody>
        ${s.branchStats.map((b) => `<tr><td>${esc(b.name)} <span class="faint small">${b.code}</span></td><td style="text-align:right" class="num">${b.total}</td>
          <td style="text-align:right" class="num">${b.placed}</td>
          <td><div class="row" style="gap:10px"><div class="progress grow"><i style="width:${b.rate}%;background:var(--chart)"></i></div><span class="num small" style="width:38px;text-align:right">${b.rate}%</span></div></td></tr>`).join('')}
        <tr><td><b>All branches</b></td><td style="text-align:right" class="num"><b>${t.beStudents}</b></td><td style="text-align:right" class="num"><b>${t.placed}</b></td>
          <td><b class="num">${t.placementRate}%</b> <span class="small muted">· highest ${ctc(t.highestCtc)} · average ${ctc(t.averageCtc)} · median ${ctc(t.medianCtc)}</span></td></tr>
      </tbody></table></div>
    </div>`;
  P.$$('[data-url]').forEach((b) => b.onclick = () => P.download(b.dataset.url));
});
