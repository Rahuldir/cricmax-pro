/* stats-bridge.js — main Stats tab reads imported matches, clickable names, all pills supported */
(function(){
  'use strict';

  /* ──────────────────────────────────────────────
     Gather every known match: Firebase cache +
     local ledger
     ────────────────────────────────────────────── */
  function getAllMatches(){
    var out = [], seen = {};
    try {
      var raw = localStorage.getItem('CricMax_Data');
      if (raw){
        var d = JSON.parse(raw);
        var list = (d.currentTourn && d.currentTourn.pastMatches) || d.pastMatchesLedger || d.pastMatches || [];
        list.forEach(function(m){
          var k = (m.fixture || '') + (m.date || '');
          if (!seen[k]){ seen[k] = 1; out.push(m); }
        });
      }
    } catch(e){}

    var imp = window.__importedMatches || {};
    if (!Object.keys(imp).length){
      try { var r = localStorage.getItem('cricmax_importedMatches'); if (r) imp = JSON.parse(r); } catch(e){}
    }
    Object.keys(imp).forEach(function(id){
      var m = imp[id]; if (!m) return;
      var k = (m.fixture || '') + (m.date || '');
      if (!seen[k]){ seen[k] = 1; out.push(m); }
    });
    return out;
  }

  /* ──────────────────────────────────────────────
     Build a full player pool with bat/bowl/field stats
     ────────────────────────────────────────────── */
  function buildPlayerPool(){
    var matches = getAllMatches();
    var players = {};
    function ensure(n){
      if (!n) return null;
      if (!players[n]) players[n] = {
        name: n, teams: {}, matchesSet: {},
        runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, innings: 0,
        fifties: 0, hundreds: 0, hs: 0, dismissals: 0, notOuts: 0,
        bowlBalls: 0, bowlRuns: 0, wkts: 0, maidens: 0, bowlInnings: 0,
        bestWkts: 0, bestRuns: 9999,
        catches: 0, stumpings: 0, runOuts: 0
      };
      return players[n];
    }
    function isOutStatus(s){
      s = String(s || '').toLowerCase();
      return s && s !== 'dnb' && s.indexOf('not out') === -1 && s.indexOf('retired') === -1;
    }

    matches.forEach(function(m){
      var appeared = {};
      [1,2].forEach(function(n){
        var inn = m['innings' + n]; if (!inn) return;
        var teamName = inn.team || '';
        Object.keys(inn.batters || {}).forEach(function(name){
          var b = inn.batters[name]; var p = ensure(name); if (!p) return;
          appeared[name] = true;
          if (teamName) p.teams[teamName] = true;
          p.runs += b.runs || 0; p.balls += b.balls || 0;
          p.fours += b.fours || 0; p.sixes += b.sixes || 0; p.dots += b.dots || 0;
          p.innings++;
          if ((b.runs || 0) > p.hs) p.hs = b.runs;
          if (b.runs >= 100) p.hundreds++;
          else if (b.runs >= 50) p.fifties++;
          var s = String(b.status || '').toLowerCase();
          if (s && s !== 'dnb'){ if (isOutStatus(s)) p.dismissals++; else p.notOuts++; }
        });
        Object.keys(inn.bowlers || {}).forEach(function(name){
          var b = inn.bowlers[name]; var p = ensure(name); if (!p) return;
          appeared[name] = true;
          if (teamName) p.teams[teamName] = true;
          var w = b.wickets || 0, r = b.runs || 0;
          p.bowlBalls += b.balls || 0; p.bowlRuns += r;
          p.wkts += w; p.maidens += b.maidens || 0;
          p.bowlInnings++;
          if (w > p.bestWkts || (w === p.bestWkts && r < p.bestRuns)){
            p.bestWkts = w; p.bestRuns = r;
          }
        });
        Object.keys(inn.fielding || {}).forEach(function(name){
          var f = inn.fielding[name]; var p = ensure(name); if (!p) return;
          appeared[name] = true;
          p.catches += f.catches || 0;
          p.stumpings += f.stumpings || 0;
          p.runOuts += f.runOuts || 0;
        });
      });
      Object.keys(appeared).forEach(function(n){
        if (players[n]) players[n].matchesSet[m.id || m.fixture || (Math.random()+'')] = true;
      });
    });
    return Object.keys(players).map(function(k){ return players[k]; });
  }

  /* ──────────────────────────────────────────────
     Clickable name cell — routes to career popup
     Team tag removed per request.
     ────────────────────────────────────────────── */
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function nameCell(name, team){
    var safe = esc(name).replace(/'/g, "\\'");
    return '<td>'
      + '<span class="td-nm" onclick="window.openMlibPlayer(\'' + safe + '\')">'
      + esc(name)
      + '</span>'
      + '</td>';
  }
  function fmtOvers(balls){
    balls = balls || 0;
    return Math.floor(balls/6) + '.' + (balls%6);
  }

  /* ──────────────────────────────────────────────
     Renderer — respects every stat-pill category
     ────────────────────────────────────────────── */
  var currentCat = 'mvp';

  function render(cat){
    cat = cat || currentCat;
    currentCat = cat;

    var pool = buildPlayerPool();
    var head = document.getElementById('statsTableHead');
    var body = document.getElementById('statsTableBody');
    if (!head || !body) return;

    if (!pool.length){
      head.innerHTML = '<tr><th>Player</th><th style="text-align:center">No stats yet</th></tr>';
      body.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:24px;">Import a match to see stats.</td></tr>';
      return;
    }

    function m(p){ return Object.keys(p.matchesSet).length; }
    function avg(p){ return p.dismissals ? (p.runs / p.dismissals).toFixed(1) : (p.runs > 0 ? p.runs + '*' : '0.0'); }
    function sr(p){ return p.balls ? (p.runs / p.balls * 100).toFixed(1) : '0.0'; }
    function eco(p){ return p.bowlBalls ? (p.bowlRuns / (p.bowlBalls/6)).toFixed(2) : '—'; }
    function bAvg(p){ return p.wkts ? (p.bowlRuns / p.wkts).toFixed(1) : '—'; }
    function best(p){ return p.bestWkts > 0 ? (p.bestWkts + '/' + p.bestRuns) : '—'; }
    function rank(i){ return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1); }
    function team(p){ return Object.keys(p.teams)[0] || ''; }

    if (cat === 'mvp'){
      head.innerHTML = '<tr><th>#</th><th>Player</th><th class="text-right">MVP</th><th class="text-right">R</th><th class="text-right">W</th><th class="text-right">Ct</th></tr>';
      pool.forEach(function(p){
        p.mvp = Math.round(p.runs + p.fours*1.5 + p.sixes*2.5 + p.wkts*25 + p.catches*10 + p.stumpings*12 - p.bowlRuns*0.4);
      });
      pool.sort(function(a,b){ return b.mvp - a.mvp; });
      body.innerHTML = pool.slice(0,30).map(function(p,i){
        return '<tr><td class="rank">' + rank(i) + '</td>'
          + nameCell(p.name, team(p))
          + '<td class="text-right" style="color:var(--gold);font-weight:900;">' + p.mvp + '</td>'
          + '<td class="text-right">' + p.runs + '</td>'
          + '<td class="text-right">' + p.wkts + '</td>'
          + '<td class="text-right">' + p.catches + '</td></tr>';
      }).join('');
    }
    else if (cat === 'runs'){
      head.innerHTML = '<tr><th>#</th><th>Player</th><th class="text-right">Runs</th><th class="text-right">Balls</th><th class="text-right">4s</th><th class="text-right">6s</th><th class="text-right">SR</th><th class="text-right">HS</th></tr>';
      pool.sort(function(a,b){ return b.runs - a.runs || b.balls - a.balls; });
      body.innerHTML = pool.slice(0,30).map(function(p,i){
        return '<tr><td class="rank">' + rank(i) + '</td>'
          + nameCell(p.name, team(p))
          + '<td class="text-right" style="color:var(--green);font-weight:900;">' + p.runs + '</td>'
          + '<td class="text-right">' + p.balls + '</td>'
          + '<td class="text-right">' + p.fours + '</td>'
          + '<td class="text-right">' + p.sixes + '</td>'
          + '<td class="text-right">' + sr(p) + '</td>'
          + '<td class="text-right" style="color:var(--gold);font-weight:900;">' + p.hs + '</td></tr>';
      }).join('');
    }
    else if (cat === 'wickets'){
      head.innerHTML = '<tr><th>#</th><th>Player</th><th class="text-right">Wkts</th><th class="text-right">Overs</th><th class="text-right">Runs</th><th class="text-right">Best</th><th class="text-right">Eco</th></tr>';
      var bl = pool.filter(function(p){ return p.bowlBalls > 0; });
      bl.sort(function(a,b){ return b.wkts - a.wkts || (a.bowlRuns/(a.bowlBalls/6)) - (b.bowlRuns/(b.bowlBalls/6)); });
      body.innerHTML = bl.slice(0,30).map(function(p,i){
        return '<tr><td class="rank">' + rank(i) + '</td>'
          + nameCell(p.name, team(p))
          + '<td class="text-right" style="color:var(--red);font-weight:900;">' + p.wkts + '</td>'
          + '<td class="text-right">' + fmtOvers(p.bowlBalls) + '</td>'
          + '<td class="text-right">' + p.bowlRuns + '</td>'
          + '<td class="text-right" style="color:var(--violet);">' + best(p) + '</td>'
          + '<td class="text-right">' + eco(p) + '</td></tr>';
      }).join('');
    }
    else if (cat === 'fours'){
      head.innerHTML = '<tr><th>#</th><th>Player</th><th class="text-right">4s</th><th class="text-right">Runs</th><th class="text-right">Balls</th></tr>';
      pool.sort(function(a,b){ return b.fours - a.fours || b.runs - a.runs; });
      body.innerHTML = pool.slice(0,30).map(function(p,i){
        return '<tr><td class="rank">' + rank(i) + '</td>'
          + nameCell(p.name, team(p))
          + '<td class="text-right" style="color:var(--cyan);font-weight:900;">' + p.fours + '</td>'
          + '<td class="text-right">' + p.runs + '</td>'
          + '<td class="text-right">' + p.balls + '</td></tr>';
      }).join('');
    }
    else if (cat === 'sixes'){
      head.innerHTML = '<tr><th>#</th><th>Player</th><th class="text-right">6s</th><th class="text-right">Runs</th><th class="text-right">Balls</th></tr>';
      pool.sort(function(a,b){ return b.sixes - a.sixes || b.runs - a.runs; });
      body.innerHTML = pool.slice(0,30).map(function(p,i){
        return '<tr><td class="rank">' + rank(i) + '</td>'
          + nameCell(p.name, team(p))
          + '<td class="text-right" style="color:var(--orange);font-weight:900;">' + p.sixes + '</td>'
          + '<td class="text-right">' + p.runs + '</td>'
          + '<td class="text-right">' + p.balls + '</td></tr>';
      }).join('');
    }
    else if (cat === 'batting'){
      head.innerHTML = '<tr><th>Player</th><th class="text-right">M</th><th class="text-right">Inn</th><th class="text-right">R</th><th class="text-right">B</th><th class="text-right">4s</th><th class="text-right">6s</th><th class="text-right">50s</th><th class="text-right">100s</th><th class="text-right">HS</th><th class="text-right">Avg</th><th class="text-right">SR</th></tr>';
      pool.sort(function(a,b){ return b.runs - a.runs; });
      body.innerHTML = pool.map(function(p){
        return '<tr>'
          + nameCell(p.name, team(p))
          + '<td class="text-right">' + m(p) + '</td>'
          + '<td class="text-right">' + p.innings + '</td>'
          + '<td class="text-right" style="color:var(--green);font-weight:900;">' + p.runs + '</td>'
          + '<td class="text-right">' + p.balls + '</td>'
          + '<td class="text-right">' + p.fours + '</td>'
          + '<td class="text-right">' + p.sixes + '</td>'
          + '<td class="text-right">' + p.fifties + '</td>'
          + '<td class="text-right">' + p.hundreds + '</td>'
          + '<td class="text-right" style="color:var(--gold);">' + p.hs + '</td>'
          + '<td class="text-right">' + avg(p) + '</td>'
          + '<td class="text-right">' + sr(p) + '</td></tr>';
      }).join('');
    }
    else if (cat === 'bowling'){
      head.innerHTML = '<tr><th>Player</th><th class="text-right">M</th><th class="text-right">Inn</th><th class="text-right">Wkts</th><th class="text-right">O</th><th class="text-right">R</th><th class="text-right">Best</th><th class="text-right">Avg</th><th class="text-right">Eco</th></tr>';
      var bw = pool.filter(function(p){ return p.bowlBalls > 0; });
      bw.sort(function(a,b){ return b.wkts - a.wkts || (a.bowlRuns/(a.bowlBalls/6)) - (b.bowlRuns/(b.bowlBalls/6)); });
      body.innerHTML = bw.map(function(p){
        return '<tr>'
          + nameCell(p.name, team(p))
          + '<td class="text-right">' + m(p) + '</td>'
          + '<td class="text-right">' + p.bowlInnings + '</td>'
          + '<td class="text-right" style="color:var(--red);font-weight:900;">' + p.wkts + '</td>'
          + '<td class="text-right">' + fmtOvers(p.bowlBalls) + '</td>'
          + '<td class="text-right">' + p.bowlRuns + '</td>'
          + '<td class="text-right" style="color:var(--violet);">' + best(p) + '</td>'
          + '<td class="text-right">' + bAvg(p) + '</td>'
          + '<td class="text-right">' + eco(p) + '</td></tr>';
      }).join('');
    }
    else if (cat === 'fielding'){
      head.innerHTML = '<tr><th>Player</th><th class="text-right">Ct</th><th class="text-right">St</th><th class="text-right">RO</th><th class="text-right">Total</th></tr>';
      var fl = pool.filter(function(p){ return (p.catches + p.stumpings + p.runOuts) > 0; });
      fl.sort(function(a,b){ return (b.catches + b.stumpings + b.runOuts) - (a.catches + a.stumpings + a.runOuts); });
      body.innerHTML = fl.map(function(p){
        var tot = p.catches + p.stumpings + p.runOuts;
        return '<tr>'
          + nameCell(p.name, team(p))
          + '<td class="text-right">' + p.catches + '</td>'
          + '<td class="text-right">' + p.stumpings + '</td>'
          + '<td class="text-right">' + p.runOuts + '</td>'
          + '<td class="text-right" style="color:var(--gold);font-weight:900;">' + tot + '</td></tr>';
      }).join('');
    }
  }

  /* ──────────────────────────────────────────────
     Intercept renderStatsCategory — the pill buttons
     ────────────────────────────────────────────── */
  var __origRender = window.renderStatsCategory;
  window.renderStatsCategory = function(cat, btnEl){
    if (btnEl){
      document.querySelectorAll('.stat-pill').forEach(function(p){ p.classList.remove('active'); });
      btnEl.classList.add('active');
    }
    var __inEmbed = false;
    try {
      var __p = new URLSearchParams(location.search);
      __inEmbed = (__p.get('embed') === '1' || __p.get('viewer') === '1' || window.self !== window.top);
    } catch(e){}
    if (__inEmbed && typeof __origRender === 'function'){
      return __origRender.call(this, cat, btnEl);
    }
    render(cat);
  };

  /* Intercept setStatsScope */
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
      render('batting');
    }
  };

  function boot(){
    if (document.querySelector('#pane-leaderboards.active') || document.querySelector('#statsTableBody')){
      render(currentCat);
    }
  }
  window.addEventListener('load', function(){ setTimeout(boot, 900); setTimeout(boot, 2500); });

  (function wrapSelect(){
    if (typeof window.selectSubPane !== 'function'){ setTimeout(wrapSelect, 200); return; }
    if (window.selectSubPane.__statsBridge) return;
    var orig = window.selectSubPane;
    window.selectSubPane = function(name){
      var r = orig.apply(this, arguments);
      if (name === 'leaderboards') setTimeout(function(){ render(currentCat); }, 60);
      return r;
    };
    window.selectSubPane.__statsBridge = true;
  })();

  console.log('[StatsBridge] ✅ loaded — all pills wired, names clickable, team tag removed');
})();
