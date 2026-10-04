/* ============================================================
    render.js — Live pane, commentary, scorecard, TV mode,
                theme/sky toggles, wagon wheel, clickable names
    ✅ Self-healing: normalizeMatch() runs at every render entry
    ✅ Safe array access for remote state
    ✅ OFF (left) / LEG (right) labels on scoring wagon wheel
    ✅ Canvas-standard angle convention: atan2(dy, dx)
       0 = right (leg square)   π/2 = down (straight)
       π = left (off square)    -π/2 = up (behind batsman)
    ============================================================ */

/* ═══════════════════════════════════════════════════════════
   PLAYER LINK HELPER — clickable names everywhere
   ═══════════════════════════════════════════════════════════ */
function _playerLink(name) {
  if (!name) return '';
  var safe = escapeHtml(name).replace(/'/g, "\\'");
  return '<span class="player-link" onclick="openPlayerCareerModal(\'' + safe + '\')" ' +
         'style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">' +
         escapeHtml(name) + '</span>';
}

function renderCommentary() {
  var c = document.getElementById('commentaryContainer');
  if (!c) return;

  /* ⚡ Self-heal */
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  var arr = Array.isArray(match.commentary) ? match.commentary : [];
  if (arr.length === 0) {
    c.innerHTML = '<div class="empty-comm">No deliveries yet.</div>';
    return;
  }

  var html = arr.slice(0, 40).map(function (comm, idx) {
    if (!comm) return '';
    if (comm.type === 'summary') {
      return '<div class="comm-item comm-summary' + (idx === 0 ? ' newest' : '') + '">' +
        '<span class="comm-summary-icon">📊</span><div class="comm-summary-text">' + comm.desc + '</div></div>';
    }
    var tc = comm.type === 'w' ? 'w' : (comm.type === 'four' ? 'four' : (comm.type === 'six' ? 'six' : ''));
    return '<div class="comm-item' + (idx === 0 ? ' newest' : '') + '">' +
      '<div class="comm-ball ' + tc + '">' + comm.ball + '</div>' +
      '<div class="comm-body"><div class="comm-over">Over ' + comm.ball + '</div>' +
      '<div class="comm-text">' + comm.desc + '</div></div></div>';
  }).join('');
  c.innerHTML = html;
}

function renderSummary() {
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  var cp = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  var st = match.batters[match.striker] || { runs: 0, balls: 0 };
  var nst = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  var pr = document.getElementById('partRuns');
  var pd = document.getElementById('partDetails');
  var fw = document.getElementById('fowContainer');

  if (pr) pr.innerText = (cp.runs || 0) + ' runs (' + (cp.balls || 0) + ' balls)';
  if (pd) pd.innerHTML = _playerLink(match.striker) + ': ' + st.runs + ' (' + st.balls + ') | ' +
                         _playerLink(match.nonStriker) + ': ' + nst.runs + ' (' + nst.balls + ')';

  if (fw) {
    var _fowSafe = Array.isArray(match.fow) ? match.fow : [];
    fw.innerHTML = _fowSafe.length > 0
      ? _fowSafe.map(function (f) {
          var m = String(f).match(/^(.*?)\((.+?)\)\s*$/);
          if (m) return escapeHtml(m[1]) + '(' + _playerLink(m[2]) + ')';
          return escapeHtml(f);
        }).join('<br>')
      : 'No wickets yet.';
  }
}

function renderScorecard() {
  try {
    if (typeof normalizeMatch === 'function') normalizeMatch(match);

    var bt = document.getElementById('battingTeamTitle');
    if (bt) bt.innerText = 'Batting — ' + (match.teamBatting || '');
    var bwt = document.getElementById('bowlingTeamTitle');
    if (bwt) bwt.innerText = 'Bowling — ' + (match.teamBowling || '');

    var bb = document.getElementById('battingTableBody');
    if (bb) {
      var battingRows = [];
      for (var n in match.batters) {
        var b = match.batters[n];
        if (b.status && b.status !== 'dnb') {
          var sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
          battingRows.push('<tr>' +
            '<td><b>' + _playerLink(n) + (n === match.striker ? ' *' : '') + '</b><br><small style="color:var(--muted);">' + escapeHtml(b.status) + '</small></td>' +
            '<td class="text-right"><b>' + b.runs + '</b></td>' +
            '<td class="text-right">' + b.balls + '</td>' +
            '<td class="text-right">' + b.fours + '</td>' +
            '<td class="text-right">' + b.sixes + '</td>' +
            '<td class="text-right">' + sr + '</td>' +
            '</tr>');
        }
      }
      bb.innerHTML = battingRows.join('');
    }

    var bl = document.getElementById('bowlingTableBody');
    if (bl) {
      var bowlingRows = [];
      for (var n2 in match.bowlers) {
        var b2 = match.bowlers[n2];
        if (b2.balls > 0 || n2 === match.currentBowler) {
          var ov = Math.floor(b2.balls / 6) + '.' + (b2.balls % 6);
          var eco = b2.balls > 0 ? (b2.runs / (b2.balls / 6)).toFixed(2) : '0.0';
          bowlingRows.push('<tr>' +
            '<td><b>' + _playerLink(n2) + (n2 === match.currentBowler ? ' *' : '') + '</b></td>' +
            '<td class="text-right">' + ov + '</td>' +
            '<td class="text-right">' + b2.maidens + '</td>' +
            '<td class="text-right">' + b2.runs + '</td>' +
            '<td class="text-right"><b>' + b2.wickets + '</b></td>' +
            '<td class="text-right">' + eco + '</td>' +
            '</tr>');
        }
      }
      bl.innerHTML = bowlingRows.join('');
    }
  } catch (e) {
    console.warn('renderScorecard error:', e);
  }
}

/* The rest of the file remains unchanged below this point. */
