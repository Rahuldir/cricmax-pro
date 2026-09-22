/* ============================================================
   render.js — Live pane, commentary, summary, scorecard, TV, wagon
   ============================================================ */

/* ─── helpers ───────────────────────────────────────────── */
function _playerLink(name) {
  if (!name) return '';
  const safe = escapeHtml(name).replace(/'/g, "\\'");
  return `<span class="player-link" onclick="openPlayerCareerModal('${safe}')" style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">${escapeHtml(name)}</span>`;
}

function updateLiveShareBadge() {
  const badge = document.getElementById('liveShareBadge');
  const codeEl = document.getElementById('liveShareCodeText');
  if (!badge || !codeEl) return;
  if (matchCode && match.isActive && !isViewerMode) {
    badge.style.display = 'inline-flex';
    codeEl.innerText = matchCode;
  } else badge.style.display = 'none';
}

function showLiveViewerPulse() {
  const el = document.getElementById('liveViewerPulse');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(window._viewerPulseTimer);
  window._viewerPulseTimer = setTimeout(() => { el.style.opacity = '.35'; }, 400);
}

/* ═══════════════════════════════════════════════════════════
   RENDER LIVE — main live pane
   ═══════════════════════════════════════════════════════════ */
function renderLive() {
  if (!match.teamBatting) return;
  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  const crr = match.legalBalls > 0 ? (match.runs / (match.legalBalls / 6)).toFixed(2) : "0.00";

  /* Score */
  const st = document.getElementById('liveScoreText');
  if (st) {
    st.innerHTML = `<span class="team-name">${escapeHtml(match.teamBatting)}</span><span class="score-num">${match.runs}/${match.wickets}</span> <span style="font-size:15px;color:var(--muted);">(${ov})</span>`;
  }
  const crrVal = document.getElementById('crrVal');
  if (crrVal) crrVal.innerText = crr;

  const ub = document.getElementById('undoBtn');
  if (ub) ub.disabled = historyStack.length === 0 || isViewerMode;

  if (match.innings === 2) {
    const bl = (match.totalOvers * 6) - match.legalBalls;
    const rn = Math.max(0, match.target - match.runs);
    const rrrVal = document.getElementById('rrrVal');
    if (rrrVal) rrrVal.innerText = bl > 0 ? (rn / (bl / 6)).toFixed(2) : '0.00';
  }

  const s = match.batters[match.striker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const ns = match.batters[match.nonStriker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };

  /* ── Striker card — CLICKABLE NAME ── */
  const sn = document.getElementById('strikerName');
  if (sn) sn.innerHTML = `${_playerLink(match.striker)}*`;
  if (document.getElementById('strikerRuns')) document.getElementById('strikerRuns').innerText = `${s.runs} (${s.balls})`;
  if (document.getElementById('strikerSR')) document.getElementById('strikerSR').innerText = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : "0.0";
  if (document.getElementById('striker4s')) document.getElementById('striker4s').innerText = s.fours;
  if (document.getElementById('striker6s')) document.getElementById('striker6s').innerText = s.sixes;

  /* ── Non-striker card — CLICKABLE NAME ── */
  const nsn = document.getElementById('nonStrikerName');
  if (nsn) nsn.innerHTML = _playerLink(match.nonStriker);
  if (document.getElementById('nonStrikerRuns')) document.getElementById('nonStrikerRuns').innerText = `${ns.runs} (${ns.balls})`;
  if (document.getElementById('nonStrikerSR')) document.getElementById('nonStrikerSR').innerText = ns.balls > 0 ? ((ns.runs / ns.balls) * 100).toFixed(1) : "0.0";
  if (document.getElementById('nonStriker4s')) document.getElementById('nonStriker4s').innerText = ns.fours;
  if (document.getElementById('nonStriker6s')) document.getElementById('nonStriker6s').innerText = ns.sixes;

  /* ── Bowler card — CLICKABLE NAME ── */
  const bw = match.bowlers[match.currentBowler] || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
  const bn = document.getElementById('bowlerName');
  if (bn) bn.innerHTML = _playerLink(match.currentBowler);
  if (document.getElementById('bowlerFigures')) document.getElementById('bowlerFigures').innerText = `${Math.floor(bw.balls / 6)}.${bw.balls % 6}-${bw.maidens}-${bw.runs}-${bw.wickets}`;
  if (document.getElementById('bowlerEco')) document.getElementById('bowlerEco').innerText = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(2) : "0.00";

  /* ── This-over summary ── */
  const oc = document.getElementById('overCommentaryStrip');
  if (oc) {
    oc.innerHTML = '';
    if (match.currentOverBalls.length > 0 || match._lastOverRuns !== undefined) {
      const b = document.createElement('div');
      b.className = 'over-block';
      const overRuns = match._currentOverRuns || 0;
      const lastOver = match.oversTimeline && match.oversTimeline.length
        ? match.oversTimeline[match.oversTimeline.length - 1] : null;
      const pills = match.currentOverBalls.map(x =>
        `<span class="ball-pill ${x==='4'?'c-4':x==='6'?'c-6':x==='W'?'c-w':''}" style="width:22px;height:22px;font-size:9px;">${x}</span>`
      ).join('');
      b.innerHTML = `
        <div class="over-block-num">This Over • ${overRuns} run${overRuns!==1?'s':''}</div>
        <div class="over-block-balls">${pills || '<span style="color:var(--muted);font-size:10px;font-style:italic;">new over</span>'}</div>
        ${lastOver ? `<div style="font-size:10px;color:var(--muted);margin-top:4px;">Prev: ${lastOver.balls.join(' ')}</div>` : ''}
      `;
      oc.appendChild(b);
    }
  }

  renderScorecard();
  renderSummary();
  const tv = document.getElementById('tvMode');
  if (tv && tv.classList.contains('active')) renderTVMode();

  /* Ensure Retire + Bowler buttons stay wired */
  if (typeof injectRetireButton === 'function') injectRetireButton();
}

/* ═══════════════════════════════════════════════════════════
   RENDER COMMENTARY
   ═══════════════════════════════════════════════════════════ */
function renderCommentary() {
  const c = document.getElementById('commentaryContainer');
  if (!c) return;
  if (!match.commentary || match.commentary.length === 0) {
    c.innerHTML = `<div class="empty-comm">No deliveries yet.</div>`;
    return;
  }
  c.innerHTML = '';
  match.commentary.slice(0, 40).forEach((comm, idx) => {
    if (comm.type === 'summary') {
      const it = document.createElement('div');
      it.className = 'comm-item comm-summary' + (idx === 0 ? ' newest' : '');
      it.innerHTML = `<span class="comm-summary-icon">📊</span><div class="comm-summary-text">${comm.desc}</div>`;
      c.appendChild(it);
      return;
    }
    const tc = comm.type === 'w' ? 'w' : (comm.type === 'four' ? 'four' : (comm.type === 'six' ? 'six' : ''));
    const it = document.createElement('div');
    it.className = 'comm-item' + (idx === 0 ? ' newest' : '');
    it.innerHTML = `<div class="comm-ball ${tc}">${comm.ball}</div><div class="comm-body"><div class="comm-over">Over ${comm.ball}</div><div class="comm-text">${comm.desc}</div></div>`;
    c.appendChild(it);
  });
}

/* ═══════════════════════════════════════════════════════════
   RENDER SUMMARY (partnership + FOW)
   ═══════════════════════════════════════════════════════════ */
function renderSummary() {
  const cp = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  const st = match.batters[match.striker] || { runs: 0, balls: 0 };
  const nst = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  const pr = document.getElementById('partRuns');
  const pd = document.getElementById('partDetails');
  const fw = document.getElementById('fowContainer');
  if (pr) pr.innerText = `${cp.runs || 0} runs (${cp.balls || 0} balls)`;
  if (pd) pd.innerHTML = `${_playerLink(match.striker)}: ${st.runs} (${st.balls}) | ${_playerLink(match.nonStriker)}: ${nst.runs} (${nst.balls})`;
  if (fw) {
    fw.innerHTML = (match.fow && match.fow.length > 0)
      ? match.fow.map(f => {
          /* fow entries look like "45/2 (Rohit)" — make the name clickable */
          const m = String(f).match(/^(.*?)\((.+?)\)\s*$/);
          if (m) return `${escapeHtml(m[1])}(${_playerLink(m[2])})`;
          return escapeHtml(f);
        }).join('<br>')
      : 'No wickets yet.';
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER SCORECARD — batting + bowling table with clickable names
   ═══════════════════════════════════════════════════════════ */
function renderScorecard() {
  try {
    const bt = document.getElementById('battingTeamTitle');
    if (bt) bt.innerText = 'Batting — ' + (match.teamBatting || '');
    const bwt = document.getElementById('bowlingTeamTitle');
    if (bwt) bwt.innerText = 'Bowling — ' + (match.teamBowling || '');

    /* Batting table */
    const bb = document.getElementById('battingTableBody');
    if (bb) {
      bb.innerHTML = '';
      for (const n in match.batters) {
        const b = match.batters[n];
        if (b.status && b.status !== 'dnb') {
          const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
          bb.innerHTML += `<tr>
            <td><b>${_playerLink(n)}${n === match.striker ? ' *' : ''}</b><br><small style="color:var(--muted);">${escapeHtml(b.status)}</small></td>
            <td class="text-right"><b>${b.runs}</b></td>
            <td class="text-right">${b.balls}</td>
            <td class="text-right">${b.fours}</td>
            <td class="text-right">${b.sixes}</td>
            <td class="text-right">${sr}</td>
          </tr>`;
        }
      }
    }

    /* Bowling table */
    const bl = document.getElementById('bowlingTableBody');
    if (bl) {
      bl.innerHTML = '';
      for (const n in match.bowlers) {
        const b = match.bowlers[n];
        if (b.balls > 0 || n === match.currentBowler) {
          const ov = Math.floor(b.balls / 6) + '.' + (b.balls % 6);
          const eco = b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.0';
          bl.innerHTML += `<tr>
            <td><b>${_playerLink(n)}${n === match.currentBowler ? ' *' : ''}</b></td>
            <td class="text-right">${ov}</td>
            <td class="text-right">${b.maidens}</td>
            <td class="text-right">${b.runs}</td>
            <td class="text-right"><b>${b.wickets}</b></td>
            <td class="text-right">${eco}</td>
          </tr>`;
        }
      }
    }
  } catch (e) { console.warn('renderScorecard error:', e); }
}

/* ─── Strikers swap (does NOT auto-render; caller decides) ── */
function swapStrikers() {
  const t = match.striker;
  match.striker = match.nonStriker;
  match.nonStriker = t;
}

/* ─── Theme ─────────────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const l = document.body.classList.contains('light-mode');
  try { localStorage.setItem('CricMax_Theme', l ? 'light' : 'dark'); } catch (e) {}
}

/* ─── TV mode ───────────────────────────────────────────── */
function toggleTVMode() {
  const tv = document.getElementById('tvMode');
  if (!tv) return;
  tv.classList.toggle('active');
  if (tv.classList.contains('active')) renderTVMode();
}

function renderTVMode() {
  if (!match.isActive) return;
  const tTeam = document.getElementById('tvTeams');
  const tScore = document.getElementById('tvScore');
  const tMeta = document.getElementById('tvMeta');
  const tBat = document.getElementById('tvBatters');
  const r = document.getElementById('tvRecent');

  if (tTeam) tTeam.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (tScore) tScore.innerText = `${match.runs}/${match.wickets}`;
  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  const crr = match.legalBalls > 0 ? (match.runs / (match.legalBalls / 6)).toFixed(2) : '0.00';
  if (tMeta) tMeta.innerHTML = `Overs: <b style="color:#22d3ee;">${ov}</b> / ${match.totalOvers} • CRR: <b style="color:#22d3ee;">${crr}</b>`;

  const s = match.batters[match.striker] || { runs: 0, balls: 0 };
  const ns = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  if (tBat) tBat.innerHTML = `<span>🏏 <b style="color:#00e676;">${escapeHtml(match.striker)}*</b> ${s.runs}(${s.balls})</span><span>${escapeHtml(match.nonStriker)} ${ns.runs}(${ns.balls})</span>`;

  if (r) {
    r.innerHTML = '';
    match.recentBalls.slice(-8).forEach(b => {
      const d = document.createElement('div');
      d.className = 'ball-pill ' + (b === '4' ? 'c-4' : b === '6' ? 'c-6' : b === 'W' ? 'c-w' : '');
      d.style.cssText = 'width:60px;height:60px;font-size:22px;';
      d.textContent = b;
      r.appendChild(d);
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   WAGON WHEEL (host-side canvas)
   ═══════════════════════════════════════════════════════════ */
function triggerFlashOverlay(titleText, subText) {
  const overlay = document.getElementById('wagonFlashOverlay');
  if (!overlay) return;
  const t = document.getElementById('flashOverlayTitle');
  const s = document.getElementById('flashOverlaySub');
  if (t) t.innerText = titleText;
  if (s) s.innerText = subText;
  overlay.className = 'wagon-flash-overlay active';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { overlay.className = 'wagon-flash-overlay'; }, 2000);
}

function promptWagonWheel(runs) {
  if (!match.isActive || isViewerMode) return;
  pendingRuns = runs;
  document.getElementById('wagonTitle').innerText = `MARK SHOT (${runs} RUNS)`;
  document.getElementById('wagonFeedback').innerText = "Tap field to place shot";
  const banner = document.getElementById('wagonBoundaryBanner');
  if (banner) { banner.className = 'wagon-boundary-banner'; banner.style.display = 'none'; }
  const overlay = document.getElementById('wagonFlashOverlay');
  if (overlay) overlay.className = 'wagon-flash-overlay';
  document.getElementById('wagonModal').style.display = 'flex';
  drawFieldBase();
}

function drawFieldBase() {
  const cv = document.getElementById('wagonCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const cx = cv.width / 2, cy = cv.height / 2;
  const rope = (cv.width / 2) * 0.8;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rope * 0.45, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rope * 0.75, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,230,118,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rope, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#d2b48c';
  ctx.fillRect(cx - 4, cy - 12, 8, 24);
}

function drawScoringWagonShot(cx, cy, lx, ly, ballX, ballY) {
  drawFieldBase();
  const cv = document.getElementById('wagonCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.restore();
  if (typeof ballX === 'number' && typeof ballY === 'number') {
    ctx.save();
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function triggerBanner(t, s, c) {
  const b = document.getElementById('topCinematicBanner');
  if (!b) return;
  const bt = document.getElementById('topBannerTitle');
  const bs = document.getElementById('topBannerSub');
  if (bt) bt.innerText = t;
  if (bs) bs.innerText = s;
  b.className = 'top-cinematic-banner';
  void b.offsetWidth;
  b.classList.add(c, 'active');
  clearTimeout(window._bannerTimer);
  window._bannerTimer = setTimeout(() => { b.className = 'top-cinematic-banner'; }, 2400);
}

/* Attach wagon wheel listener after DOM ready */
function attachWagonWheelListener() {
  const cvWheel = document.getElementById('wagonCanvas');
  if (!cvWheel) return;
  cvWheel.addEventListener('pointerdown', (e) => {
    if (!match.isActive || isViewerMode) return;
    const rect = cvWheel.getBoundingClientRect();
    const scaleX = cvWheel.width / rect.width, scaleY = cvWheel.height / rect.height;
    const cx = cvWheel.width / 2, cy = cvWheel.height / 2;
    const clickX = (e.clientX - rect.left) * scaleX, clickY = (e.clientY - rect.top) * scaleY;
    const dx = clickX - cx, dy = clickY - cy;
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    if (rawDist < 5) return;
    const dirX = dx / rawDist, dirY = dy / rawDist;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (deg < 0) deg += 360;
    window._tempExactAngle = Math.atan2(dx, -dy);
    const sectorIdx = Math.floor(((deg + 22.5) % 360) / 45);
    const sectorNames = ["Third Man","Point","Cover","Mid-off","Mid-on","Mid-wicket","Square Leg","Fine Leg"];
    const region = sectorNames[sectorIdx];
    const ropeR = (cvWheel.width / 2) * 0.8;
    let lx = clickX, ly = clickY, dm = 0;
    if (pendingRuns >= 1 && pendingRuns <= 3) {
      const maxR = ropeR - 6;
      let tr = rawDist;
      if (pendingRuns === 1) tr = Math.min(maxR * 0.65, Math.max(ropeR * 0.35, rawDist));
      else if (pendingRuns === 2) tr = Math.min(maxR * 0.85, Math.max(ropeR * 0.5, rawDist));
      else tr = Math.min(maxR, Math.max(ropeR * 0.7, rawDist));
      lx = cx + dirX * tr; ly = cy + dirY * tr;
    } else if (pendingRuns === 4) {
      lx = cx + dirX * ropeR; ly = cy + dirY * ropeR;
    } else if (pendingRuns === 6) {
      const minR = ropeR * 1.08, maxR = ropeR * 1.22;
      const fr = Math.max(minR, Math.min(maxR, rawDist));
      lx = cx + dirX * fr; ly = cy + dirY * fr;
      dm = Math.round(75 + ((fr - ropeR) / (ropeR * 0.22)) * 45);
    }
    const flightStart = performance.now();
    const flightDuration = 500;
    const animateFlyingBall = () => {
      const elapsed = performance.now() - flightStart;
      const progress = Math.min(1, elapsed / flightDuration);
      const eased = 1 - Math.pow(1 - progress, 2);
      const bx = cx + (lx - cx) * eased;
      const by = cy + (ly - cy) * eased;
      drawScoringWagonShot(cx, cy, lx, ly, bx, by);
      if (progress < 1) requestAnimationFrame(animateFlyingBall);
      else drawScoringWagonShot(cx, cy, lx, ly, lx, ly);
    };
    animateFlyingBall();
    document.getElementById('wagonFeedback').innerText = `${region}${dm > 0 ? ' • ' + dm + 'm' : ''}`;
    match.sectorRuns[sectorIdx] += pendingRuns;
    if (pendingRuns === 4) {
      triggerFlashOverlay("CRACKING FOUR", "Boundary Scored ⚡");
      triggerBanner('CRACKING FOUR! ⚡', `Through ${region}`, 'fx-four');
    } else if (pendingRuns === 6) {
      triggerFlashOverlay("MASSIVE SIX", `Maximum ${dm}m 🔥`);
      triggerBanner('MASSIVE SIX! 🔥', `${dm}m over ${region}`, 'fx-six');
    }
    clearTimeout(window._wagonTimer);
    const _runsToRecord = pendingRuns;
    const delay = (pendingRuns === 4 || pendingRuns === 6) ? 2100 : 900;
    window._wagonTimer = setTimeout(() => {
      const _wm = document.getElementById('wagonModal');
      if (_wm) _wm.style.display = 'none';
      recordBall(_runsToRecord, null, false, region, dm);
    }, delay);
  });
                                   }
  /* Score */
  const st = document.getElementById('liveScoreText');
  if (st) {
    st.innerHTML = `<span class="team-name">${escapeHtml(match.teamBatting)}</span><span class="score-num">${match.runs}/${match.wickets}</span> <span style="font-size:15px;color:var(--muted);">(${ov})</span>`;
  }
  const crrVal = document.getElementById('crrVal');
  if (crrVal) crrVal.innerText = crr;

  const ub = document.getElementById('undoBtn');
  if (ub) ub.disabled = historyStack.length === 0 || isViewerMode;

  if (match.innings === 2) {
    const bl = (match.totalOvers * 6) - match.legalBalls;
    const rn = Math.max(0, match.target - match.runs);
    const rrrVal = document.getElementById('rrrVal');
    if (rrrVal) rrrVal.innerText = bl > 0 ? (rn / (bl / 6)).toFixed(2) : '0.00';
  }

  const s = match.batters[match.striker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const ns = match.batters[match.nonStriker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };

  /* ── Striker card — CLICKABLE NAME ── */
  const sn = document.getElementById('strikerName');
  if (sn) sn.innerHTML = `${_playerLink(match.striker)}*`;
  if (document.getElementById('strikerRuns')) document.getElementById('strikerRuns').innerText = `${s.runs} (${s.balls})`;
  if (document.getElementById('strikerSR')) document.getElementById('strikerSR').innerText = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : "0.0";
  if (document.getElementById('striker4s')) document.getElementById('striker4s').innerText = s.fours;
  if (document.getElementById('striker6s')) document.getElementById('striker6s').innerText = s.sixes;

  /* ── Non-striker card — CLICKABLE NAME ── */
  const nsn = document.getElementById('nonStrikerName');
  if (nsn) nsn.innerHTML = _playerLink(match.nonStriker);
  if (document.getElementById('nonStrikerRuns')) document.getElementById('nonStrikerRuns').innerText = `${ns.runs} (${ns.balls})`;
  if (document.getElementById('nonStrikerSR')) document.getElementById('nonStrikerSR').innerText = ns.balls > 0 ? ((ns.runs / ns.balls) * 100).toFixed(1) : "0.0";
  if (document.getElementById('nonStriker4s')) document.getElementById('nonStriker4s').innerText = ns.fours;
  if (document.getElementById('nonStriker6s')) document.getElementById('nonStriker6s').innerText = ns.sixes;

  /* ── Bowler card — CLICKABLE NAME ── */
  const bw = match.bowlers[match.currentBowler] || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
  const bn = document.getElementById('bowlerName');
  if (bn) bn.innerHTML = _playerLink(match.currentBowler);
  if (document.getElementById('bowlerFigures')) document.getElementById('bowlerFigures').innerText = `${Math.floor(bw.balls / 6)}.${bw.balls % 6}-${bw.maidens}-${bw.runs}-${bw.wickets}`;
  if (document.getElementById('bowlerEco')) document.getElementById('bowlerEco').innerText = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(2) : "0.00";

  /* ── This-over summary ── */
  const oc = document.getElementById('overCommentaryStrip');
  if (oc) {
    oc.innerHTML = '';
    if (match.currentOverBalls.length > 0 || match._lastOverRuns !== undefined) {
      const b = document.createElement('div');
      b.className = 'over-block';
      const overRuns = match._currentOverRuns || 0;
      const lastOver = match.oversTimeline && match.oversTimeline.length
        ? match.oversTimeline[match.oversTimeline.length - 1] : null;
      const pills = match.currentOverBalls.map(x =>
        `<span class="ball-pill ${x==='4'?'c-4':x==='6'?'c-6':x==='W'?'c-w':''}" style="width:22px;height:22px;font-size:9px;">${x}</span>`
      ).join('');
      b.innerHTML = `
        <div class="over-block-num">This Over • ${overRuns} run${overRuns!==1?'s':''}</div>
        <div class="over-block-balls">${pills || '<span style="color:var(--muted);font-size:10px;font-style:italic;">new over</span>'}</div>
        ${lastOver ? `<div style="font-size:10px;color:var(--muted);margin-top:4px;">Prev: ${lastOver.balls.join(' ')}</div>` : ''}
      `;
      oc.appendChild(b);
    }
  }

  renderScorecard();
  renderSummary();
  const tv = document.getElementById('tvMode');
  if (tv && tv.classList.contains('active')) renderTVMode();

  /* Ensure Retire + Bowler buttons stay wired */
  if (typeof injectRetireButton === 'function') injectRetireButton();
}

/* ═══════════════════════════════════════════════════════════
   RENDER COMMENTARY
   ═══════════════════════════════════════════════════════════ */
function renderCommentary() {
  const c = document.getElementById('commentaryContainer');
  if (!c) return;
  if (!match.commentary || match.commentary.length === 0) {
    c.innerHTML = `<div class="empty-comm">No deliveries yet.</div>`;
    return;
  }
  c.innerHTML = '';
  match.commentary.slice(0, 40).forEach((comm, idx) => {
    if (comm.type === 'summary') {
      const it = document.createElement('div');
      it.className = 'comm-item comm-summary' + (idx === 0 ? ' newest' : '');
      it.innerHTML = `<span class="comm-summary-icon">📊</span><div class="comm-summary-text">${comm.desc}</div>`;
      c.appendChild(it);
      return;
    }
    const tc = comm.type === 'w' ? 'w' : (comm.type === 'four' ? 'four' : (comm.type === 'six' ? 'six' : ''));
    const it = document.createElement('div');
    it.className = 'comm-item' + (idx === 0 ? ' newest' : '');
    it.innerHTML = `<div class="comm-ball ${tc}">${comm.ball}</div><div class="comm-body"><div class="comm-over">Over ${comm.ball}</div><div class="comm-text">${comm.desc}</div></div>`;
    c.appendChild(it);
  });
}

/* ═══════════════════════════════════════════════════════════
   RENDER SUMMARY (partnership + FOW)
   ═══════════════════════════════════════════════════════════ */
function renderSummary() {
  const cp = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  const st = match.batters[match.striker] || { runs: 0, balls: 0 };
  const nst = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  const pr = document.getElementById('partRuns');
  const pd = document.getElementById('partDetails');
  const fw = document.getElementById('fowContainer');
  if (pr) pr.innerText = `${cp.runs || 0} runs (${cp.balls || 0} balls)`;
  if (pd) pd.innerHTML = `${_playerLink(match.striker)}: ${st.runs} (${st.balls}) | ${_playerLink(match.nonStriker)}: ${nst.runs} (${nst.balls})`;
  if (fw) {
    fw.innerHTML = (match.fow && match.fow.length > 0)
      ? match.fow.map(f => {
          /* fow entries look like "45/2 (Rohit)" — make the name clickable */
          const m = String(f).match(/^(.*?)\((.+?)\)\s*$/);
          if (m) return `${escapeHtml(m[1])}(${_playerLink(m[2])})`;
          return escapeHtml(f);
        }).join('<br>')
      : 'No wickets yet.';
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER SCORECARD — batting + bowling table with clickable names
   ═══════════════════════════════════════════════════════════ */
function renderScorecard() {
  try {
    const bt = document.getElementById('battingTeamTitle');
    if (bt) bt.innerText = 'Batting — ' + (match.teamBatting || '');
    const bwt = document.getElementById('bowlingTeamTitle');
    if (bwt) bwt.innerText = 'Bowling — ' + (match.teamBowling || '');

    /* Batting table */
    const bb = document.getElementById('battingTableBody');
    if (bb) {
      bb.innerHTML = '';
      for (const n in match.batters) {
        const b = match.batters[n];
        if (b.status && b.status !== 'dnb') {
          const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
          bb.innerHTML += `<tr>
            <td><b>${_playerLink(n)}${n === match.striker ? ' *' : ''}</b><br><small style="color:var(--muted);">${escapeHtml(b.status)}</small></td>
            <td class="text-right"><b>${b.runs}</b></td>
            <td class="text-right">${b.balls}</td>
            <td class="text-right">${b.fours}</td>
            <td class="text-right">${b.sixes}</td>
            <td class="text-right">${sr}</td>
          </tr>`;
        }
      }
    }

    /* Bowling table */
    const bl = document.getElementById('bowlingTableBody');
    if (bl) {
      bl.innerHTML = '';
      for (const n in match.bowlers) {
        const b = match.bowlers[n];
        if (b.balls > 0 || n === match.currentBowler) {
          const ov = Math.floor(b.balls / 6) + '.' + (b.balls % 6);
          const eco = b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.0';
          bl.innerHTML += `<tr>
            <td><b>${_playerLink(n)}${n === match.currentBowler ? ' *' : ''}</b></td>
            <td class="text-right">${ov}</td>
            <td class="text-right">${b.maidens}</td>
            <td class="text-right">${b.runs}</td>
            <td class="text-right"><b>${b.wickets}</b></td>
            <td class="text-right">${eco}</td>
          </tr>`;
        }
      }
    }
  } catch (e) { console.warn('renderScorecard error:', e); }
}

/* ─── Strikers swap (does NOT auto-render; caller decides) ── */
function swapStrikers() {
  const t = match.striker;
  match.striker = match.nonStriker;
  match.nonStriker = t;
}

/* ─── Theme ─────────────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const l = document.body.classList.contains('light-mode');
  try { localStorage.setItem('CricMax_Theme', l ? 'light' : 'dark'); } catch (e) {}
}

/* ─── TV mode ───────────────────────────────────────────── */
function toggleTVMode() {
  const tv = document.getElementById('tvMode');
  if (!tv) return;
  tv.classList.toggle('active');
  if (tv.classList.contains('active')) renderTVMode();
}

function renderTVMode() {
  if (!match.isActive) return;
  const tTeam = document.getElementById('tvTeams');
  const tScore = document.getElementById('tvScore');
  const tMeta = document.getElementById('tvMeta');
  const tBat = document.getElementById('tvBatters');
  const r = document.getElementById('tvRecent');

  if (tTeam) tTeam.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (tScore) tScore.innerText = `${match.runs}/${match.wickets}`;
  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  const crr = match.legalBalls > 0 ? (match.runs / (match.legalBalls / 6)).toFixed(2) : '0.00';
  if (tMeta) tMeta.innerHTML = `Overs: <b style="color:#22d3ee;">${ov}</b> / ${match.totalOvers} • CRR: <b style="color:#22d3ee;">${crr}</b>`;

  const s = match.batters[match.striker] || { runs: 0, balls: 0 };
  const ns = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  if (tBat) tBat.innerHTML = `<span>🏏 <b style="color:#00e676;">${escapeHtml(match.striker)}*</b> ${s.runs}(${s.balls})</span><span>${escapeHtml(match.nonStriker)} ${ns.runs}(${ns.balls})</span>`;

  if (r) {
    r.innerHTML = '';
    match.recentBalls.slice(-8).forEach(b => {
      const d = document.createElement('div');
      d.className = 'ball-pill ' + (b === '4' ? 'c-4' : b === '6' ? 'c-6' : b === 'W' ? 'c-w' : '');
      d.style.cssText = 'width:60px;height:60px;font-size:22px;';
      d.textContent = b;
      r.appendChild(d);
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   WAGON WHEEL (host-side canvas)
   ═══════════════════════════════════════════════════════════ */
function triggerFlashOverlay(titleText, subText) {
  const overlay = document.getElementById('wagonFlashOverlay');
  if (!overlay) return;
  const t = document.getElementById('flashOverlayTitle');
  const s = document.getElementById('flashOverlaySub');
  if (t) t.innerText = titleText;
  if (s) s.innerText = subText;
  overlay.className = 'wagon-flash-overlay active';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { overlay.className = 'wagon-flash-overlay'; }, 2000);
}

function promptWagonWheel(runs) {
  if (!match.isActive || isViewerMode) return;
  pendingRuns = runs;
  document.getElementById('wagonTitle').innerText = `MARK SHOT (${runs} RUNS)`;
  document.getElementById('wagonFeedback').innerText = "Tap field to place shot";
  const banner =
