/* ============================================================
   analytics.js — NZC run chart, partnerships, wagon wheel analytics
   ============================================================ */

function renderNzcAnalytics() {
  const t1El = document.getElementById('nzcLegendTeam1');
  const t2El = document.getElementById('nzcLegendTeam2');
  if (t1El) t1El.innerText = match.innings1Score?.team || match.teamBatting || 'Team 1';
  if (t2El) t2El.innerText = (match.innings === 2 ? match.teamBatting : match.teamBowling) || 'Team 2';
  renderNzcRunChart();
  renderNzcPartnerships();
  renderNzcWagon();
}

function switchRunChart(mode) {
  nzcRunChartMode = mode;
  document.getElementById('btnManhattan').classList.toggle('active', mode === 'manhattan');
  document.getElementById('btnWorm').classList.toggle('active', mode === 'worm');
  renderNzcRunChart();
}

function switchWagonTeam(inn) {
  nzcWagonInnings = inn;
  document.getElementById('teamToggle1').classList.toggle('active', inn === 1);
  document.getElementById('teamToggle2').classList.toggle('active', inn === 2);
  renderNzcWagon();
}

function renderNzcRunChart() {
  const canvas = document.getElementById('runChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const isDark = !document.body.classList.contains('light-mode');
  ctx.clearRect(0, 0, W, H);

  const padding = { left: 55, right: 20, top: 20, bottom: 45 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const totalOv = match.totalOvers || 20;

  const overRunsPerInns = { 1: new Array(totalOv).fill(0), 2: new Array(totalOv).fill(0) };
  const overWicketsPerInns = { 1: new Array(totalOv).fill(0), 2: new Array(totalOv).fill(0) };
  const cumulativePerInns = { 1: new Array(totalOv + 1).fill(0), 2: new Array(totalOv + 1).fill(0) };
  const wicketsAtInns = { 1: [], 2: [] };

  (match.shotLog || []).forEach(s => {
    if (!s.over || s.over < 1 || s.over > totalOv) return;
    const ovIdx = s.over - 1;
    let r = s.runs || 0;
    if (s.extra === 'WD' || s.extra === 'NB') r += 1;
    overRunsPerInns[s.inns][ovIdx] += r;
    if (s.isWicket) overWicketsPerInns[s.inns][ovIdx] += 1;
  });

  for (const inn of [1, 2]) {
    let cum = 0;
    for (let i = 0; i < totalOv; i++) {
      cum += overRunsPerInns[inn][i];
      cumulativePerInns[inn][i + 1] = cum;
      if (overWicketsPerInns[inn][i] > 0) {
        for (let w = 0; w < overWicketsPerInns[inn][i]; w++) wicketsAtInns[inn].push({ over: i + 1, cum });
      }
    }
  }

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.08)' : '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';

  const maxRuns = Math.max(
    cumulativePerInns[1][totalOv] || 0,
    cumulativePerInns[2][totalOv] || 0,
    ...overRunsPerInns[1], ...overRunsPerInns[2], 10
  );

  if (nzcRunChartMode === 'manhattan') {
    const yMax = Math.ceil(maxRuns / 4) * 4 + 4;
    for (let i = 0; i <= 5; i++) {
      const v = Math.round((yMax / 5) * i);
      const y = H - padding.bottom - (chartH * i) / 5;
      ctx.fillText(v, 12, y + 4);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(W - padding.right, y); ctx.stroke();
    }
    for (let i = 1; i <= totalOv; i++) {
      const x = padding.left + (chartW * (i - 0.5)) / totalOv;
      if (totalOv <= 20 || i % Math.ceil(totalOv / 10) === 0) ctx.fillText(i, x - 5, H - padding.bottom + 16);
    }
    ctx.fillText('Overs', W / 2 - 20, H - 8);

    const gap = 2;
    const groupW = chartW / totalOv;
    const barW = (groupW - gap * 3) / 2;
    for (let i = 0; i < totalOv; i++) {
      const groupX = padding.left + i * groupW + gap;
      const r1 = overRunsPerInns[1][i];
      if (r1 > 0) { const h1 = (chartH * r1) / yMax; ctx.fillStyle = isDark ? '#f8fafc' : '#1e293b'; ctx.fillRect(groupX, H - padding.bottom - h1, barW, h1); }
      const r2 = overRunsPerInns[2][i];
      if (r2 > 0) { const h2 = (chartH * r2) / yMax; ctx.fillStyle = '#a855f7'; ctx.fillRect(groupX + barW + gap, H - padding.bottom - h2, barW, h2); }
      const totalWkts = overWicketsPerInns[1][i] + overWicketsPerInns[2][i];
      if (totalWkts > 0) {
        const maxH = Math.max((chartH * r1) / yMax, (chartH * r2) / yMax);
        const cx = groupX + groupW / 2 - gap;
        const cy = H - padding.bottom - maxH - 10;
        ctx.fillStyle = '#a855f7';
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('W', cx, cy + 4); ctx.textAlign = 'left';
        ctx.font = '11px -apple-system, sans-serif';
      }
    }
  } else {
    const yMax = Math.ceil(maxRuns / 20) * 20 + 20;
    for (let i = 0; i <= 5; i++) {
      const v = Math.round((yMax / 5) * i);
      const y = H - padding.bottom - (chartH * i) / 5;
      ctx.fillText(v, 12, y + 4);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(W - padding.right, y); ctx.stroke();
    }
    for (let i = 1; i <= totalOv; i++) {
      if (totalOv <= 20 || i % Math.ceil(totalOv / 10) === 0) {
        const x = padding.left + (chartW * (i - 0.5)) / totalOv;
        ctx.fillText(i, x - 5, H - padding.bottom + 16);
      }
    }
    ctx.fillText('Overs', W / 2 - 20, H - 8);
    const plotLine = (data, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= totalOv; i++) {
        const x = padding.left + (chartW * i) / totalOv;
        const y = H - padding.bottom - (chartH * data[i]) / yMax;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    plotLine(cumulativePerInns[1], isDark ? '#f8fafc' : '#1e293b');
    if (match.innings === 2 || cumulativePerInns[2][totalOv] > 0) plotLine(cumulativePerInns[2], '#a855f7');
    for (const inn of [1, 2]) {
      wicketsAtInns[inn].forEach(w => {
        const x = padding.left + (chartW * w.over) / totalOv;
        const y = H - padding.bottom - (chartH * w.cum) / yMax;
        ctx.fillStyle = '#a855f7';
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('W', x, y + 4); ctx.textAlign = 'left';
        ctx.font = '11px -apple-system, sans-serif';
      });
    }
  }
}

function renderNzcPartnerships() {
  const c = document.getElementById('nzcPartnershipsList');
  if (!c) return;
  const parts = [...match.partnerRuns];
  const current = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  if (current.runs > 0 || current.balls > 0 || match.isActive) parts.push(current);
  if (parts.length === 0) {
    c.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No partnerships recorded yet.</div>';
    return;
  }
  const max = Math.max(...parts.map(p => p.runs), 1);
  let html = '';
  parts.forEach((p, i) => {
    const w = Math.round((p.runs / max) * 100);
    const names = p.batters && p.batters.length ? p.batters.map(escapeHtml).join(' & ') : `Partnership ${i + 1}`;
    html += `<div class="nzc-part-row">
      <div style="min-width:110px;font-size:11px;color:var(--muted);">${names}</div>
      <div class="nzc-part-bar"><div class="nzc-part-fill" style="width:${w}%"></div></div>
      <div style="min-width:70px;text-align:right;"><b>${p.runs}</b> <span style="color:var(--muted);font-size:10px;">(${p.balls || 0}b)</span></div>
    </div>`;
  });
  c.innerHTML = html;
}

function switchWagonMode(mode) {
  nzcWagonMode = mode;
  document.getElementById('wagonTabWagon').classList.toggle('active', mode === 'wagon');
  document.getElementById('wagonTabSpider').classList.toggle('active', mode === 'spider');
  document.getElementById('wagonTabCatch').classList.toggle('active', mode === 'catch');
  document.getElementById('nzcWagonLegend').style.display = (mode === 'spider') ? 'flex' : 'none';
  renderNzcWagon();
}

function renderNzcWagon() {
  const canvas = document.getElementById('nzcWagonCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 30;
  const isDark = !document.body.classList.contains('light-mode');
  ctx.clearRect(0, 0, W, H);

  const fieldGrad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
  if (isDark) {
    fieldGrad.addColorStop(0, 'rgba(34,90,45,.55)');
    fieldGrad.addColorStop(1, 'rgba(20,60,30,.7)');
  } else {
    fieldGrad.addColorStop(0, '#c8e6c9');
    fieldGrad.addColorStop(1, '#a5d6a7');
  }
  ctx.fillStyle = fieldGrad;
  ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 1.05, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.98, R * 1.03, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.6, R * 0.63, 0, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#e0c9a6';
  ctx.fillRect(cx - 7, cy - 35, 14, 70);
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(cx - 3, cy - 38, 6, 4);
  ctx.fillRect(cx - 3, cy + 34, 6, 4);

  const filteredShots = (match.shotLog || []).filter(s => s.inns === nzcWagonInnings);
  const sectorAngles = [-Math.PI / 8, Math.PI / 8, 3 * Math.PI / 8, 5 * Math.PI / 8, 7 * Math.PI / 8, 9 * Math.PI / 8, 11 * Math.PI / 8, 13 * Math.PI / 8];

  if (nzcWagonMode === 'wagon') {
    const sectorRuns = new Array(8).fill(0);
    filteredShots.forEach(s => {
      if (!s.zone || s.zoneIndex < 0) return;
      sectorRuns[s.zoneIndex] += s.runs;
    });
    const maxRuns = Math.max(...sectorRuns, 1);
    for (let i = 0; i < 8; i++) {
      const a0 = sectorAngles[i];
      const a1 = a0 + Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.75, a0, a1); ctx.closePath();
      const intensity = sectorRuns[i] / maxRuns;
      ctx.fillStyle = `rgba(255,152,0,${0.15 + intensity * 0.55})`;
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R * 0.75, cy + Math.sin(a0) * R * 0.75);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const midAngle = sectorAngles[i] + Math.PI / 8;
      const bx = cx + Math.cos(midAngle) * R * 0.55;
      const by = cy + Math.sin(midAngle) * R * 0.55;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,.95)' : '#fff';
      ctx.beginPath(); ctx.roundRect(bx - 18, by - 13, 36, 26, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sectorRuns[i], bx, by + 5);
      ctx.textAlign = 'left';
    }
    const sum = document.getElementById('nzcWagonSummary');
    if (sum) sum.innerText = `${filteredShots.length} shots • ${filteredShots.reduce((a, b) => a + b.runs, 0)} runs • ${filteredShots.filter(s => s.isBoundary).length} boundaries`;
  } else if (nzcWagonMode === 'spider') {
    filteredShots.forEach(s => {
      if (!s.zone || s.zoneIndex < 0) return;
      const baseAngle = sectorAngles[s.zoneIndex] + Math.PI / 8;
      const jitter = (Math.random() - 0.5) * 0.35;
      const angle = baseAngle + jitter;
      let len;
      let isSixFlight = false;
      if (s.isSix) {
        const d = (typeof s.distance === 'number' && s.distance > 0) ? s.distance : 75;
        const distRatio = Math.max(0, Math.min(1, (d - 75) / 45));
        len = R * (1.05 + distRatio * 0.08);
        isSixFlight = true;
      } else if (s.isFour) len = R * 0.95;
      else len = R * (0.3 + Math.random() * 0.4);
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len;
      let color = '#94a3b8';
      if (s.isSix) color = '#d946ef'; else if (s.isFour) color = '#22d3ee';
      ctx.strokeStyle = color;
      ctx.lineWidth = s.isBoundary ? 2 : 1.2;
      ctx.globalAlpha = s.isBoundary ? 1 : 0.7;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = 1;
      if (isSixFlight) {
        ctx.save();
        ctx.fillStyle = '#ff0000'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
        if (s.distance) {
          ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
          ctx.font = 'bold 10px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(s.distance + 'm', ex, ey - 10);
          ctx.textAlign = 'left';
        }
      }
    });
    const sum = document.getElementById('nzcWagonSummary');
    if (sum) sum.innerText = `${filteredShots.length} shots • ${filteredShots.filter(s => s.isBoundary).length} boundaries`;
  } else if (nzcWagonMode === 'catch') {
    const wickets = filteredShots.filter(s => s.isWicket);
    wickets.forEach(w => {
      let baseAngle = -Math.PI / 2;
      if (w.zoneIndex >= 0) baseAngle = sectorAngles[w.zoneIndex] + Math.PI / 8;
      const jitter = (Math.random() - 0.5) * 0.4;
      const angle = baseAngle + jitter;
      const radius = R * (0.5 + Math.random() * 0.4);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.fillStyle = isDark ? '#0f172a' : '#000';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    const sum = document.getElementById('nzcWagonSummary');
    if (sum) sum.innerText = `${wickets.length} wicket${wickets.length !== 1 ? 's' : ''} • Innings ${nzcWagonInnings}`;
  }
}
