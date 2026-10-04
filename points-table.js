/* points-table.js — Team standings with name normalization */
(function(){
  'use strict';

  /* ══════════════════════════════════════════════════════════
     ✏️ EDIT THIS MAP to merge team variants.
     Left  = any spelling/case (lowercase it)
     Right = canonical display name
     ══════════════════════════════════════════════════════════ */
  var TEAM_ALIASES = {
    /* Ravi / Rajesh — same team */
    'ravi 11':    'Rajesh 11',
    'ravi':       'Rajesh 11',
    'rajesh 11':  'Rajesh 11',
    'rajesh':     'Rajesh 11',
    'rajesh ii':  'Rajesh 11',
    'rajesh 2':   'Rajesh 11',

    /* Vivek variants — same team */
    'vivek 11':   'Vivek 11',
    'vivek':      'Vivek 11',
    'vivek ii':   'Vivek 11',
    'vivek 2':    'Vivek 11',
    'vivek iii':  'Vivek 11',
    'vivek 3':    'Vivek 11'
  };
  /* ══════════════════════════════════════════════════════════ */

  function normalizeTeamName(raw){
    if (!raw) return raw;
    var n = String(raw).trim().replace(/\s+/g, ' ');
    /* Roman numerals → digits */
    n = n.replace(/\bIII\b/gi,'3').replace(/\bII\b/gi,'2')
         .replace(/\bIV\b/gi,'4').replace(/\bVI\b/gi,'6')
         .replace(/\bV\b/gi,'5');
    /* "Vivek11" → "Vivek 11" */
    n = n.replace(/([A-Za-z])(\d)/g, '$1 $2');
    /* Collapse whitespace again */
    n = n.replace(/\s+/g, ' ').trim();
    /* Alias lookup (case-insensitive) */
    var key = n.toLowerCase();
    if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
    return n;
  }
  window.normalizeTeamName = normalizeTeamName;

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
      var key = normalizeTeamName(n);
      if(!key) return null;
      if(!teams[key]) teams[key] = {
        name:key, played:0, won:0, lost:0, tied:0, pts:0,
        rf:0, bf:0, ra:0, ba:0
      };
      return teams[key];
    }
    matches.forEach(function(m){
      var i1 = m.innings1||{}, i2 = m.innings2||{};
      if (!i1.team || !i2.team) return;
      var r1 = i1.runs||0, r2 = i2.runs||0;
      var b1 = i1.balls||0, b2 = i2.balls||0;
      var A = ensure(i1.team), B = ensure(i2.team);
      if (!A || !B || A === B) return;   /* skip if same team */
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

    var mount = document.getElementById('tdPointsTable');
    if (!mount){
      var matchesPane = document.getElementById('tdPane-matches');
      if (!matchesPane) return;
      mount = document.createElement('div');
      mount.id = 'tdPointsTable';
      matchesPane.insertBefore(mount, matchesPane.firstChild);
    }

    var selectedName = window.__tdSelectedTourn;
    var all = getImported();
    var allMatches = Object.keys(all).map(function(k){ return all[k]; });
    var matches = [];

    if (selectedName){
      matches = allMatches.filter(function(m){
        return (m.tournament||'') === selectedName;
      });
      if (!matches.length) matches = allMatches;
    } else {
      matches = allMatches;
    }

    if (!matches.length){
      mount.innerHTML = '<div style="padding:16px;text-align:center;font-family:var(--td-mono);font-size:10px;letter-spacing:1.6px;color:#7a8590;text-transform:uppercase;background:rgba(0,0,0,.4);border:1px dashed var(--td-line2);margin-bottom:12px;">No completed matches found</div>';
      return;
    }

    var rows = computePoints(matches);
    if (!rows.length){
      mount.innerHTML = '<div style="padding:16px;text-align:center;font-family:var(--td-mono);font-size:10px;letter-spacing:1.6px;color:#7a8590;text-transform:uppercase;background:rgba(0,0,0,.4);border:1px dashed var(--td-line2);margin-bottom:12px;">No team data</div>';
      return;
    }

    var html = '';
    var label = selectedName || 'All Matches';
    html += '<div class="td-sec gold" style="margin-top:0"><span class="bar"></span>🏆 Points Table · '+esc(label)+
      ' <small style="color:#7a8590;font-weight:600;letter-spacing:1px;">('+matches.length+' matches)</small></div>';
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
