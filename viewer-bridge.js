/* ============================================================
   CricMax Pro — Viewer Bridge
   Handles: VPP 3D viewer, nav tabs (top-left), LIVE badge
            (bottom-right), button handlers, match state sync
   ============================================================ */

(function(){
  'use strict';

  /* ---------- HELPERS ---------- */
  function showEl(id){
    var el = document.getElementById(id);
    if(el) el.style.display = 'flex';
  }
  function hideEl(id){
    var el = document.getElementById(id);
    if(el) el.style.display = 'none';
  }

  /* ---------- SHOW / HIDE PITCH UI ---------- */
  function showPitchUI(){
    // Toolbar (top-left) uses flex column
    var toolbar = document.getElementById('vppToolbar');
    if(toolbar) toolbar.style.display = 'flex';

    // Live badge (bottom-right)
    var badge = document.getElementById('vppLiveBadge');
    if(badge) badge.style.display = 'flex';

    // Hide main app chrome
    var tb = document.querySelector('.top-bar'); if(tb) tb.style.display = 'none';
    var bn = document.querySelector('.bottom-match-nav'); if(bn) bn.style.display = 'none';

    // Remove any floating return button from previous nav
    var fb = document.getElementById('vppFloatingReturn');
    if(fb) fb.remove();
  }

  function hidePitchUI(){
    var toolbar = document.getElementById('vppToolbar');
    if(toolbar) toolbar.style.display = 'none';
    var badge = document.getElementById('vppLiveBadge');
    if(badge) badge.style.display = 'none';
  }

  /* ---------- ADD / REMOVE FLOATING RETURN BUTTON ---------- */
  function ensureReturnButton(){
    var btn = document.getElementById('vppFloatingReturn');
    if(btn) return;
    btn = document.createElement('button');
    btn.id = 'vppFloatingReturn';
    btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:100001;background:linear-gradient(135deg,#009270,#00e676);color:#fff;border:none;padding:12px 22px;border-radius:30px;font-weight:900;box-shadow:0 8px 24px rgba(0,230,118,.45);cursor:pointer;font-size:13px;font-family:inherit;';
    btn.innerText = '🏏 Return to 3D Pitch';
    btn.onclick = function(){ window.vppNavTo('pitch'); };
    document.body.appendChild(btn);
  }
  function removeReturnButton(){
    var btn = document.getElementById('vppFloatingReturn');
    if(btn) btn.remove();
  }

  /* ---------- NAVIGATE BETWEEN PITCH AND 2D VIEWS ---------- */
  window.vppNavTo = function(pane){
    var vppEl = document.getElementById('vpp');
    var dashEl = document.getElementById('view-dashboard');
    var homeEl = document.getElementById('view-home');

    if (pane === 'pitch') {
      // Show pitch + viewer UI
      if(vppEl) vppEl.style.display = 'block';
      if(dashEl) dashEl.style.display = 'none';
      if(homeEl) homeEl.style.display = 'none';
      showPitchUI();
      removeReturnButton();

      // If iframe isn't loaded, load it
      if(!document.getElementById('vppIframe')){
        var iframe = document.createElement('iframe');
        iframe.id = 'vppIframe';
        iframe.src = 'viewer.html';
        iframe.setAttribute('allow', 'fullscreen; autoplay');
        iframe.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:none; z-index:1;';
        if(vppEl) vppEl.appendChild(iframe);
      }
    } else {
      // Hide pitch, show 2D dashboard
      if(vppEl) vppEl.style.display = 'none';
      if(homeEl) homeEl.style.display = 'none';
      if(dashEl) dashEl.style.display = 'block';

      // Hide pitch UI chrome
      hidePitchUI();

      // Hide main app chrome too — user stays in a clean 2D view
      var tb = document.querySelector('.top-bar'); if(tb) tb.style.display = 'none';
      var bn = document.querySelector('.bottom-match-nav'); if(bn) bn.style.display = 'none';

      // Activate the requested pane
      if(typeof selectSubPane === 'function'){
        try { selectSubPane(pane); } catch(e){ console.warn('selectSubPane error:', e); }
      }

      // Force pane visible in case selectSubPane missed it
      var paneEl = document.getElementById('pane-' + pane);
      if(paneEl){
        document.querySelectorAll('.sub-pane').forEach(function(p){ p.classList.remove('active'); });
        paneEl.classList.add('active');
      }

      // Re-render pane-specific content
      try {
        if(pane === 'scorecard'   && typeof renderScorecard      === 'function') renderScorecard();
        if(pane === 'analytics'   && typeof renderNzcAnalytics   === 'function') renderNzcAnalytics();
        if(pane === 'leaderboards'&& typeof renderStatsCategory  === 'function') renderStatsCategory('mvp');
        if(pane === 'summary'     && typeof renderSummary        === 'function') renderSummary();
        if(pane === 'live'        && typeof renderLive           === 'function') renderLive();
      } catch(e){ console.warn('pane render error:', e); }

      // Show return button
      ensureReturnButton();
    }
  };

  /* ---------- LAUNCH 3D PITCH FULLSCREEN ---------- */
  window.vppStart = function(){
    var el = document.getElementById('vpp');
    if(el){ el.style.display = 'block'; el.classList.add('on'); }

    var tb = document.querySelector('.top-bar'); if(tb) tb.style.display = 'none';
    var bn = document.querySelector('.bottom-match-nav'); if(bn) bn.style.display = 'none';
    var h  = document.getElementById('view-home'); if(h) h.style.display = 'none';
    var d  = document.getElementById('view-dashboard'); if(d) d.style.display = 'none';

    showPitchUI();

    if(!document.getElementById('vppIframe')){
      var iframe = document.createElement('iframe');
      iframe.id = 'vppIframe';
      iframe.src = 'viewer.html';
      iframe.setAttribute('allow', 'fullscreen; autoplay');
      iframe.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:none; z-index:1; pointer-events:auto;';
      if(el) el.appendChild(iframe);
    }
  };

  /* ---------- OLD vppShowPane (kept for compatibility) ---------- */
  window.vppShowPane = function(pane){
    window.vppNavTo(pane);
  };

  /* ---------- BUTTON HANDLERS ---------- */
  window.vppToggleSound = function(){
    var iframe = document.getElementById('vppIframe');
    if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage({type:'toggleSound'}, '*');
    var b = document.getElementById('vppSndBtn');
    if(b) b.innerText = (b.innerText === '🔊') ? '🔇' : '🔊';

    // Also toggle the app's commentary if it exists
    try {
      if(typeof toggleCommentaryVoice === 'function') toggleCommentaryVoice();
    } catch(e){}
  };

  window.vppReplay = function(){
    var iframe = document.getElementById('vppIframe');
    if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage({type:'replay'}, '*');
    try {
      if(typeof triggerReplay === 'function') triggerReplay();
    } catch(e){}
  };

  window.vppFullscreen = function(){
    var el = document.getElementById('vpp');
    if(!document.fullscreenElement){
      if(el.requestFullscreen) el.requestFullscreen();
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if(document.exitFullscreen) document.exitFullscreen();
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  };

  /* ---------- GLOBAL MATCH EXPOSER (for iframe viewer) ---------- */
  setInterval(function(){
    try { if(typeof match !== 'undefined' && match !== null) window.match = match; } catch(e){}
    try { if(typeof isViewerMode !== 'undefined') window.isViewerMode = isViewerMode; } catch(e){}
  }, 500);

  setTimeout(function(){
    try { if(typeof match !== 'undefined') window.match = match; } catch(e){}
  }, 100);

  console.log('✅ Viewer bridge loaded');
})();
