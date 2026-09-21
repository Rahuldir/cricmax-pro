/* ============================================================
   exports.js — PDF, CSV, JSON, and image exports
   ============================================================ */

function exportCommentaryPDF() {
  if (!window.jspdf) return alert("PDF library loading...");
  if (!match.commentary || match.commentary.length === 0) return alert("No commentary to export.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFillColor(10, 14, 26);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(0, 230, 118);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('CRICMAX PRO — MATCH COMMENTARY', 14, 16);
  doc.setTextColor(255, 255, 255); doc.setFontSize(9);
  doc.text(`${match.teamBatting} vs ${match.teamBowling} | ${match.venue}`, 14, 25);
  let y = 40;
  doc.setTextColor(0, 0, 0); doc.setFontSize(11);
  doc.text(`Score: ${match.teamBatting} ${match.runs}/${match.wickets} (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6})`, 14, y);
  y += 8;
  doc.setFontSize(8);
  match.commentary.forEach(c => {
    if (y > 275) { doc.addPage(); y = 20; }
    if (c.type === 'summary') {
      doc.setTextColor(34, 211, 238); doc.setFont('helvetica', 'italic');
      const sp = doc.splitTextToSize(String(c.desc).replace(/<[^>]+>/g, ' '), 150);
      doc.text(sp, 14, y); y += sp.length * 3.5 + 2.5;
      return;
    }
    doc.setTextColor(0, 146, 112); doc.setFont('helvetica', 'bold');
    doc.text(`[${c.ball}]`, 14, y);
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal');
    const sp = doc.splitTextToSize(c.desc, 150);
    doc.text(sp, 35, y); y += sp.length * 4 + 3.5;
  });
  doc.save(`CricMax_Commentary_${match.teamBattingAbbr || 'Match'}.pdf`);
}

function exportStatsReportPDF() {
  if (!window.jspdf) return alert("PDF library loading...");
  const pool = buildStatsPool();
  if (!pool.length) return alert("No stats available to export yet.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const PW = 210, PH = 297, LM = 14, RM = 196;
  let y = 0;

  const header = () => {
    doc.setFillColor(10, 14, 26);
    doc.rect(0, 0, PW, 32, 'F');
    doc.setTextColor(0, 230, 118);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('CRICMAX PRO — COMPLETE STATS REPORT', LM, 15);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`${match.teamBatting} vs ${match.teamBowling}   |   ${match.venue || ''}   |   ${new Date().toLocaleDateString()}`, LM, 23);
    doc.text(`${match.teamBatting} ${match.runs}/${match.wickets}  (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} ov)`, LM, 28);
    doc.setTextColor(0, 0, 0); y = 42;
  };
  const ensure = (need) => { if (y + need > PH - 16) { doc.addPage(); header(); return true; } return false; };
  const sectionTitle = (t) => {
    ensure(22);
    doc.setFillColor(0, 146, 112);
    doc.rect(LM, y - 5.5, RM - LM, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(t, LM + 2, y + 1);
    doc.setTextColor(0, 0, 0); y += 11;
  };
  const drawTable = (cols, rows, emptyMsg) => {
    const head = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(90);
      cols.forEach(c => doc.text(c.label, c.x, y, { align: c.align || 'left' }));
      y += 3;
      doc.setDrawColor(190); doc.line(LM, y, RM, y);
      y += 4.5;
      doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    };
    ensure(22); head();
    if (!rows.length) {
      doc.setTextColor(150); doc.text(emptyMsg || 'No data available', LM + 2, y);
      doc.setTextColor(0); y += 8; return;
    }
    rows.forEach(r => {
      if (y + 6 > PH - 16) { doc.addPage(); header(); head(); }
      cols.forEach(c => {
        const v = typeof c.val === 'function' ? c.val(r) : (r[c.key] !== undefined ? r[c.key] : '');
        doc.text(String(v), c.x, y, { align: c.align || 'left' });
      });
      y += 5;
    });
    y += 5;
  };

  header();
  sectionTitle('MATCH SUMMARY');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const sumLines = [];
  if (match.innings1Score) {
    const i1 = match.innings1Score;
    sumLines.push(`${i1.team}:  ${i1.runs}/${i1.wickets}   (${Math.floor(i1.balls / 6)}.${i1.balls % 6} ov)`);
  }
  sumLines.push(`${match.teamBatting}:  ${match.runs}/${match.wickets}   (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} ov)`);
  if (match.innings === 2 && match.target) sumLines.push(`Target: ${match.target}`);
  sumLines.push(`Venue: ${match.venue || '-'}   |   Overs: ${match.totalOvers}`);
  sumLines.forEach(l => { ensure(8); doc.text(l, LM + 2, y); y += 5; });
  y += 5;

  const mvpRows = [...pool].sort((a, b) => b.mvp - a.mvp).slice(0, 10);
  sectionTitle('1. MVP LEADERBOARD (TOP 10)');
  drawTable([
    { label: '#', x: 16, val: (r) => mvpRows.indexOf(r) + 1 },
    { label: 'Player', x: 26, key: 'name' }, { label: 'Team', x: 92, key: 'team' },
    { label: 'MVP', x: 128, align: 'right', key: 'mvp' }, { label: 'Runs', x: 150, align: 'right', key: 'runs' },
    { label: 'Wkts', x: 166, align: 'right', key: 'wickets' }, { label: 'Ct', x: 184, align: 'right', key: 'catches' }
  ], mvpRows);

  const runsRows = [...pool].sort((a, b) => b.runs - a.runs || b.sr - a.sr).slice(0, 10);
  sectionTitle('2. MOST RUNS (TOP 10)');
  drawTable([
    { label: '#', x: 16, val: (r) => runsRows.indexOf(r) + 1 },
    { label: 'Player', x: 26, key: 'name' }, { label: 'Team', x: 82, key: 'team' },
    { label: 'Runs', x: 112, align: 'right', key: 'runs' }, { label: 'Balls', x: 130, align: 'right', key: 'balls' },
    { label: '4s', x: 150, align: 'right', key: 'fours' }, { label: '6s', x: 168, align: 'right', key: 'sixes' },
    { label: 'SR', x: 194, align: 'right', val: (r) => r.sr.toFixed(1) }
  ], runsRows);

  const wktRows = [...pool].filter(p => p.bowlBalls > 0).sort((a, b) => b.wickets - a.wickets || a.eco - b.eco).slice(0, 10);
  sectionTitle('3. MOST WICKETS (TOP 10)');
  drawTable([
    { label: '#', x: 16, val: (r) => wktRows.indexOf(r) + 1 },
    { label: 'Player', x: 26, key: 'name' }, { label: 'Team', x: 90, key: 'team' },
    { label: 'Wkts', x: 118, align: 'right', key: 'wickets' },
    { label: 'Overs', x: 142, align: 'right', val: (r) => `${Math.floor(r.bowlBalls / 6)}.${r.bowlBalls % 6}` },
    { label: 'Runs', x: 166, align: 'right', key: 'bowlRuns' },
    { label: 'Eco', x: 194, align: 'right', val: (r) => r.eco.toFixed(2) }
  ], wktRows, 'No bowling data yet');

  const batRows = [...pool].sort((a, b) => b.runs - a.runs);
  sectionTitle('4. FULL BATTING');
  drawTable([
    { label: 'Player', x: 16, key: 'name' }, { label: 'Team', x: 70, key: 'team' },
    { label: 'R', x: 100, align: 'right', key: 'runs' }, { label: 'B', x: 114, align: 'right', key: 'balls' },
    { label: '4s', x: 128, align: 'right', key: 'fours' }, { label: '6s', x: 142, align: 'right', key: 'sixes' },
    { label: 'SR', x: 162, align: 'right', val: (r) => r.sr.toFixed(1) },
    { label: '50', x: 178, align: 'right', key: 'fifties' }, { label: '100', x: 194, align: 'right', key: 'hundreds' }
  ], batRows);

  const bowlRows = [...pool].filter(p => p.bowlBalls > 0).sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
  sectionTitle('5. FULL BOWLING');
  drawTable([
    { label: 'Player', x: 16, key: 'name' }, { label: 'Team', x: 64, key: 'team' },
    { label: 'O', x: 92, align: 'right', val: (r) => `${Math.floor(r.bowlBalls / 6)}.${r.bowlBalls % 6}` },
    { label: 'M', x: 106, align: 'right', key: 'maidens' }, { label: 'R', x: 120, align: 'right', key: 'bowlRuns' },
    { label: 'W', x: 134, align: 'right', key: 'wickets' }, { label: 'Eco', x: 154, align: 'right', val: (r) => r.eco.toFixed(2) },
    { label: 'Avg', x: 174, align: 'right', val: (r) => r.bowlAvg > 0 ? r.bowlAvg.toFixed(1) : '-' },
    { label: 'SR', x: 194, align: 'right', val: (r) => r.bowlSR > 0 ? r.bowlSR.toFixed(1) : '-' }
  ], bowlRows, 'No bowling data yet');
  doc.save(`CricMax_FullStats_${match.teamBattingAbbr || 'Match'}.pdf`);
}

function exportBallByBallCommentaryTXT() {
  if (!match.commentary || match.commentary.length === 0) return alert("No commentary.");
  let t = `CRICMAX PRO\n${match.teamBatting} vs ${match.teamBowling}\n${match.venue}\nScore: ${match.runs}/${match.wickets} (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} ov)\n\n`;
  match.commentary.forEach(c => {
    const txt = String(c.desc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    t += `[${c.ball}] ${txt}\n`;
  });
  const blob = new Blob([t], { type: 'text/plain' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = `CricMax_Commentary.txt`; a.click();
  URL.revokeObjectURL(u);
}

function exportFullMatchStatsCSV() {
  const pool = buildStatsPool();
  if (!pool.length) return alert("No stats available yet.");
  let csv = '#,Player,Team,Status,Runs,Balls,4s,6s,50s,100s,SR,DotsFaced,Overs,Maidens,RunsConceded,Wickets,Eco,BowlAvg,BowlSR,3W,5W,Catches,Stumpings,RunOuts,TotalDismissals,MVP\n';
  pool.forEach((p, i) => {
    const ov = `${Math.floor(p.bowlBalls / 6)}.${p.bowlBalls % 6}`;
    csv += `${i + 1},"${p.name}","${p.team}","${p.status}",${p.runs},${p.balls},${p.fours},${p.sixes},${p.fifties},${p.hundreds},${p.sr.toFixed(2)},${p.dotsFaced},${ov},${p.maidens},${p.bowlRuns},${p.wickets},${p.eco === 99.9 ? '' : p.eco.toFixed(2)},${p.bowlAvg > 0 ? p.bowlAvg.toFixed(2) : ''},${p.bowlSR > 0 ? p.bowlSR.toFixed(2) : ''},${p.threeW},${p.fiveW},${p.catches},${p.stumpings},${p.runOuts},${p.totalDismissals},${p.mvp}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = `CricMax_FullStats.csv`; a.click();
  URL.revokeObjectURL(u);
}

function exportCompleteMatchJSON() {
  const d = {
    currentTourn, currentTournId, tournamentsHistory, savedTeams, pastMatchesLedger,
    match, bowlerTypeMap, matchConfig, matchCode,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = `CricMax_Match_${match.teamBattingAbbr || 'Match'}.json`; a.click();
  URL.revokeObjectURL(u);
}

function exportTournamentPointsCSV() {
  if (!pastMatchesLedger || pastMatchesLedger.length === 0) return alert("No matches recorded.");
  let csv = 'Fixture,Result,Venue,Date\n';
  pastMatchesLedger.forEach(pm => {
    csv += `"${pm.fixture}","${pm.result}","${pm.venue}","${pm.date}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = `CricMax_Tournament.csv`; a.click();
  URL.revokeObjectURL(u);
}

function exportScorecardImage() {
  if (!window.html2canvas) return alert("Image library loading...");
  const el = document.getElementById('pane-scorecard');
  const wasActive = el.classList.contains('active');
  if (!wasActive) {
    document.querySelectorAll('.sub-pane').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
  }
  html2canvas(el, { backgroundColor: '#0b1220', scale: 2 }).then(canvas => {
    const u = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = u; a.download = `CricMax_Scorecard.png`; a.click();
    if (!wasActive) { el.classList.remove('active'); selectSubPane('scorecard'); }
  });
}
