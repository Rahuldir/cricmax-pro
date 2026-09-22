/* ============================================================
   render.js — Live pane, commentary, scorecard, TV mode,
               theme/sky toggles, wagon wheel, clickable names
   ✅ Self-healing: normalizeMatch() runs at every render entry
   ✅ Safe array access for remote state
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   PLAYER LINK HELPER — clickable names everywhere
   ═══════════════════════════════════════════════════════════ */
function _playerLink(name) {
  if (!name) return '';
  var safe = escapeHtml(name).replace(/'/g, "\\'");
  return '<span class="player-link" onclick="openPlayerCareerModal(\'' + safe + '\')" ' +
         'style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">' +
         escapeHtml(name) + '</span>';
}

/* ═══════════════════════════════════════════════════════════
   LIVE SHARE BADGE
   ═══════════════════════════════════════════════════════════ */
function updateLiveShareBadge() {
  var badge = document.getElementById('liveShareBadge');
  var codeEl = document.getElementById('liveShareCodeText');
  if (!badge || !codeEl) return;
  if (typeof matchCode === 'string' && matchCode && match && match.isActive && !isViewerMode) {
    badge.style.display = 'inline-flex';
    codeEl.innerText = matchCode;
  } else {
    badge.style.display = 'none';
  }
}

function showLiveViewerPulse() {
  var el = document.getElementById('liveViewerPulse');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(window._viewerPulseTimer);
  window._viewerPulseTimer = setTimeout(function () { el.style.opacity = '.35'; }, 400);
}

/* ═══════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════ */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  var isLight = document.body.classList.contains('light-mode');
  try { localStorage.setItem('CricMax_Theme', isLight ? 'light' : 'dark'); } catch (e) {}
  var btn = document.getElementById('btn-theme') || document.getElementById('btnTheme');
  if (btn) btn.innerText = isLight ? '☀️' : '🌙';
}

/* ═══════════════════════════════════════════════════════════
   SKY TOGGLE
   ═══════════════════════════════════════════════════════════ */
var _currentSky = 'day';

function setSky(mode) {
  if (!mode) return;
  _currentSky = mode;

  ['day', 'sunset', 'night'].forEach(function (m) {
    var b = document.getElementById('env-' + m);
    if (b) b.classList.toggle('on', m === mode);
  });

  try {
    var frame = document.getElementById('stadiumIframe')
             || document.getElementById('vppIframe')
             || document.querySelector('iframe');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'SET_SKY', mode: mode }, '*');
      frame.contentWindow.postMessage({ type: 'CM_SET_SKY', mode: mode }, '*');
    }
  } catch (e) {}

  try {
    if (typeof stadium !== 'undefined' && stadium && typeof stadium.setSky === 'function') {
      stadium.setSky(mode);
    }
  } catch (e) {}

  try {
    if (window.CricMaxEnvironment && typeof window.CricMaxEnvironment.setSky === 'function') {
      window.CricMaxEnvironment.setSky(mode);
    }
  } catch (e) {}

  try { localStorage.setItem('CricMax_Sky', mode); } catch (e) {}
}

function cycleSky() {
  var order = ['day', 'sunset', 'night'];
  var idx = order.indexOf(_currentSky);
  var next = order[(idx + 1) % order.length];
  setSky(next);
  showToast('🌤 ' + next.charAt(0).toUpperCase() + next.slice(1));
}

try {
  var savedSky = localStorage.getItem('CricMax_Sky');
  if (savedSky) setTimeout(function () { setSky(savedSky); }, 300);
} catch (e) {}

/* ═══════════════════════════════════════════════════════════
   TV MODE
   ═══════════════════════════════════════════════════════════ */
var tvModeActive = false;

function toggleTVMode() {
  var tv = document.getElementById('tvMode');
  var btn = document.getElementById('btn-tv') || document.getElementById('btnTV');

  if (!tv) {
    console.warn('[CricMax] #tvMode not found');
    return;
  }

  tvModeActive = !tvModeActive;

  tv.classList.toggle('active', tvModeActive);
  tv.classList.toggle('show', tvModeActive);
  tv.style.display = tvModeActive ? 'flex' : 'none';

  if (btn) btn.classList.toggle('on', tvModeActive);

  if (tvModeActive) {
    try { renderTVMode(); } catch (e) { console.warn('renderTVMode:', e); }
  }
}

function renderTVMode() {
  if (!tvModeActive) return;
  var m = (window.__cricmaxLastMatch) || (typeof match !== 'undefined' ? match : null);
  if (!m) return;
  if (typeof normalizeMatch === 'function') normalizeMatch(m);

  var runs = m.runs || 0;
  var wkts = m.wickets || 0;
  var balls = m.legalBalls || 0;
  var overs = Math.floor(balls / 6) + '.' + (balls % 6);
  var crr = balls > 0 ? ((runs / balls) * 6).toFixed(2) : '0.00';

  var setT = function (id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  setT('tvTeams', (m.teamBatting || 'Team') + ' vs ' + (m.teamBowling || 'Opponent'));
  setT('tvScore', runs + '/' + wkts);
  setT('tvMeta', 'Overs: ' + overs + ' • CRR: ' + crr);

  var bW = document.getElementById('tvBatters');
  if (bW) {
    var st = m.striker || 'Striker';
    var nst = m.nonStriker || 'Non-Striker';
    var sB = (m.batters && m.batters[st]) || { runs: 0, balls: 0 };
    var nB = (m.batters && m.batters[nst]) || { runs: 0, balls: 0 };
    bW.innerHTML =
      '<div class="tv-bat striker"><div class="tv-bat-name">' + escapeHtml(st) + ' *</div><div class="tv-bat-runs">' + sB.runs + ' (' + sB.balls + ')</div></div>' +
      '<div class="tv-bat"><div class="tv-bat-name">' + escapeHtml(nst) + '</div><div class="tv-bat-runs">' + nB.runs + ' (' + nB.balls + ')</div></div>';
  }

  var rW = document.getElementById('tvRecent');
  if (rW) {
    var tags = Array.isArray(m.currentOverBalls)
      ? m.currentOverBalls
      : (Array.isArray(m.recentBalls) ? m.recentBalls.slice(-6) : []);
    rW.innerHTML = tags.map(function (t) {
      var s = String(t);
      var c = 'tv-ball';
      if (s === '4') c += ' four';
      else if (s === '6') c += ' six';
      else if (s.indexOf('W') >= 0) c += ' wkt';
      return '<div class="' + c + '">' + s + '</div>';
    }).join('');
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER LIVE — main pane
   ═══════════════════════════════════════════════════════════ */
function renderLive() {
  if (!match.teamBatting) return;

  /* ⚡ Self-heal missing fields BEFORE reading */
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  var ov = Math.floor(match.legalBalls / 6) + '.' + (match.legalBalls % 6);
  var crr = match.legalBalls > 0 ? (match.runs / (match.legalBalls / 6)).toFixed(2) : '0.00';

  /* Score header */
  var st = document.getElementById('liveScoreText');
  if (st) {
    st.innerHTML = '<span class="team-name">' + escapeHtml(match.teamBatting) + '</span>' +
                   '<span class="score-num">' + match.runs + '/' + match.wickets + '</span> ' +
                   '<span style="font-size:15px;color:var(--muted);">(' + ov + ')</span>';
  }
  var crrVal = document.getElementById('crrVal');
  if (crrVal) crrVal.innerText = crr;

  var ub = document.getElementById('undoBtn');
  if (ub) ub.disabled = historyStack.length === 0 || isViewerMode;

  if (match.innings === 2) {
    var bl = (match.totalOvers * 6) - match.legalBalls;
    var rn = Math.max(0, match.target - match.runs);
    var rrrVal = document.getElementById('rrrVal');
    if (rrrVal) rrrVal.innerText = bl > 0 ? (rn / (bl / 6)).toFixed(2) : '0.00';
  }

  var s = match.batters[match.striker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  var ns = match.batters[match.nonStriker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };

  /* Striker card */
  var sn = document.getElementById('strikerName');
  if (sn) sn.innerHTML = _playerLink(match.striker) + '*';
  if (document.getElementById('strikerRuns')) document.getElementById('strikerRuns').innerText = s.runs + ' (' + s.balls + ')';
  if (document.getElementById('strikerSR')) document.getElementById('strikerSR').innerText = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0';
  if (document.getElementById('striker4s')) document.getElementById('striker4s').innerText = s.fours;
  if (document.getElementById('striker6s')) document.getElementById('striker6s').innerText = s.sixes;

  /* Non-striker card */
  var nsn = document.getElementById('nonStrikerName');
  if (nsn) nsn.innerHTML = _playerLink(match.nonStriker);
  if (document.getElementById('nonStrikerRuns')) document.getElementById('nonStrikerRuns').innerText = ns.runs + ' (' + ns.balls + ')';
  if (document.getElementById('nonStrikerSR')) document.getElementById('nonStrikerSR').innerText = ns.balls > 0 ? ((ns.runs / ns.balls) * 100).toFixed(1) : '0.0';
  if (document.getElementById('nonStriker4s')) document.getElementById('nonStriker4s').innerText = ns.fours;
  if (document.getElementById('nonStriker6s')) document.getElementById('nonStriker6s').innerText = ns.sixes;

  /* Bowler card */
  var bw = match.bowlers[match.currentBowler] || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
  var bn = document.getElementById('bowlerName');
  if (bn) bn.innerHTML = _playerLink(match.currentBowler);
  if (document.getElementById('bowlerFigures')) document.getElementById('bowlerFigures').innerText = Math.floor(bw.balls / 6) + '.' + (bw.balls % 6) + '-' + bw.maidens + '-' + bw.runs + '-' + bw.wickets;
  if (document.getElementById('bowlerEco')) document.getElementById('bowlerEco').innerText = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(2) : '0.00';

  /* This Over summary */
  var oc = document.getElementById('overCommentaryStrip');
  if (oc) {
    oc.innerHTML = '';
    var _overBallsSafe = Array.isArray(match.currentOverBalls) ? match.currentOverBalls : [];
    if (_overBallsSafe.length > 0 || match._lastOverRuns !== undefined) {
      var b = document.createElement('div');
      b.className = 'over-block';
      var overRuns = match._currentOverRuns || 0;
      var lastOver = match.oversTimeline && match.oversTimeline.length
        ? match.oversTimeline[match.oversTimeline.length - 1] : null;
      var pills = _overBallsSafe.map(function (x) {
        var cls = x === '4' ? 'c-4' : x === '6' ? 'c-6' : x === 'W' ? 'c-w' : '';
        return '<span class="ball-pill ' + cls + '" style="width:22px;height:22px;font-size:9px;">' + x + '</span>';
      }).join('');
      b.innerHTML =
        '<div class="over-block-num">This Over • ' + overRuns + ' run' + (overRuns !== 1 ? 's' : '') + '</div>' +
        '<div class="over-block-balls">' + (pills || '<span style="color:var(--muted);font-size:10px;font-style:italic;">new over</span>') + '</div>' +
        (lastOver ? '<div style="font-size:10px;color:var(--muted);margin-top:4px;">Prev: ' + lastOver.balls.join(' ') + '</div>' : '');
      oc.appendChild(b);
    }
  }

  renderScorecard();
  renderSummary();

  if (tvModeActive) {
    try { renderTVMode(); } catch (e) {}
  }

  if (typeof injectRetireButton === 'function') {
    try { injectRetireButton(); } catch (e) {}
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER COMMENTARY
   ═══════════════════════════════════════════════════════════ */
function renderCommentary() {
  var c = document.getElementById('commentaryContainer');
  if (!c) return;

  /* ⚡ Self-heal */
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  var arr = Array.isArray(match.commentary) ? match.commentary : [];
  if (arr.length === 0) {
    c.innerHTML = '<div class="empty-comm">No deliveries yet.</div>';
    return;
  }

  c.innerHTML = '';
  arr.slice(0, 40).forEach(function (comm, idx) {
    if (!comm) return;
    if (comm.type === 'summary') {
      var it = document.createElement('div');
      it.className = 'comm-item comm-summary' + (idx === 0 ? ' newest' : '');
      it.innerHTML = '<span class="comm-summary-icon">📊</span><div class="comm-summary-text">' + comm.desc + '</div>';
      c.appendChild(it);
      return;
    }
    var tc = comm.type === 'w' ? 'w' : (comm.type === 'four' ? 'four' : (comm.type === 'six' ? 'six' : ''));
    var it2 = document.createElement('div');
    it2.className = 'comm-item' + (idx === 0 ? ' newest' : '');
    it2.innerHTML = '<div class="comm-ball ' + tc + '">' + comm.ball + '</div>' +
                    '<div class="comm-body"><div class="comm-over">Over ' + comm.ball + '</div>' +
                    '<div class="comm-text">' + comm.desc + '</div></div>';
    c.appendChild(it2);
  });
}

/* ═══════════════════════════════════════════════════════════
   RENDER SUMMARY (partnership + FOW)
   ═══════════════════════════════════════════════════════════ */
function renderSummary() {
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  var cp = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  var st = match.batters[match.striker] || { runs: 0, balls: 0 };
  var nst = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  var pr = document.getElementById('partRuns');
  var pd = document.getElementById('partDetails');
  var fw = document.getElementById('fowContainer');

  if (pr) pr.innerText = (cp.runs || 0) + ' runs (' + (cp.balls || 0) + ' balls)';
  if (pd) pd.innerHTML = _playerLink(match.striker) + ': ' + st.runs + ' (' + st.balls + ') | ' +
                         _playerLink(match.nonStriker) + ': ' + nst.runs + ' (' + nst.balls + ')';

  if (fw) {
    var _fowSafe = Array.isArray(match.fow) ? match.fow : [];
    if (_fowSafe.length > 0) {
      fw.innerHTML = _fowSafe.map(function (f) {
        var m = String(f).match(/^(.*?)\((.+?)\)\s*$/);
        if (m) return escapeHtml(m[1]) + '(' + _playerLink(m[2]) + ')';
        return escapeHtml(f);
      }).join('<br>');
    } else {
      fw.innerHTML = 'No wickets yet.';
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER SCORECARD — batting + bowling tables
   ═══════════════════════════════════════════════════════════ */
function renderScorecard() {
  try {
    if (typeof normalizeMatch === 'function') normalizeMatch(match);

    var bt = document.getElementById('battingTeamTitle');
    if (bt) bt.innerText = 'Batting — ' + (match.teamBatting || '');
    var bwt = document.getElementById('bowlingTeamTitle');
    if (bwt) bwt.innerText = 'Bowling — ' + (match.teamBowling || '');

    var bb = document.getElementById('battingTableBody');
    if (bb) {
      bb.innerHTML = '';
      for (var n in match.batters) {
        var b = match.batters[n];
        if (b.status && b.status !== 'dnb') {
          var sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
          bb.innerHTML += '<tr>' +
            '<td><b>' + _playerLink(n) + (n === match.striker ? ' *' : '') + '</b><br><small style="color:var(--muted);">' + escapeHtml(b.status) + '</small></td>' +
            '<td class="text-right"><b>' + b.runs + '</b></td>' +
            '<td class="text-right">' + b.balls + '</td>' +
            '<td class="text-right">' + b.fours + '</td>' +
            '<td class="text-right">' + b.sixes + '</td>' +
            '<td class="text-right">' + sr + '</td>' +
            '</tr>';
        }
      }
    }

    var bl = document.getElementById('bowlingTableBody');
    if (bl) {
      bl.innerHTML = '';
      for (var n2 in match.bowlers) {
        var b2 = match.bowlers[n2];
        if (b2.balls > 0 || n2 === match.currentBowler) {
          var ov = Math.floor(b2.balls / 6) + '.' + (b2.balls % 6);
          var eco = b2.balls > 0 ? (b2.runs / (b2.balls / 6)).toFixed(2) : '0.0';
          bl.innerHTML += '<tr>' +
            '<td><b>' + _playerLink(n2) + (n2 === match.currentBowler ? ' *' : '') + '</b></td>' +
            '<td class="text-right">' + ov + '</td>' +
            '<td class="text-right">' + b2.maidens + '</td>' +
            '<td class="text-right">' + b2.runs + '</td>' +
            '<td class="text-right"><b>' + b2.wickets + '</b></td>' +
            '<td class="text-right">' + eco + '</td>' +
            '</tr>';
        }
      }
    }
  } catch (e) {
    console.warn('renderScorecard error:', e);
  }
}

/* ═══════════════════════════════════════════════════════════
   SWAP STRIKERS
   ═══════════════════════════════════════════════════════════ */
function swapStrikers() {
  var t = match.striker;
  match.striker = match.nonStriker;
  match.nonStriker = t;
}

/* ═══════════════════════════════════════════════════════════
   WAGON WHEEL (host-side canvas)
   ═══════════════════════════════════════════════════════════ */
function triggerFlashOverlay(titleText, subText) {
  var overlay = document.getElementById('wagonFlashOverlay');
  if (!overlay) return;
  var t = document.getElementById('flashOverlayTitle');
  var s = document.getElementById('flashOverlaySub');
  if (t) t.innerText = titleText;
  if (s) s.innerText = subText;
  overlay.className = 'wagon-flash-overlay active';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(function () { overlay.className = 'wagon-flash-overlay'; }, 2000);
}

function promptWagonWheel(runs) {
  if (!match.isActive || isViewerMode) return;
  pendingRuns = runs;
  document.getElementById('wagonTitle').innerText = 'MARK SHOT (' + runs + ' RUNS)';
  document.getElementById('wagonFeedback').innerText = 'Tap field to place shot';
  var banner = document.getElementById('wagonBoundaryBanner');
  if (banner) { banner.className = 'wagon-boundary-banner'; banner.style.display = 'none'; }
  var overlay = document.getElementById('wagonFlashOverlay');
  if (overlay) overlay.className = 'wagon-flash-overlay';
  document.getElementById('wagonModal').style.display = 'flex';
  drawFieldBase();
}

function drawFieldBase() {
  var cv = document.getElementById('wagonCanvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var cx = cv.width / 2, cy = cv.height / 2;
  var rope = (cv.width / 2) * 0.8;
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
  var cv = document.getElementById('wagonCanvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
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
  var b = document.getElementById('topCinematicBanner');
  if (!b) return;
  var bt = document.getElementById('topBannerTitle');
  var bs = document.getElementById('topBannerSub');
  if (bt) bt.innerText = t;
  if (bs) bs.innerText = s;
  b.className = 'top-cinematic-banner';
  void b.offsetWidth;
  b.classList.add(c, 'active');
  clearTimeout(window._bannerTimer);
  window._bannerTimer = setTimeout(function () { b.className = 'top-cinematic-banner'; }, 2400);
}

/* Attach wagon wheel listener after DOM ready */
function attachWagonWheelListener() {
  var cvWheel = document.getElementById('wagonCanvas');
  if (!cvWheel) {
    console.warn('[CricMax] #wagonCanvas not found');
    return;
  }
  if (cvWheel._cmWired) return; /* already attached */

  cvWheel.addEventListener('pointerdown', function (e) {
    if (!match.isActive || isViewerMode) return;

    var rect = cvWheel.getBoundingClientRect();
    var scaleX = cvWheel.width / rect.width, scaleY = cvWheel.height / rect.height;
    var cx = cvWheel.width / 2, cy = cvWheel.height / 2;
    var clickX = (e.clientX - rect.left) * scaleX, clickY = (e.clientY - rect.top) * scaleY;
    var dx = clickX - cx, dy = clickY - cy;
    var rawDist = Math.sqrt(dx * dx + dy * dy);
    if (rawDist < 5) return;

    var dirX = dx / rawDist, dirY = dy / rawDist;
    var deg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (deg < 0) deg += 360;

    window._tempExactAngle = Math.atan2(dx, -dy);

    var sectorIdx = Math.floor(((deg + 22.5) % 360) / 45);
    var sectorNames = ['Third Man','Point','Cover','Mid-off','Mid-on','Mid-wicket','Square Leg','Fine Leg'];
    var region = sectorNames[sectorIdx];

    var ropeR = (cvWheel.width / 2) * 0.8;
    var lx = clickX, ly = clickY, dm = 0;

    if (pendingRuns >= 1 && pendingRuns <= 3) {
      var maxR = ropeR - 6;
      var tr = rawDist;
      if (pendingRuns === 1) tr = Math.min(maxR * 0.65, Math.max(ropeR * 0.35, rawDist));
      else if (pendingRuns === 2) tr = Math.min(maxR * 0.85, Math.max(ropeR * 0.5, rawDist));
      else tr = Math.min(maxR, Math.max(ropeR * 0.7, rawDist));
      lx = cx + dirX * tr; ly = cy + dirY * tr;
    } else if (pendingRuns === 4) {
      lx = cx + dirX * ropeR; ly = cy + dirY * ropeR;
    } else if (pendingRuns === 6) {
      var minR = ropeR * 1.08, maxR6 = ropeR * 1.22;
      var fr = Math.max(minR, Math.min(maxR6, rawDist));
      lx = cx + dirX * fr; ly = cy + dirY * fr;
      dm = Math.round(75 + ((fr - ropeR) / (ropeR * 0.22)) * 45);
    }

    /* Animate ball flight */
    var flightStart = performance.now();
    var flightDuration = 500;
    var animateFlyingBall = function () {
      var elapsed = performance.now() - flightStart;
      var progress = Math.min(1, elapsed / flightDuration);
      var eased = 1 - Math.pow(1 - progress, 2);
      var bx = cx + (lx - cx) * eased;
      var by = cy + (ly - cy) * eased;
      drawScoringWagonShot(cx, cy, lx, ly, bx, by);
      if (progress < 1) requestAnimationFrame(animateFlyingBall);
      else drawScoringWagonShot(cx, cy, lx, ly, lx, ly);
    };
    animateFlyingBall();

    document.getElementById('wagonFeedback').innerText = region + (dm > 0 ? ' • ' + dm + 'm' : '');
    match.sectorRuns[sectorIdx] += pendingRuns;

    if (pendingRuns === 4) {
      triggerFlashOverlay('CRACKING FOUR', 'Boundary Scored ⚡');
      triggerBanner('CRACKING FOUR! ⚡', 'Through ' + region, 'fx-four');
    } else if (pendingRuns === 6) {
      triggerFlashOverlay('MASSIVE SIX', 'Maximum ' + dm + 'm 🔥');
      triggerBanner('MASSIVE SIX! 🔥', dm + 'm over ' + region, 'fx-six');
    }

    clearTimeout(window._wagonTimer);
    var _runsToRecord = pendingRuns;
    var delay = (pendingRuns === 4 || pendingRuns === 6) ? 2100 : 900;
    window._wagonTimer = setTimeout(function () {
      var _wm = document.getElementById('wagonModal');
      if (_wm) _wm.style.display = 'none';
      recordBall(_runsToRecord, null, false, region, dm);
    }, delay);
  });

  cvWheel._cmWired = true;
  console.log('[CricMax] 🕸️ Wagon wheel listener attached');
}
