/* points-table.js — Team standings for the selected tournament */
(function(){
  'use strict';

  function ovStr(b){ b=b||0; return Math.floor(b/6)+'.'+(b%6); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function getImported(){
    var all = window.__importedMatches || {};
    if (!Object.keys(all).length){
      try { var r = localStorage.getItem('cricmax_importedMatches'); if(r) all = JSON.parse(r); } catch(e){}
    }
    return all;
  }

  function computePoints(matches){
    var teams = {};
    function ensure(n){
      if(!n) return null;
      if(!teams[n]) teams[n] = {
        name:n, played:0, won:0, lost:0, tied:0, nr:0, pts:0,
        rf:0, bf:0, ra:0, ba:0
      };
      return teams[n];
    }
    matches.forEach(function(m){
      var i1 = m.innings1||{}, i2 = m.innings2||{};
      var t1 = i1.team, t2 = i2.team;
      if(!t1 || !t2) return;
      var r1 = i1.runs||0, r2 = i2.runs||0;
      var b1 = i1.balls||0, b2 = i2.balls||0;
      var A = ensure(t1), B = ensure(t2);
      A.played++; B.played++;
      A.rf += r1; A.bf += b1; A.ra += r2; A.ba += b2;
      B.rf += r2; B.bf += b2; B.ra += r1; B.ba += b1;
      if (r1 > r2){ A.won++; A.pts += 2; B.lost++; }
      else if (r2 > r1){ B.won++; B.pts += 2; A.lost++; }
      else { A.tied++; B.tied++; A.pts += 1; B.pts += 1; }
    });
    var list = Object.keys(teams).map(function(k){ return teams[k]; });
    list.forEach(function(t){
      var a = t.bf ? t.rf / t.bf : 0;
      var b = t.ba ? t.ra / t.ba : 0;
      t.nrr = a - b;
    });
    list.sort(function(a,b){ return b.pts - a.pts || b.nrr - a.nrr; });
    return list;
  }

  function renderPoints(){
    var detail = document.getElementById('tdTournDetail');
    if (!detail || detail.style.display === 'none') return;

    /* Ensure the points container exists, right above the Matches list */
    var mount = document.getElementById('tdPointsTable');
    if (!mount){
      var matchesPane = document.getElementById('tdPane-matches');
      if (!matchesPane) return;
      mount = document.createElement('div');
      mount.id = 'tdPointsTable';
      matchesPane.insertBefore(mount, matchesPane.firstChild);
    }

    /* Find selected tournament */
    var selectedName = window.__tdSelectedTourn;
    var all = getImported();
    var matches = [];

    if (selectedName){
      /* Filter matches belonging to this tournament */
      Object.keys(all).forEach(function(id){
        var m = all[id];
        var t = m.tournament || 'Ravi Cup 2026';
        if (t === selectedName) matches.push(m);
      });
    } else {
      matches = Object.keys(all).map(function(k){ return all[k]; });
    }

    if (!matches.length){
      mount.innerHTML = '<div style="padding:16px;text-align:center;font-family:var(--td-mono);font-size:10px;letter-spacing:1.6px;color:#7a8590;text-transform:uppercase;background:rgba(0,0,0,.4);border:1px dashed var(--td-line2);margin-bottom:12px;">No completed matches in this tournament yet</div>';
      return;
    }

    var rows = computePoints(matches);

    var html = '';
    html += '<div class="td-sec gold" style="margin-top:0"><span class="bar"></span>🏆 Points Table · '+esc(selectedName||'All Matches')+'</div>';
    html += '<div class="td-tbl-wrap"><table class="td-tbl"><thead><tr>'+
      '<th style="width:26px"></th><th>Team</th>'+
      '<th class="r">P</th><th class="r">W</th><th class="r">L</th>'+
      '<th class="r">T</th><th class="r">NRR</th><th class="r">Pts</th>'+
    '</tr></thead><tbody>';

    rows.forEach(function(t, i){
      var pcls = i===0?'p1':(i===1?'p2':(i===2?'p3':''));
      var nrr = (t.nrr >= 0 ? '+' : '') + t.nrr.toFixed(3);
      html += '<tr>'+
        '<td class="pos '+pcls+'">'+(i+1)+'</td>'+
        '<td><span style="font-weight:900;color:#fff;font-size:12.5px;">'+esc(t.name)+'</span></td>'+
        '<td class="r td-v-dim">'+t.played+'</td>'+
        '<td class="r td-v-g">'+t.won+'</td>'+
        '<td class="r td-v-r">'+t.lost+'</td>'+
        '<td class="r td-v-dim">'+t.tied+'</td>'+
        '<td class="r td-v-c">'+nrr+'</td>'+
        '<td class="r td-v-a" style="font-size:14px;font-weight:900;">'+t.pts+'</td>'+
      '</tr>';
    });

    html += '</tbody></table></div>';
    mount.innerHTML = html;
  }

  /* Re-render whenever the tournament detail is refreshed or a match is opened/closed */
  function hookAll(){
    if (!window.refreshTournamentPane || window.refreshTournamentPane.__ptsHooked) return true;
    var orig = window.refreshTournamentPane;
    window.refreshTournamentPane = function(){
      var r = orig.apply(this, arguments);
      setTimeout(renderPoints, 100);
      return r;
    };
    window.refreshTournamentPane.__ptsHooked = true;
    return true;
  }

  /* Also render after user picks a tournament card */
  function hookSelect(){
    if (!window.tdSelectTournament || window.tdSelectTournament.__ptsHooked) return true;
    var orig = window.tdSelectTournament;
    window.tdSelectTournament = function(name){
      var r = orig.apply(this, arguments);
      setTimeout(renderPoints, 200);
      return r;
    };
    window.tdSelectTournament.__ptsHooked = true;
    return true;
  }

  var tries = 0;
  var t = setInterval(function(){
    tries++;
    var a = hookAll();
    var b = hookSelect();
    if ((a && b) || tries > 40){
      clearInterval(t);
      renderPoints();
    }
  }, 250);

  window.addEventListener('load', function(){ setTimeout(renderPoints, 1200); });
  console.log('[PointsTable] ✅ loaded');
})();
