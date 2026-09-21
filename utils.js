/* ============================================================
   utils.js — Toast, render scheduler, helpers, HTML injector
   ============================================================ */

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

function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    renderLive();
    renderCommentary();
    renderSummary();
    renderScorecard();
  });
}

function autoCapitalize(s) {
  if (!s) return '';
  return s.replace(/(^|\s|[\-'])\S/g, m => m.toUpperCase());
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

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
  const spinKeywords = ['spin','ashwin','jadeja','chahal','kuldeep','rashid','tahir','zampa','shakib','moeen','lyon','herath','sodhi','santner','swepson','parkinson','bishnoi','chakaravarthy','axar','sundar','hooda','markram','maxwell','root','shah','mujeeb','noor','hasaranga','theekshana','wellalage'];
  for (const k of spinKeywords) if (lower.includes(k)) return 'spin';
  return 'pace';
}

/* Injects optional UI elements so no HTML file edits are needed */
function injectHelpElements() {
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
    if (!opts.includes('Retired Hurt')) mSel.insertAdjacentHTML('beforeend', '<option value="Retired Hurt">Retired Hurt</option>');
    if (!opts.includes('Obstructing Field')) mSel.insertAdjacentHTML('beforeend', '<option value="Obstructing Field">Obstructing the Field</option>');
  }

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

  if (!document.getElementById('viewerLanding')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="viewerLanding" style="display:none;position:fixed;inset:0;background:linear-gradient(160deg,#0a0e1a,#0f172a);z-index:9999;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;">
        <div style="font-size:60px;">📡</div>
        <div style="font-size:22px;font-weight:900;color:#00e676;margin-top:16px;">Connecting to Live Match</div>
        <div id="viewerLandingCode" style="font-size:14px;color:#94a3b8;margin-top:8px;"></div>
        <div style="margin-top:30px;font-size:12px;color:#64748b;">Waiting for host to start…</div>
      </div>`);
  }

  const shareBadge = document.getElementById('liveShareBadge');
  if (shareBadge && !document.getElementById('liveViewerCount')) {
    shareBadge.insertAdjacentHTML('afterend', `
      <span id="liveViewerCount" style="display:none;font-size:10px;color:#22d3ee;font-weight:800;padding:4px 8px;background:rgba(34,211,238,.12);border-radius:8px;margin-left:6px;">👁 <span id="liveViewerCountNum">0</span></span>`);
  }

  const moreModal = document.getElementById('moreOptionsModal');
  if (moreModal && !document.getElementById('btnEditLastBall')) {
    const anchor = moreModal.querySelector('.modal-body, .modal-content, div');
    if (anchor) {
      anchor.insertAdjacentHTML('beforeend', `
        <button class="btn-ui" id="btnEditLastBall" onclick="editLastBall(); closeModal('moreOptionsModal');">✏️ Edit Last Ball</button>
        <button class="btn-ui" id="btnChangeBowlerMid" onclick="changeBowlerMidOver(); closeModal('moreOptionsModal');">🎳 Change Bowler Mid-Over</button>
      `);
    }
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(err => console.warn(err));
  else if (document.exitFullscreen) document.exitFullscreen();
}

function triggerReplay() {
  if (!match.shotLog || match.shotLog.length === 0) return showToast('No balls to replay yet');
  const lastShot = match.shotLog[match.shotLog.length - 1];
  const f = document.getElementById('vppIframe') || document.getElementById('stadiumIframe') || document.querySelector('iframe');
  if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'TRIGGER_DELIVERY', shot: Object.assign({}, lastShot, { isReplay: true }) }, '*');
  if (typeof window.vppPlayDelivery === 'function') window.vppPlayDelivery(lastShot);
  else if (typeof window.playBallAnimation === 'function') window.playBallAnimation(lastShot);
  else showToast(`Replaying Ball ${lastShot.over}.${lastShot.ball}: ${lastShot.runs} runs`);
}
