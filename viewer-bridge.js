/* ============================================================
   CricMax Pro — Viewer Bridge
   Handles: 3D viewer iframe loading, sound/replay/fullscreen,
   window.match sync for the 3D viewer, and the wicket-striker
   auto-replacement watchdog.
   ============================================================ */

(function(){
  'use strict';

  // ==========================================
  // 1. LAUNCH THE 3D VIEWER IFRAME
  // ==========================================
  window.vppStart = function(){
    var el = document.getElementById('vpp');
    if(!el) return;
    el.classList.add('on');
    el.style.display = 'block';

    // Hide main app UI when viewer is on
    var tb = document.querySelector('.top-bar'); if(tb) tb.style.display = 'none';
    var bn = document.querySelector('.bottom-match-nav'); if(bn) bn.style.display = 'none';
    var h  = document.getElementById('view-home'); if(h) h.style.display = 'none';
    var d  = document.getElementById('view-dashboard'); if(d) d.style.display = 'none';

    // Inject iframe only once
    if (!document.getElementById('vppIframe')) {
      var iframe = document.createElement('iframe');
      iframe.id = 'vppIframe';
      iframe.src = 'viewer.html';
      iframe.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:none; z-index:1; pointer-events:auto;';
      el.appendChild(iframe);
    }
  };

  // ==========================================
  // 2. VIEWER CONTROL BUTTONS
  // ==========================================
  window.vppToggleSound = function(){
    var iframe = document.getElementById('vppIframe');
    if(iframe && iframe.contentWindow){
      try { iframe.contentWindow.postMessage({type:'toggleSound'}, '*'); } catch(e){}
    }
    var b = document.getElementById('vppSnd');
    if(b) b.innerText = (b.innerText === '🔊') ? '🔇' : '🔊';
  };

  window.vppReplay = function(){
    var iframe = document.getElementById('vppIframe');
    if(iframe && iframe.contentWindow){
      try { iframe.contentWindow.postMessage({type:'replay'}, '*'); } catch(e){}
    }
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

  // Placeholder — real logic lives in viewer.html
  window.vppSetView = function(){};
  window.vppShowInningsBreak = function(){};

  // ==========================================
  // 3. EXPOSE MATCH STATE TO THE 3D VIEWER
  // ==========================================
  setInterval(function(){
    try { if (typeof match !== 'undefined' && match !== null) window.match = match; } catch(e){}
  }, 500);

  setTimeout(function(){
    try { if (typeof match !== 'undefined') window.match = match; } catch(e){}
  }, 100);

  // ==========================================
  // 4. WICKET STRIKER FIX
  //    Ensures the newly-typed/selected batsman really
  //    becomes the striker after a wicket.
  // ==========================================
  var _origConfirm = window.confirmWicketDelivery;
  window.confirmWicketDelivery = function(){
    try {
      var typed = (document.getElementById('wktNewBatsmanInput') || {}).value || '';
      typed = typed.trim();
      var selected = (document.getElementById('wktNewBatsmanSelect') || {}).value || '';
      window.__pendingStriker = typed || selected || null;
    } catch(e){}
    if(_origConfirm) _origConfirm();
  };

  setInterval(function(){
    try {
      if(!window.match || !window.match.isActive) return;
      var m = window.match;
      var stStatus = (m.batters[m.striker] || {}).status || '';
      var isOut = stStatus &&
                  stStatus !== 'batting' &&
                  stStatus !== 'dnb' &&
                  stStatus !== 'not out' &&
                  stStatus !== 'retired not out' &&
                  stStatus !== 'retired hurt';
      if(!isOut) return;

      // Don't interfere while user is choosing a new batter
      var wkt = document.getElementById('wicketTypeModal');
      if(wkt && wkt.style.display === 'flex') return;

      var replacement = window.__pendingStriker;
      window.__pendingStriker = null;

      // Fallback: auto-pick first dnb player if none was specified
      if(!replacement){
        for(var k in m.batters){
          if(k !== m.nonStriker && k !== m.striker && m.batters[k].status === 'dnb'){
            replacement = k;
            break;
          }
        }
        if(!replacement && typeof savedTeams !== 'undefined'){
          try {
            var team = savedTeams.find(function(t){ return t.name === m.teamBatting; });
            if(team && team.squad){
              for(var i=0;i<team.squad.length;i++){
                var p = team.squad[i];
                if(p !== m.nonStriker && p !== m.striker && (!m.batters[p] || m.batters[p].status === 'dnb')){
                  replacement = p;
                  break;
                }
              }
            }
          } catch(e){}
        }
      }

      if(replacement){
        if(!m.batters[replacement]){
          m.batters[replacement] = {runs:0,balls:0,fours:0,sixes:0,dots:0,fifties:0,hundreds:0,status:'batting'};
          m.playerTeamMap[replacement] = m.teamBattingAbbr;
          try {
            var team2 = savedTeams.find(function(t){ return t.name === m.teamBatting; });
            if(team2 && team2.squad && team2.squad.indexOf(replacement) === -1) team2.squad.push(replacement);
          } catch(e){}
        } else {
          m.batters[replacement].status = 'batting';
        }
        m.striker = replacement;
        m.currentPartnership = {runs:0, balls:0, batters:[replacement, m.nonStriker]};
        window.match = m;

        if(typeof renderLive === 'function') renderLive();
        if(typeof renderCommentary === 'function') renderCommentary();
        if(typeof renderScorecard === 'function') renderScorecard();
        if(typeof autoPersist === 'function') autoPersist();

        console.log('✅ Auto-replaced out striker with:', replacement);
      }
    } catch(e) { console.warn('Striker fix error:', e); }
  }, 700);

  console.log('✅ Viewer bridge loaded');
})();
