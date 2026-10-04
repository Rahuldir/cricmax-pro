/* stats-bridge.js — make main Stats tab read imported matches */
(function(){
  'use strict';
  function getAllMatches(){
    var out = [], seen = {};
    try {
      var raw = localStorage.getItem('CricMax_Data');
      if (raw){
        var d = JSON.parse(raw);
        var list = (d.currentTourn && d.currentTourn.pastMatches) || d.pastMatchesLedger || d.pastMatches || [];
        list.forEach(function(m){ var k=(m.fixture||'')+(m.date||''); if(!seen[k]){seen[k]=1; out.push(m);} });
      }
    } catch(e){}
    var imp = window.__importedMatches || {};
    if (!Object.keys(imp).length){
      try { var r = localStorage.getItem('cricmax_importedMatches'); if(r) imp = JSON.parse(r); } catch(e){}
    }
    Object.keys(imp).forEach(function(id){
      var m = imp[id]; if(!m) return;
      var k = (m.fixture||'')+(m.date||'');
      if (!seen[k]){ seen[k]=1; out.push(m); }
    });
    return out;
  }

  function renderFromImported(){
    var matches = getAllMatches();
    var players = {};
    function ensure(n){
      if(!n) return null;
      if(!players[n]) players[n]={name:n,matches:0,runs:0,balls:0,fours:0,sixes:0,
        notOuts:0,dismissals:0,fifties:0,hundreds:0,hs:0,
        wkts:0,bowlRuns:0,bowlBalls:0,maidens:0,bestWkts:0,bestRuns:9999};
      return players[n];
    }
    matches.forEach(function(m){
      var appeared = {};
      [1,2].forEach(function(n){
        var inn = m['innings'+n]; if(!inn) return;
        Object.keys(inn.batters||{}).forEach(function(name){
          var b = inn.batters[name]; var p = ensure(name);
          appeared[name] = true;
          p.runs += b.runs||0; p.balls += b.balls||0;
          p.fours += b.fours||0; p.sixes += b.sixes||0;
          var s = (b.status||'').toLowerCase();
          var isOut = s && s !== 'dnb' && s.indexOf('not out')===-1 && s.indexOf('retired')===-1;
          if (s && s !== 'dnb'){ if (isOut) p.dismissals++; else p.notOuts++; }
          if ((b.runs||0) > p.hs) p.hs = b.runs;
          if (b.runs >= 100) p.hundreds++; else if (b.runs >= 50) p.fifties++;
        });
        Object.keys(inn.bowlers||{}).forEach(function(name){
          var b = inn.bowlers[name]; var p = ensure(name);
          appeared[name] = true;
          var w = b.wickets||0, r = b.runs||0;
          p.wkts += w; p.bowlRuns += r; p.bowlBalls += b.balls||0; p.maidens += b.maidens||0;
          if (w > p.bestWkts || (w === p.bestWkts && r < p.bestRuns)){ p.bestWkts=w; p.bestRuns=r; }
        });
      });
      Object.keys(appeared).forEach(function(n){ if (players[n]) players[n].matches++; });
    });
    var list = Object.keys(players).map(function(k){ return players[k]; })
      .sort(function(a,b){ return (b.runs + b.wkts*20) - (a.runs + a.wkts*20); });
    var thead = document.getElementById('statsTableHead');
    var tbody = document.getElementById('statsTableBody');
    if (!thead || !tbody) return;
    var headers = ['Batter','M','Runs','Balls','4s','6s','SR','50s','100s','HS'];
    thead.innerHTML = '<tr>' + headers.map(function(h){ return '<th>'+h+'</th>'; }).join('') + '</tr>';
    if (!list.length){
      tbody.innerHTML = '<tr><td colspan="'+headers.length+'" style="text-align:center;padding:24px;color:var(--muted);">No matches yet.</td></tr>';
    } else {
      tbody.innerHTML = list.map(function(p){
        var sr = p.balls ? (p.runs/p.balls*100).toFixed(1) : '0.0';
        return '<tr><td style="font-weight:800;">'+p.name+'</td><td>'+p.matches+'</td>'+
          '<td style="color:var(--green);font-weight:800;">'+p.runs+'</td><td>'+p.balls+'</td>'+
          '<td>'+p.fours+'</td><td>'+p.sixes+'</td><td>'+sr+'</td>'+
          '<td>'+p.fifties+'</td><td style="color:var(--purple);font-weight:800;">'+p.hundreds+'</td>'+
          '<td style="color:var(--gold);font-weight:800;">'+p.hs+'</td></tr>';
      }).join('');
    }
  }

  /* Override stats-scope setter to render our data */
  window.setStatsScope = function(scope){
    document.querySelectorAll('.stats-scope-toggle .scope-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-scope') === scope);
    });
    if (scope === 'match'){
      var activePill = document.querySelector('.stat-pill.active');
      if (activePill && activePill.getAttribute('onclick')){
        try { eval(activePill.getAttribute('onclick')); } catch(e){}
      }
    } else {
      renderFromImported();
    }
  };

  /* Also hook the pill buttons */
  function hookPills(){
    document.querySelectorAll('.stat-pill').forEach(function(pill){
      if (pill.__bridge) return;
      var orig = pill.getAttribute('onclick') || '';
      pill.__bridge = true;
    });
  }
  window.addEventListener('load', function(){ setTimeout(hookPills, 500); });

  console.log('[StatsBridge] ✅ loaded');
})();
