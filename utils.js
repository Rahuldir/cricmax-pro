/* ============================================================
   utils.js — Toast, render scheduler, helpers, HTML injectors
   ============================================================ */

/* ─── Toast ─────────────────────────────────────────────── */
function showToast(msg, duration = 2600) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.style.cssText = 'position:fixed;bottom:105px;left:50%;transform:translateX(-50%) translateY(30px);background:linear-gradient(135deg,rgba(0,146,112,.97),rgba(0,230,118,.97));color:#fff;padding:12px 24px;border-radius:14px;font-size:12.5px;font-weight:800;z-index:9999999;box-shadow:0 10px 40px rgba(0,0,0,.65),0 0 30px rgba(0,230,118,.4);max-width:90vw;text-align:center;opacity:0;transition:all .35s cubic-bezier(.175,.885,.32,1.275);pointer-events:none;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.3);word-break:break-word;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(30px)';
  }, duration);
}

/* ─── Batched Render ────────────────────────────────────── */
function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    try { renderLive(); } catch (e) { console.warn('renderLive:', e); }
    try { renderCommentary(); } catch (e) { console.warn('renderCommentary:', e); }
    try { renderSummary(); } catch (e) { console.warn('renderSummary:', e); }
    try { renderScorecard(); } catch (e) { console.warn('renderScorecard:', e); }
  });
}

/* ─── Text helpers ──────────────────────────────────────── */
function autoCapitalize(s) {
  if (!s) return '';
  return String(s).replace(/(^|\s|[\-'])\S/g, m => m.toUpperCase());
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ─── Team / player helpers ─────────────────────────────── */
function autoAddPlayerToTeam(playerName, teamName) {
  if (!playerName || !teamName) return;
  playerName = autoCapitalize(playerName.trim());
  if (!playerName) return;
  const t = savedTeams.find(x => x.name === teamName);
  if (!t) return;
  if (!t.squad) t.squad = [];
  if (!t.squad.includes(playerName)) {
    t.squad.push(playerName);
    autoPersist();
  }
}

function detectBowlerType(name) {
  if (!name) return 'pace';
  if (bowlerTypeMap[name]) return bowlerTypeMap[name];
  const lower = name.toLowerCase();
  const spinKeywords = [
    'spin','ashwin','jadeja','chahal','kuldeep','rashid','tahir','zampa','shakib',
    'moeen','lyon','herath','sodhi','santner','swepson','parkinson','bishnoi',
    'chakaravarthy','axar','sundar','hooda','markram','maxwell','root','shah',
    'mujeeb','noor','hasaranga','theekshana','wellalage'
  ];
  for (const k of spinKeywords) if (lower.includes(k)) return 'spin';
  return 'pace';
}

/* ============================================================
   injectHelpElements — inject all optional UI elements
   ============================================================ */
function injectHelpElements() {

  /* ── 1. Wicket modal — Who is OUT? + extra dismissal options ── */
  const wkModal = document.getElementById('wicketTypeModal');
  const mSel = document.getElementById('wktMethodSelect');
  if (wkModal && mSel) {
    if (!document.getElementById('wktDismissedGroup')) {
      const dg = document.createElement('div');
      dg.className = 'form-group';
      dg.id = 'wktDismissedGroup';
      dg.style.display = 'none';
      dg.innerHTML = `
        <label class="form-label">🚪 Who is OUT?</label>
        <select id="wktDismissedBatter" class="form-control">
          <option value="striker">Striker</option>
          <option value="nonStriker">Non-Striker</option>
        </select>`;
      mSel.parentElement.parentElement.insertBefore(dg, mSel.parentElement.nextSibling);
    }
    const opts = Array.from(mSel.options).map(o => o.value);
    if (!opts.includes('Retired Hurt')) {
      mSel.insertAdjacentHTML('beforeend', '<option value="Retired Hurt">Retired Hurt</option>');
    }
    if (!opts.includes('Obstructing Field')) {
      mSel.insertAdjacentHTML('beforeend', '<option value="Obstructing Field">Obstructing the Field</option>');
    }
  }

  /* ── 2. Man of the Match box ── */
  const resultModal = document.getElementById('resultModal');
  const resultScores = document.getElementById('resultScores');
  if (resultModal && resultScores && !document.getElementById('motmBox')) {
    resultScores.insertAdjacentHTML('afterend', `
      <div id="motmBox" style="margin-top:14px;padding:14px;background:linear-gradient(135deg,rgba(255,193,7,.15),rgba(255,152,0,.08));border-radius:12px;border:1px solid rgba(255,193,7,.4);display:none;">
        <div style="font-size:10px;color:#ffc107;font-weight:900;text-transform:uppercase;letter-spacing:1px;">🏅 Man of the Match</div>
        <div id="motmName" style="font-size:18px;font-weight:900;color:#fff;margin-top:4px;"></div>
        <div id="motmStats" style="font-size:11px;color:var(--muted);margin-top:4px;"></div>
      </div>`);
  }

  /* ── 3. Commentary density selector ── */
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal && !document.getElementById('cfgVoiceDensity')) {
    const anchor = settingsModal.querySelector('.settings-scroll') || settingsModal;
    anchor.insertAdjacentHTML('beforeend', `
      <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:8px;">
        <span style="font-size:12px;font-weight:700;">🎙️ Commentary Density</span>
        <select id="cfgVoiceDensity" class="form-control" onchange="setVoiceDensity(this.value)" style="width:180px;">
          <option value="all">Every Ball</option>
          <option value="boundaries" selected>Boundaries + Wickets</option>
          <option value="wickets">Wickets Only</option>
          <option value="milestones">Milestones Only</option>
        </select>
      </div>`);
  }

  /* ── 4. Stats scope toggle ── */
  const lbPane = document.getElementById('pane-leaderboards');
  const statsHead = document.getElementById('statsTableHead');
  if (lbPane && statsHead && !document.getElementById('statsScopeAll')) {
    const tbl = statsHead.closest('table');
    if (tbl) {
      tbl.insertAdjacentHTML('beforebegin', `
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button class="stat-pill active" id="statsScopeAll" onclick="setStatsScope('live')">This Match</button>
          <button class="stat-pill" id="statsScopeTourn" onclick="setStatsScope('tournament')">This Tournament</button>
        </div>`);
    }
  }

  /* ── 5. Viewer landing overlay ── */
  if (!document.getElementById('viewerLanding')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="viewerLanding" style="display:none;position:fixed;inset:0;background:linear-gradient(160deg,#0a0e1a,#0f172a);z-index:9999;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;">
        <div style="font-size:60px;">📡</div>
        <div style="font-size:22px;font-weight:900;color:#00e676;margin-top:16px;">Connecting to Live Match</div>
        <div id="viewerLandingCode" style="font-size:14px;color:#94a3b8;margin-top:8px;"></div>
        <div style="margin-top:30px;font-size:12px;color:#64748b;">Waiting for host to start…</div>
      </div>`);
  }

  /* ── 6. Viewer count badge ── */
  const shareBadge = document.getElementById('liveShareBadge');
  if (shareBadge && !document.getElementById('liveViewerCount')) {
    shareBadge.insertAdjacentHTML('afterend', `
      <span id="liveViewerCount" style="display:none;font-size:10px;color:#22d3ee;font-weight:800;padding:4px 8px;background:rgba(34,211,238,.12);border-radius:8px;margin-left:6px;">👁 <span id="liveViewerCountNum">0</span></span>`);
  }

  /* ── 7. Extras menu — new buttons ── */
  const moreModal = document.getElementById('moreOptionsModal');
  if (moreModal && !document.getElementById('btnRetireBatsman')) {
    const anchor = moreModal.querySelector('.modal-body, .modal-content, div');
    if (anchor) {
      anchor.insertAdjacentHTML('beforeend', `
        <button class="btn-ui" id="btnEditLastBall" onclick="editLastBall(); closeModal('moreOptionsModal');">✏️ Edit Last Ball</button>
        <button class="btn-ui" id="btnChangeBowlerMid" onclick="changeBowlerMidOver(); closeModal('moreOptionsModal');">🎳 Change Bowler Mid-Over</button>
        <button class="btn-ui" id="btnRetireBatsman" onclick="openRetireModal(); closeModal('moreOptionsModal');" style="background:rgba(251,191,36,.15);border-color:rgba(251,191,36,.45);color:#fbbf24;">🔄 Retire Batsman</button>
      `);
    }
  }

  /* ── 8. Inline Retire button in the scoring pane ── */
  injectRetireButton();
  /* ── 9. Auto re-inject on tab switches so it's never missing ── */
  setInterval(function () {
    injectRetireButton();
    injectBowlerSwapShortcut();
  }, 1500);
}

/* ============================================================
   injectRetireButton — puts a 🔄 Retire button next to the
   Swap / Bowler / End Innings row in the live scoring pane.
   ============================================================ */
function injectRetireButton() {
  if (document.getElementById('btnRetireBatsmanInline')) return;
  if (!match || !match.isActive) return;

  /* Find the Swap / Bowler / End Innings row */
  const buttons = Array.from(document.querySelectorAll('button, .btn-ui, .score-btn'));
  let swapBtn = null;
  let bowlerBtn = null;
  let endBtn = null;

  buttons.forEach(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    const oc = (b.getAttribute('onclick') || '').toLowerCase();
    if (!swapBtn && (t.includes('swap') || oc.includes('swapstrikers'))) swapBtn = b;
    if (!bowlerBtn && (t === 'bowler' || oc.includes('promptnextbowler') || oc.includes('openbowlermodal'))) bowlerBtn = b;
    if (!endBtn && (t.includes('end innings') || oc.includes('endinnings'))) endBtn = b;
  });

  const anchor = bowlerBtn || swapBtn || endBtn;
  if (!anchor || !anchor.parentElement) return;

  const row = anchor.parentElement;
  const btn = document.createElement('button');
  btn.id = 'btnRetireBatsmanInline';
  btn.className = anchor.className || 'btn-ui';
  btn.style.cssText = 'background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.5);color:#fbbf24;font-weight:800;';
  btn.innerHTML = '🔄 Retire';
  btn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof openRetireModal === 'function') openRetireModal();
    else showToast('Retire function not loaded');
  };

  /* Insert AFTER bowler (or swap if no bowler) */
  if (anchor.nextSibling) row.insertBefore(btn, anchor.nextSibling);
  else row.appendChild(btn);
}

/* ============================================================
   injectBowlerSwapShortcut — ensures Bowler button opens the modal
   even if the original onclick is missing.
   ============================================================ */
function injectBowlerSwapShortcut() {
  if (!match || !match.isActive) return;
  const buttons = Array.from(document.querySelectorAll('button, .btn-ui, .score-btn'));
  buttons.forEach(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    const oc = (b.getAttribute('onclick') || '').toLowerCase();
    const isBowler = (t === 'bowler' || oc.includes('promptnextbowler'));
    if (isBowler && !b._cricmaxWired) {
      b._cricmaxWired = true;
      if (!oc.includes('promptnextbowler') && !oc.includes('openbowlermodal')) {
        b.onclick = function (e) {
          e.preventDefault();
          if (typeof promptNextBowlerModal === 'function') promptNextBowlerModal();
        };
      }
    }
  });
}

/* ─── Fullscreen / Replay ───────────────────────────────── */
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.warn(err));
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function triggerReplay() {
  if (!match.shotLog || match.shotLog.length === 0) {
    showToast('No balls to replay yet');
    return;
  }
  const lastShot = match.shotLog[match.shotLog.length - 1];
  const f = document.getElementById('vppIframe') || document.getElementById('stadiumIframe') || document.querySelector('iframe');
  if (f && f.contentWindow) {
    f.contentWindow.postMessage({
      type: 'TRIGGER_DELIVERY',
      shot: Object.assign({}, lastShot, { isReplay: true })
    }, '*');
  }
  if (typeof window.vppPlayDelivery === 'function') window.vppPlayDelivery(lastShot);
  else if (typeof window.playBallAnimation === 'function') window.playBallAnimation(lastShot);
  else showToast(`Replaying Ball ${lastShot.over}.${lastShot.ball}: ${lastShot.runs} runs`);
}  if (resultModal && resultScores && !document.getElementById('motmBox')) {
    resultScores.insertAdjacentHTML('afterend', `
      <div id="motmBox" style="margin-top:14px;padding:14px;background:linear-gradient(135deg,rgba(255,193,7,.15),rgba(255,152,0,.08));border-radius:12px;border:1px solid rgba(255,193,7,.4);display:none;">
        <div style="font-size:10px;color:#ffc107;font-weight:900;text-transform:uppercase;letter-spacing:1px;">🏅 Man of the Match</div>
        <div id="motmName" style="font-size:18px;font-weight:900;color:#fff;margin-top:4px;"></div>
        <div id="motmStats" style="font-size:11px;color:var(--muted);margin-top:4px;"></div>
      </div>`);
  }

  /* ── 3. Commentary density selector ── */
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal && !document.getElementById('cfgVoiceDensity')) {
    const anchor = settingsModal.querySelector('.settings-scroll') || settingsModal;
    anchor.insertAdjacentHTML('beforeend', `
      <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:8px;">
        <span style="font-size:12px;font-weight:700;">🎙️ Commentary Density</span>
        <select id="cfgVoiceDensity" class="form-control" onchange="setVoiceDensity(this.value)" style="width:180px;">
          <option value="all">Every Ball</option>
          <option value="boundaries" selected>Boundaries + Wickets</option>
          <option value="wickets">Wickets Only</option>
          <option value="milestones">Milestones Only</option>
        </select>
      </div>`);
  }

  /* ── 4. Stats scope toggle ── */
  const lbPane = document.getElementById('pane-leaderboards');
  const statsHead = document.getElementById('statsTableHead');
  if (lbPane && statsHead && !document.getElementById('statsScopeAll')) {
    const tbl = statsHead.closest('table');
    if (tbl) {
      tbl.insertAdjacentHTML('beforebegin', `
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button class="stat-pill active" id="statsScopeAll" onclick="setStatsScope('live')">This Match</button>
          <button class="stat-pill" id="statsScopeTourn" onclick="setStatsScope('tournament')">This Tournament</button>
        </div>`);
    }
  }

  /* ── 5. Viewer landing overlay ── */
  if (!document.getElementById('viewerLanding')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="viewerLanding" style="display:none;position:fixed;inset:0;background:linear-gradient(160deg,#0a0e1a,#0f172a);z-index:9999;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;">
        <div style="font-size:60px;">📡</div>
        <div style="font-size:22px;font-weight:900;color:#00e676;margin-top:16px;">Connecting to Live Match</div>
        <div id="viewerLandingCode" style="font-size:14px;color:#94a3b8;margin-top:8px;"></div>
        <div style="margin-top:30px;font-size:12px;color:#64748b;">Waiting for host to start…</div>
      </div>`);
  }

  /* ── 6. Viewer count badge ── */
  const shareBadge = document.getElementById('liveShareBadge');
  if (shareBadge && !document.getElementById('liveViewerCount')) {
    shareBadge.insertAdjacentHTML('afterend', `
      <span id="liveViewerCount" style="display:none;font-size:10px;color:#22d3ee;font-weight:800;padding:4px 8px;background:rgba(34,211,238,.12);border-radius:8px;margin-left:6px;">👁 <span id="liveViewerCountNum">0</span></span>`);
  }

  /* ── 7. Extras menu — new buttons ── */
  const moreModal = document.getElementById('moreOptionsModal');
  if (moreModal && !document.getElementById('btnRetireBatsman')) {
    const anchor = moreModal.querySelector('.modal-body, .modal-content, div');
    if (anchor) {
      anchor.insertAdjacentHTML('beforeend', `
        <button class="btn-ui" id="btnEditLastBall" onclick="editLastBall(); closeModal('moreOptionsModal');">✏️ Edit Last Ball</button>
        <button class="btn-ui" id="btnChangeBowlerMid" onclick="changeBowlerMidOver(); closeModal('moreOptionsModal');">🎳 Change Bowler Mid-Over</button>
        <button class="btn-ui" id="btnRetireBatsman" onclick="openRetireModal(); closeModal('moreOptionsModal');" style="background:rgba(251,191,36,.15);border-color:rgba(251,191,36,.45);color:#fbbf24;">🔄 Retire Batsman</button>
      `);
    }
  }

  /* ── 8. Inline Retire button in the scoring pane ── */
  injectRetireButton();
  /* ── 9. Auto re-inject on tab switches so it's never missing ── */
  setInterval(function () {
    injectRetireButton();
    injectBowlerSwapShortcut();
  }, 1500);
}

/* ============================================================
   injectRetireButton — puts a 🔄 Retire button next to the
   Swap / Bowler / End Innings row in the live scoring pane.
   ============================================================ */
function injectRetireButton() {
  if (document.getElementById('btnRetireBatsmanInline')) return;
  if (!match || !match.isActive) return;

  /* Find the Swap / Bowler / End Innings row */
  const buttons = Array.from(document.querySelectorAll('button, .btn-ui, .score-btn'));
  let swapBtn = null;
  let bowlerBtn = null;
  let endBtn = null;

  buttons.forEach(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    const oc = (b.getAttribute('onclick') || '').toLowerCase();
    if (!swapBtn && (t.includes('swap') || oc.includes('swapstrikers'))) swapBtn = b;
    if (!bowlerBtn && (t === 'bowler' || oc.includes('promptnextbowler') || oc.includes('openbowlermodal'))) bowlerBtn = b;
    if (!endBtn && (t.includes('end innings') || oc.includes('endinnings'))) endBtn = b;
  });

  const anchor = bowlerBtn || swapBtn || endBtn;
  if (!anchor || !anchor.parentElement) return;

  const row = anchor.parentElement;
  const btn = document.createElement('button');
  btn.id = 'btnRetireBatsmanInline';
  btn.className = anchor.className || 'btn-ui';
  btn.style.cssText = 'background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.5);color:#fbbf24;font-weight:800;';
  btn.innerHTML = '🔄 Retire';
  btn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof openRetireModal === 'function') openRetireModal();
    else showToast('Retire function not loaded');
  };

  /* Insert AFTER bowler (or swap if no bowler) */
  if (anchor.nextSibling) row.insertBefore(btn, anchor.nextSibling);
  else row.appendChild(btn);
}

/* ============================================================
   injectBowlerSwapShortcut — ensures Bowler button opens the modal
   even if the original onclick is missing.
   ============================================================ */
function injectBowlerSwapShortcut() {
  if (!match || !match.isActive) return;
  const buttons = Array.from(document.querySelectorAll('button, .btn-ui, .score-btn'));
  buttons.forEach(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    const oc = (b.getAttribute('onclick') || '').toLowerCase();
    const isBowler = (t === 'bowler' || oc.includes('promptnextbowler'));
    if (isBowler && !b._cricmaxWired) {
      b._cricmaxWired = true;
      if (!oc.includes('promptnextbowler') && !oc.includes('openbowlermodal')) {
        b.onclick = function (e) {
          e.preventDefault();
          if (typeof promptNextBowlerModal === 'function') promptNextBowlerModal();
        };
      }
    }
  });
}

/* ─── Fullscreen / Replay ───────────────────────────────── */
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.warn(err));
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function triggerReplay() {
  if (!match.shotLog || match.shotLog.length === 0) {
    showToast('No balls to replay yet');
    return;
  }
  const lastShot = match.shotLog[match.shotLog.length - 1];
  const f = document.getElementById('vppIframe') || document.getElementById('stadiumIframe') || document.querySelector('iframe');
  if (f && f.contentWindow) {
    f.contentWindow.postMessage({
      type: 'TRIGGER_DELIVERY',
      shot: Object.assign({}, lastShot, { isReplay: true })
    }, '*');
  }
  if (typeof window.vppPlayDelivery === 'function') window.vppPlayDelivery(lastShot);
  else if (typeof window.playBallAnimation === 'function') window.playBallAnimation(lastShot);
  else showToast(`Replaying Ball ${lastShot.over}.${lastShot.ball}: ${lastShot.runs} runs`);
}
  /* ── 3. Commentary density selector inside settings ── */
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal && !document.getElementById('cfgVoiceDensity')) {
    const anchor = settingsModal.querySelector('.settings-scroll') || settingsModal;
    anchor.insertAdjacentHTML('beforeend', `
      <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:8px;">
        <span style="font-size:12px;font-weight:700;">🎙️ Commentary Density</span>
        <select id="cfgVoiceDensity" class="form-control" onchange="setVoiceDensity(this.value)" style="width:180px;">
          <option value="all">Every Ball</option>
          <option value="boundaries" selected>Boundaries + Wickets</option>
          <option value="wickets">Wickets Only</option>
          <option value="milestones">Milestones Only</option>
        </select>
      </div>`);
  }

  /* ── 4. Stats scope toggle (live vs tournament) ── */
  const lbPane = document.getElementById('pane-leaderboards');
  const statsHead = document.getElementById('statsTableHead');
  if (lbPane && statsHead && !document.getElementById('statsScopeAll')) {
    const tbl = statsHead.closest('table');
    if (tbl) {
      tbl.insertAdjacentHTML('beforebegin', `
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button class="stat-pill active" id="statsScopeAll" onclick="setStatsScope('live')">This Match</button>
          <button class="stat-pill" id="statsScopeTourn" onclick="setStatsScope('tournament')">This Tournament</button>
        </div>`);
    }
  }

  /* ── 5. Viewer landing overlay ── */
  if (!document.getElementById('viewerLanding')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="viewerLanding" style="display:none;position:fixed;inset:0;background:linear-gradient(160deg,#0a0e1a,#0f172a);z-index:9999;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;">
        <div style="font-size:60px;">📡</div>
        <div style="font-size:22px;font-weight:900;color:#00e676;margin-top:16px;">Connecting to Live Match</div>
        <div id="viewerLandingCode" style="font-size:14px;color:#94a3b8;margin-top:8px;"></div>
        <div style="margin-top:30px;font-size:12px;color:#64748b;">Waiting for host to start…</div>
      </div>`);
  }

  /* ── 6. Live viewer count badge ── */
  const shareBadge = document.getElementById('liveShareBadge');
  if (shareBadge && !document.getElementById('liveViewerCount')) {
    shareBadge.insertAdjacentHTML('afterend', `
      <span id="liveViewerCount" style="display:none;font-size:10px;color:#22d3ee;font-weight:800;padding:4px 8px;background:rgba(34,211,238,.12);border-radius:8px;margin-left:6px;">👁 <span id="liveViewerCountNum">0</span></span>`);
  }

  /* ── 7. Extras menu — Edit Last Ball / Change Bowler / Retire Batsman ── */
  const moreModal = document.getElementById('moreOptionsModal');
  if (moreModal && !document.getElementById('btnEditLastBall')) {
    const anchor = moreModal.querySelector('.modal-body, .modal-content, div');
    if (anchor) {
      anchor.insertAdjacentHTML('beforeend', `
        <button class="btn-ui" id="btnEditLastBall"
                onclick="editLastBall(); closeModal('moreOptionsModal');"
                style="text-align:left;padding:12px;">
          ✏️ Edit Last Ball
        </button>
        <button class="btn-ui" id="btnChangeBowlerMid"
                onclick="changeBowlerMidOver(); closeModal('moreOptionsModal');"
                style="text-align:left;padding:12px;">
          🎳 Change Bowler Mid-Over
        </button>
        <button class="btn-ui" id="btnRetireBatsman"
                onclick="openRetireModal(); closeModal('moreOptionsModal');"
                style="text-align:left;padding:12px;background:rgba(251,191,36,.15);border-color:rgba(251,191,36,.45);color:#fbbf24;">
          🔄 Retire Batsman
        </button>
      `);
    }
  }

  /* ── 8. Also try to inject Retire button next to live scorer controls ── */
  injectRetireButton();
}

/* ============================================================
   RETIRE BUTTON INJECTOR
   Adds a small "Retire" button in the live scoring pane if there's
   a matching button row (Bowler / Swap / End Innings row).
   ============================================================ */
function injectRetireButton() {
  /* If already injected, skip */
  if (document.getElementById('btnRetireBatsmanInline')) return;

  /* Look for the row that has Swap / Bowler / End Innings buttons */
  const candidates = document.querySelectorAll('button, .btn-ui');
  let swapBtn = null;
  let bowlerBtn = null;
  candidates.forEach(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    const oc = (b.getAttribute('onclick') || '').toLowerCase();
    if (!swapBtn && (t.includes('swap') || oc.includes('swapstrikers'))) swapBtn = b;
    if (!bowlerBtn && (t === 'bowler' || oc.includes('openbowler') || oc.includes('promptnextbowler'))) bowlerBtn = b;
  });

  const anchor = bowlerBtn || swapBtn;
  if (!anchor) return;

  /* Only inject once — even if both buttons found, we use one */
  if (document.getElementById('btnRetireBatsmanInline')) return;

  const btn = document.createElement('button');
  btn.id = 'btnRetireBatsmanInline';
  btn.className = anchor.className || 'btn-ui';
  btn.style.cssText = 'margin-top:6px;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.45);color:#fbbf24;font-weight:800;';
  btn.innerHTML = '🔄 Retire Batsman';
  btn.onclick = function () { openRetireModal(); };

  /* Insert after the anchor's parent row (so it sits below) */
  if (anchor.parentElement && anchor.parentElement.parentElement) {
    anchor.parentElement.parentElement.appendChild(btn);
  } else if (anchor.parentElement) {
    anchor.parentElement.appendChild(btn);
  }
}

/* ============ FULLSCREEN / REPLAY ============ */
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.warn(err));
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function triggerReplay() {
  if (!match.shotLog || match.shotLog.length === 0) {
    showToast('No balls to replay yet');
    return;
  }
  const lastShot = match.shotLog[match.shotLog.length - 1];

  /* Forward to 3D viewer iframe if present */
  const f = document.getElementById('vppIframe')
         || document.getElementById('stadiumIframe')
         || document.querySelector('iframe');
  if (f && f.contentWindow) {
    f.contentWindow.postMessage({
      type: 'TRIGGER_DELIVERY',
      shot: Object.assign({}, lastShot, { isReplay: true })
    }, '*');
  }

  if (typeof window.vppPlayDelivery === 'function') {
    window.vppPlayDelivery(lastShot);
  } else if (typeof window.playBallAnimation === 'function') {
    window.playBallAnimation(lastShot);
  } else {
    showToast(`Replaying Ball ${lastShot.over}.${lastShot.ball}: ${lastShot.runs} runs`);
  }
}

/* ============ WAIT FOR GLOBAL FN (tiny helper) ============ */
/* Some functions (openRetireModal, changeBowlerMidOver, editLastBall)
   live in scoring.js / dev-tools.js. If those files load AFTER utils.js,
   the onclick handlers will still work because they resolve at click-time.
   This helper is just a safety guard. */
function _hasFn(name) {
  return typeof window[name] === 'function';
}
