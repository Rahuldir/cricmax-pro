/* ============================================================
   CricMax Pro — Viewer Bridge
   Handles: VPP 3D viewer, iframe nav messages, toolbar
   ============================================================ */

(function(){
  'use strict';

  /* ---------- SHOW / HIDE PITCH UI ---------- */
  function showPitchUI(){
    var toolbar = document.getElementById('vppToolbar');
    if (toolbar) toolbar.style.display = 'flex';
    var badge = document.getElementById('vppLiveBadge');
    if (badge) badge.style.display = 'flex';
    var tb = document.querySelector('.top-bar'); if (tb) tb.style.display = 'none';
    var bn = document.querySelector('.bottom-match-nav'); if (bn) bn.style.display = 'none';
    var fb = document.getElementById('vppFloatingReturn');
    if (fb) fb.remove();
  }
  function hidePitchUI(){
    var toolbar = document.getElementById('vppToolbar');
    if (toolbar) toolbar.style.display = 'none';
    var badge = document.getElementById('vppLiveBadge');
    if (badge) badge.style.display = 'none';
  }

  /* ---------- FLOATING RETURN BUTTON ---------- */
  function ensureReturnButton(){
    var btn = document.getElementById('vppFloatingReturn');
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'vppFloatingReturn';
    btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:100001;background:linear-gradient(135deg,#009270,#00e676);color:#fff;border:none;padding:12px 22px;border-radius:30px;font-weight:900;box-shadow:0 8px 24px rgba(0,230,118,.45);cursor:pointer;font-size:13px;font-family:inherit;';
    btn.innerText = '🏏 Return to 3D Pitch';
    btn.onclick = function(){ window.vppNavTo('pitch'); };
    document.body.appendChild(btn);
  }
  function removeReturnButton(){
    var btn = document.getElementById('vppFloatingReturn');
    if (btn) btn.remove();
  }

  /* ---------- NAVIGATE (called by parent toolbar OR by iframe) ---------- */
  window.vppNavTo = function(pane){
    var vppEl = document.getElementById('vpp');
    var dashEl = document.getElementById('view-dashboard');
    var homeEl = document.getElementById('view-home');

    if (pane === 'pitch') {
      if (vppEl) vppEl.style.display = 'block';
      if (dashEl) dashEl.style.display = 'none';
      if (homeEl) homeEl.style.display = 'none';
      showPitchUI();
      removeReturnButton();

      if (!document.getElementById('vppIframe')) {
        var iframe = document.createElement('iframe');
        iframe.id = 'vppIframe';
        iframe.src = 'viewer.html';
        iframe.setAttribute('allow', 'fullscreen; autoplay');
        iframe.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:none; z-index:1;';
        if (vppEl) vppEl.appendChild(iframe);
      }
    } else {
      if (vppEl) vppEl.style.display = 'none';
      if (homeEl) homeEl.style.display = 'none';
      if (dashEl) dashEl.style.display = 'block';

      hidePitchUI();

      var tb = document.querySelector('.top-bar'); if (tb) tb.style.display = 'none';
      var bn = document.querySelector('.bottom-match-nav'); if (bn) bn.style.display = 'none';

      if (typeof selectSubPane === 'function'){
        try { selectSubPane(pane); } catch(e){ console.warn('selectSubPane error:', e); }
      }
      var paneEl = document.getElementById('pane-' + pane);
      if (paneEl){
        document.querySelectorAll('.sub-pane').forEach(function(p){ p.classList.remove('active'); });
        paneEl.classList.add('active');
      }
      try {
        if (pane === 'scorecard'    && typeof renderScorecard     === 'function') renderScorecard();
        if (pane === 'analytics'    && typeof renderNzcAnalytics  === 'function') renderNzcAnalytics();
        if (pane === 'leaderboards' && typeof renderStatsCategory === 'function') renderStatsCategory('mvp');
        if (pane === 'summary'      && typeof renderSummary       === 'function') renderSummary();
        if (pane === 'live'         && typeof renderLive          === 'function') renderLive();
      } catch(e){ console.warn('pane render error:', e); }

      ensureReturnButton();
    }
  };

  /* ---------- MESSAGES FROM IFRAME ---------- */
  window.addEventListener('message', function(ev){
    var d = ev.data || {};
    // Iframe menu asked parent to switch pane
    if (d.type === 'CM_NAV_TO' && d.pane){
      window.vppNavTo(d.pane);
    }
  });

  /* ---------- LAUNCH 3D PITCH ---------- */
  window.vppStart = function(){
    var el = document.getElementById('vpp');
    if (el){ el.style.display = 'block'; el.classList.add('on'); }

    var tb = document.querySelector('.top-bar'); if (tb) tb.style.display = 'none';
    var bn = document.querySelector('.bottom-match-nav'); if (bn) bn.style.display = 'none';
    var h  = document.getElementById('view-home'); if (h) h.style.display = 'none';
    var d  = document.getElementById('view-dashboard'); if (d) d.style.display = 'none';

    showPitchUI();

    if (!document.getElementById('vppIframe')){
      var iframe = document.createElement('iframe');
      iframe.id = 'vppIframe';
      iframe.src = 'viewer.html';
      iframe.setAttribute('allow', 'fullscreen; autoplay');
      iframe.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:none; z-index:1; pointer-events:auto;';
      if (el) el.appendChild(iframe);
    }
  };

  /* ---------- LEGACY ALIAS ---------- */
  window.vppShowPane = function(pane){ window.vppNavTo(pane); };

  /* ---------- BUTTON HANDLERS (parent toolbar — kept for backward compat) ---------- */
  window.vppToggleSound = function(){
    var iframe = document.getElementById('vppIframe');
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'toggleSound' }, '*');
    var b = document.getElementById('vppSndBtn');
    if (b) b.innerText = (b.innerText === '🔊') ? '🔇' : '🔊';
    try { if (typeof toggleCommentaryVoice === 'function') toggleCommentaryVoice(); } catch(e){}
  };
  window.vppReplay = function(){
    var iframe = document.getElementById('vppIframe');
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'replay' }, '*');
    try { if (typeof triggerReplay === 'function') triggerReplay(); } catch(e){}
  };
  window.vppFullscreen = function(){
    var el = document.getElementById('vpp');
    if (!document.fullscreenElement){
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  };

  /* ---------- GLOBAL MATCH EXPOSER ---------- */
  setInterval(function(){
    try { if (typeof match !== 'undefined' && match !== null) window.match = match; } catch(e){}
    try { if (typeof isViewerMode !== 'undefined') window.isViewerMode = isViewerMode; } catch(e){}
  }, 500);
  setTimeout(function(){
    try { if (typeof match !== 'undefined') window.match = match; } catch(e){}
  }, 100);

  console.log('✅ Viewer bridge loaded');
})();
