/* ============================================================
   utils.js — Helpers, toast, UI injectors, retire button
   ✅ Self-contained. No IIFEs. No duplicate functions.
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════ */
function showToast(msg, duration) {
  if (typeof duration !== 'number') duration = 2600;
  var toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.style.cssText = 'position:fixed;bottom:105px;left:50%;transform:translateX(-50%) translateY(30px);background:linear-gradient(135deg,rgba(0,146,112,.97),rgba(0,230,118,.97));color:#fff;padding:12px 24px;border-radius:14px;font-size:12.5px;font-weight:800;z-index:9999999;box-shadow:0 10px 40px rgba(0,0,0,.65),0 0 30px rgba(0,230,118,.4);max-width:90vw;text-align:center;opacity:0;transition:all .35s cubic-bezier(.175,.885,.32,1.275);pointer-events:none;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.3);word-break:break-word;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  requestAnimationFrame(function () {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(30px)';
  }, duration);
}

/* ═══════════════════════════════════════════════════════════
   BATCHED RENDER
   ═══════════════════════════════════════════════════════════ */
function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(function () {
    _renderScheduled = false;
    try { renderLive(); } catch (e) { console.warn('renderLive:', e); }
    try { renderCommentary(); } catch (e) { console.warn('renderCommentary:', e); }
    try { renderSummary(); } catch (e) { console.warn('renderSummary:', e); }
    try { renderScorecard(); } catch (e) { console.warn('renderScorecard:', e); }
  });
}

/* ═══════════════════════════════════════════════════════════
   TEXT HELPERS
   ═══════════════════════════════════════════════════════════ */
function autoCapitalize(s) {
  if (!s) return '';
  return String(s).replace(/(^|\s|[\-'])\S/g, function (m) { return m.toUpperCase(); });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ═══════════════════════════════════════════════════════════
   TEAM / PLAYER HELPERS
   ═══════════════════════════════════════════════════════════ */
function autoAddPlayerToTeam(playerName, teamName) {
  if (!playerName || !teamName) return;
  playerName = autoCapitalize(playerName.trim());
  if (!playerName) return;
  var t = null;
  for (var i = 0; i < savedTeams.length; i++) {
    if (savedTeams[i].name === teamName) { t = savedTeams[i]; break; }
  }
  if (!t) return;
  if (!t.squad) t.squad = [];
  if (t.squad.indexOf(playerName) === -1) {
    t.squad.push(playerName);
    autoPersist();
  }
}

function detectBowlerType(name) {
  if (!name) return 'pace';
  if (bowlerTypeMap[name]) return bowlerTypeMap[name];
  var lower = name.toLowerCase();
  var spinKeywords = [
    'spin','ashwin','jadeja','chahal','kuldeep','rashid','tahir','zampa','shakib',
    'moeen','lyon','herath','sodhi','santner','swepson','parkinson','bishnoi',
    'chakaravarthy','axar','sundar','hooda','markram','maxwell','root','shah',
    'mujeeb','noor','hasaranga','theekshana','wellalage'
  ];
  for (var i = 0; i < spinKeywords.length; i++) {
    if (lower.indexOf(spinKeywords[i]) >= 0) return 'spin';
  }
  return 'pace';
}

/* ═══════════════════════════════════════════════════════════
   INJECT HELP ELEMENTS
   Adds optional UI without touching index.html
   ═══════════════════════════════════════════════════════════ */
function injectHelpElements() {
  /* ── 1. Wicket modal — Who is OUT? + extra dismissal types ── */
  var wkModal = document.getElementById('wicketTypeModal');
  var mSel = document.getElementById('wktMethodSelect');
  if (wkModal && mSel) {
    if (!document.getElementById('wktDismissedGroup')) {
      var dg = document.createElement('div');
      dg.className = 'form-group';
      dg.id = 'wktDismissedGroup';
      dg.style.display = 'none';
      dg.innerHTML = '<label class="form-label">🚪 Who is OUT?</label>' +
        '<select id="wktDismissedBatter" class="form-control">' +
        '<option value="striker">Striker</option>' +
        '<option value="nonStriker">Non-Striker</option>' +
        '</select>';
      mSel.parentElement.parentElement.insertBefore(dg, mSel.parentElement.nextSibling);
    }
    var opts = [];
    for (var i = 0; i < mSel.options.length; i++) opts.push(mSel.options[i].value);
    if (opts.indexOf('Retired Hurt') === -1) {
      mSel.insertAdjacentHTML('beforeend', '<option value="Retired Hurt">Retired Hurt</option>');
    }
    if (opts.indexOf('Obstructing Field') === -1) {
      mSel.insertAdjacentHTML('beforeend', '<option value="Obstructing Field">Obstructing the Field</option>');
    }
  }

  /* ── 2. Man-of-the-Match box ── */
  var resultModal = document.getElementById('resultModal');
  var resultScores = document.getElementById('resultScores');
  if (resultModal && resultScores && !document.getElementById('motmBox')) {
    resultScores.insertAdjacentHTML('afterend',
      '<div id="motmBox" style="margin-top:14px;padding:14px;background:linear-gradient(135deg,rgba(255,193,7,.15),rgba(255,152,0,.08));border-radius:12px;border:1px solid rgba(255,193,7,.4);display:none;">' +
      '<div style="font-size:10px;color:#ffc107;font-weight:900;text-transform:uppercase;letter-spacing:1px;">🏅 Man of the Match</div>' +
      '<div id="motmName" style="font-size:18px;font-weight:900;color:#fff;margin-top:4px;"></div>' +
      '<div id="motmStats" style="font-size:11px;color:var(--muted);margin-top:4px;"></div>' +
      '</div>');
  }

  /* ── 3. Commentary density selector ── */
  var settingsModal = document.getElementById('settingsModal');
  if (settingsModal && !document.getElementById('cfgVoiceDensity')) {
    var anchor = settingsModal.querySelector('.settings-scroll') || settingsModal;
    anchor.insertAdjacentHTML('beforeend',
      '<div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:8px;">' +
      '<span style="font-size:12px;font-weight:700;">🎙️ Commentary Density</span>' +
      '<select id="cfgVoiceDensity" class="form-control" onchange="setVoiceDensity(this.value)" style="width:180px;">' +
      '<option value="all">Every Ball</option>' +
      '<option value="boundaries" selected>Boundaries + Wickets</option>' +
      '<option value="wickets">Wickets Only</option>' +
      '<option value="milestones">Milestones Only</option>' +
      '</select></div>');
  }

  /* ── 4. Stats scope toggle ── */
  var lbPane = document.getElementById('pane-leaderboards');
  var statsHead = document.getElementById('statsTableHead');
  if (lbPane && statsHead && !document.getElementById('statsScopeAll')) {
    var tbl = statsHead.closest('table');
    if (tbl) {
      tbl.insertAdjacentHTML('beforebegin',
        '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
        '<button class="stat-pill active" id="statsScopeAll" onclick="setStatsScope(\'live\')">This Match</button>' +
        '<button class="stat-pill" id="statsScopeTourn" onclick="setStatsScope(\'tournament\')">This Tournament</button>' +
        '</div>');
    }
  }

  /* ── 5. Viewer landing overlay ── */
  if (!document.getElementById('viewerLanding')) {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="viewerLanding" style="display:none;position:fixed;inset:0;background:linear-gradient(160deg,#0a0e1a,#0f172a);z-index:9999;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;">' +
      '<div style="font-size:60px;">📡</div>' +
      '<div style="font-size:22px;font-weight:900;color:#00e676;margin-top:16px;">Connecting to Live Match</div>' +
      '<div id="viewerLandingCode" style="font-size:14px;color:#94a3b8;margin-top:8px;"></div>' +
      '<div style="margin-top:30px;font-size:12px;color:#64748b;">Waiting for host to start…</div>' +
      '</div>');
  }

  /* ── 6. Live viewer count badge ── */
  var shareBadge = document.getElementById('liveShareBadge');
  if (shareBadge && !document.getElementById('liveViewerCount')) {
    shareBadge.insertAdjacentHTML('afterend',
      '<span id="liveViewerCount" style="display:none;font-size:10px;color:#22d3ee;font-weight:800;padding:4px 8px;background:rgba(34,211,238,.12);border-radius:8px;margin-left:6px;">👁 <span id="liveViewerCountNum">0</span></span>');
  }

  /* ── 7. Extras menu — new buttons ── */
  var moreModal = document.getElementById('moreOptionsModal');
  if (moreModal && !document.getElementById('btnRetireBatsman')) {
    var anchor2 = moreModal.querySelector('.modal-body, .modal-content, div');
    if (anchor2) {
      anchor2.insertAdjacentHTML('beforeend',
        '<button class="btn-ui" id="btnEditLastBall" onclick="editLastBall(); closeModal(\'moreOptionsModal\');">✏️ Edit Last Ball</button>' +
        '<button class="btn-ui" id="btnChangeBowlerMid" onclick="changeBowlerMidOver(); closeModal(\'moreOptionsModal\');">🎳 Change Bowler Mid-Over</button>' +
        '<button class="btn-ui" id="btnRetireBatsman" onclick="openRetireModal(); closeModal(\'moreOptionsModal\');" style="background:rgba(251,191,36,.15);border-color:rgba(251,191,36,.45);color:#fbbf24;">🔄 Retire Batsman</button>');
    }
  }

  /* ── 8. Inline Retire button in scoring pane ── */
  injectRetireButton();
}

/* ═══════════════════════════════════════════════════════════
   INJECT RETIRE BUTTON
   ═══════════════════════════════════════════════════════════ */
function injectRetireButton() {
  if (document.getElementById('btnRetireBatsmanInline')) return;
  if (typeof match === 'undefined' || !match || !match.isActive) return;

  var buttons = Array.prototype.slice.call(document.querySelectorAll('button, .btn-ui, .score-btn'));
  var anchor = null;
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var t = (b.textContent || '').trim().toLowerCase();
    var oc = (b.getAttribute('onclick') || '').toLowerCase();
    if (t === 'bowler' || oc.indexOf('promptnextbowler') >= 0 || oc.indexOf('openbowlermodal') >= 0) {
      anchor = b;
      break;
    }
  }
  if (!anchor) {
    for (var j = 0; j < buttons.length; j++) {
      var b2 = buttons[j];
      var t2 = (b2.textContent || '').trim().toLowerCase();
      if (t2.indexOf('swap') >= 0) { anchor = b2; break; }
    }
  }
  if (!anchor || !anchor.parentElement) return;

  var btn = document.createElement('button');
  btn.id = 'btnRetireBatsmanInline';
  btn.className = anchor.className || 'btn-ui';
  btn.style.cssText = 'background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.5);color:#fbbf24;font-weight:800;';
  btn.innerHTML = '🔄 Retire';
  btn.onclick = function (e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (typeof openRetireModal === 'function') openRetireModal();
    else showToast('Retire function not loaded');
  };

  if (anchor.nextSibling) anchor.parentElement.insertBefore(btn, anchor.nextSibling);
  else anchor.parentElement.appendChild(btn);
}

/* ═══════════════════════════════════════════════════════════
   FULLSCREEN / REPLAY
   ═══════════════════════════════════════════════════════════ */
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function (err) { console.warn(err); });
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function triggerReplay() {
  if (typeof match === 'undefined' || !match.shotLog || match.shotLog.length === 0) {
    showToast('No balls to replay yet');
    return;
  }
  var lastShot = match.shotLog[match.shotLog.length - 1];
  var f = document.getElementById('vppIframe') || document.getElementById('stadiumIframe') || document.querySelector('iframe');
  if (f && f.contentWindow) {
    f.contentWindow.postMessage({
      type: 'TRIGGER_DELIVERY',
      shot: Object.assign({}, lastShot, { isReplay: true })
    }, '*');
  }
  if (typeof window.vppPlayDelivery === 'function') window.vppPlayDelivery(lastShot);
  else if (typeof window.playBallAnimation === 'function') window.playBallAnimation(lastShot);
  else showToast('Replaying Ball ' + lastShot.over + '.' + lastShot.ball + ': ' + lastShot.runs + ' runs');
}

/* ═══════════════════════════════════════════════════════════
   AUTO-CAPITALIZE INPUTS (permissive version)
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('input', function (e) {
  var el = e.target;
  if (!el) return;
  var tag = (el.tagName || '').toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
  var type = String(el.type || 'text').toLowerCase();
  var SKIP = ['password','email','number','checkbox','radio','file','color','range',
              'date','time','datetime-local','month','week','hidden',
              'submit','reset','button','image'];
  if (SKIP.indexOf(type) >= 0) return;
  var val = el.value;
  if (!val) return;
  var newVal = autoCapitalize(val);
  if (newVal === val) return;
  var start = null, end = null;
  try { start = el.selectionStart; end = el.selectionEnd; } catch (err) {}
  el.value = newVal;
  if (start !== null && end !== null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(start, end); } catch (err) {}
  }
}, true);
