/* ============================================================
   stats.js — Stats pool, tournament aggregation, career, leaderboards
   ============================================================ */

function buildStatsPool() {
  const pool = [];
  const allNames = new Set([...Object.keys(match.batters), ...Object.keys(match.bowlers), ...Object.keys(match.fielding)]);
  allNames.forEach(n => {
    const b = match.batters[n] || { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0 };
    const bw = match.bowlers[n] || { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    const f = match.fielding[n] || { catches: 0, stumpings: 0, runOuts: 0 };
    const sr = b.balls > 0 ? (b.runs / b.balls) * 100 : 0;
    const eco = bw.balls > 0 ? (bw.runs / (bw.balls / 6)) : 99.9;
    const bowlSR = bw.wickets > 0 ? bw.balls / bw.wickets : 0;
    const bowlAvg = bw.wickets > 0 ? bw.runs / bw.wickets : 0;
    const mvp = Math.round((b.runs * 1) + (b.fours * 1.5) + (b.sixes * 2.5) + (bw.wickets * 25) + (f.catches * 10) + (f.stumpings * 12) - (bw.runs * 0.4));
    pool.push({
      name: n, team: match.playerTeamMap[n] || '--',
      runs: b.runs || 0, balls: b.balls || 0, fours: b.fours || 0, sixes: b.sixes || 0,
      dotsFaced: b.dots || 0, fifties: b.fifties || 0, hundreds: b.hundreds || 0, sr,
      status: b.status || 'dnb',
      bowlBalls: bw.balls || 0, bowlRuns: bw.runs || 0, wickets: bw.wickets || 0,
      maidens: bw.maidens || 0, bowlDots: bw.dots || 0, eco, bowlAvg, bowlSR,
      threeW: bw.threeW || 0, fiveW: bw.fiveW || 0,
      catches: f.catches || 0, stumpings: f.stumpings || 0, runOuts: f.runOuts || 0,
      totalDismissals: (f.catches || 0) + (f.stumpings || 0) + (f.runOuts || 0),
      mvp: Math.max(0, mvp)
    });
  });
  return pool;
}

function aggregateTournamentStats() {
  const agg = {};
  const ensure = (n, team) => {
    if (!agg[n]) agg[n] = {
      name: n, team: team || '--', runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, status: '',
      bowlBalls: 0, bowlRuns: 0, wickets: 0, maidens: 0, catches: 0, stumpings: 0, runOuts: 0,
      threeW: 0, fiveW: 0, dotsFaced: 0, sr: 0, eco: 99.9, bowlAvg: 0, bowlSR: 0,
      totalDismissals: 0, mvp: 0
    };
    if (team && agg[n].team === '--') agg[n].team = team;
  };
  const mergeInnings = (inn, teamAbbr) => {
    if (!inn) return;
    for (const n in (inn.batters || {})) {
      const b = inn.batters[n];
      if (!b || !b.balls) continue;
      ensure(n, teamAbbr);
      agg[n].runs += b.runs || 0; agg[n].balls += b.balls || 0;
      agg[n].fours += b.fours || 0; agg[n].sixes += b.sixes || 0;
      agg[n].fifties += b.fifties || 0; agg[n].hundreds += b.hundreds || 0;
    }
    for (const n in (inn.bowlers || {})) {
      const bw = inn.bowlers[n];
      if (!bw || !bw.balls) continue;
      ensure(n, teamAbbr);
      agg[n].bowlBalls += bw.balls || 0; agg[n].bowlRuns += bw.runs || 0;
      agg[n].wickets += bw.wickets || 0; agg[n].maidens += bw.maidens || 0;
      agg[n].threeW += bw.threeW || 0; agg[n].fiveW += bw.fiveW || 0;
    }
    for (const n in (inn.fielding || {})) {
      const f = inn.fielding[n];
      ensure(n, teamAbbr);
      agg[n].catches += f.catches || 0;
      agg[n].stumpings += f.stumpings || 0;
      agg[n].runOuts += f.runOuts || 0;
    }
  };
  pastMatchesLedger.forEach(pm => {
    mergeInnings(pm.innings1, pm.teamA ? pm.teamA.substring(0, 3).toUpperCase() : '');
    mergeInnings(pm.innings2, pm.teamB ? pm.teamB.substring(0, 3).toUpperCase() : '');
  });
  if (match.isActive) mergeInnings({ batters: match.batters, bowlers: match.bowlers, fielding: match.fielding }, match.teamBattingAbbr);

  return Object.values(agg).map(p => {
    p.sr = p.balls > 0 ? (p.runs / p.balls) * 100 : 0;
    p.eco = p.bowlBalls > 0 ? (p.bowlRuns / (p.bowlBalls / 6)) : 99.9;
    p.bowlAvg = p.wickets > 0 ? p.bowlRuns / p.wickets : 0;
    p.bowlSR = p.wickets > 0 ? p.bowlBalls / p.wickets : 0;
    p.totalDismissals = p.catches + p.stumpings + p.runOuts;
    p.mvp = Math.round(p.runs + p.fours * 1.5 + p.sixes * 2.5 + p.wickets * 25 + p.catches * 10 + p.stumpings * 12 - p.bowlRuns * 0.4);
    return p;
  });
}

function setStatsScope(scope) {
  statsScope = scope;
  const a = document.getElementById('statsScopeAll');
  const t = document.getElementById('statsScopeTourn');
  if (a) a.classList.toggle('active', scope === 'live');
  if (t) t.classList.toggle('active', scope === 'tournament');
  renderStatsCategory(currentStatsCategory);
}

function renderStatsCategory(cat, btnEl) {
  currentStatsCategory = cat;
  if (btnEl) {
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
    btnEl.classList.add('active');
  }
  const head = document.getElementById('statsTableHead');
  const body = document.getElementById('statsTableBody');
  if (!head || !body) return;

  let pool = statsScope === 'tournament' ? aggregateTournamentStats() : buildStatsPool();

  if (pool.length === 0) {
    head.innerHTML = `<tr><th>Player</th><th>No stats available yet</th></tr>`;
    body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:20px;">Score some balls to see stats.</td></tr>`;
    return;
  }

  const link = p => `<span class="player-link" onclick="openPlayerCareerModal('${escapeHtml(p.name).replace(/'/g, "\\'")}')"><span class="player-name">${escapeHtml(p.name)}</span></span><span class="team-tag">${escapeHtml(p.team)}</span>`;
  const rank = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);

  if (cat === 'mvp') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">MVP</th><th class="text-right">R</th><th class="text-right">W</th><th class="text-right">Ct</th></tr>`;
    pool.sort((a, b) => b.mvp - a.mvp);
    body.innerHTML = pool.map((p, i) => `<tr><td class="rank">${rank(i)}</td><td>${link(p)}</td><td class="text-right"><span class="mvp-badge">${p.mvp}</span></td><td class="text-right">${p.runs}</td><td class="text-right">${p.wickets}</td><td class="text-right">${p.catches}</td></tr>`).join('');
  } else if (cat === 'runs') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">Runs</th><th class="text-right">Balls</th><th class="text-right">4s</th><th class="text-right">6s</th><th class="text-right">SR</th></tr>`;
    pool.sort((a, b) => b.runs - a.runs || b.sr - a.sr);
    body.innerHTML = pool.slice(0, 15).map((p, i) => `<tr><td class="rank">${rank(i)}</td><td>${link(p)}</td><td class="text-right"><b style="color:var(--green);">${p.runs}</b></td><td class="text-right">${p.balls}</td><td class="text-right">${p.fours}</td><td class="text-right">${p.sixes}</td><td class="text-right">${p.sr.toFixed(1)}</td></tr>`).join('');
  } else if (cat === 'wickets') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">Wkts</th><th class="text-right">Overs</th><th class="text-right">Runs</th><th class="text-right">Eco</th></tr>`;
    pool.sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
    body.innerHTML = pool.filter(p => p.bowlBalls > 0).slice(0, 15).map((p, i) => `<tr><td class="rank">${rank(i)}</td><td>${link(p)}</td><td class="text-right"><b style="color:var(--red);">${p.wickets}</b></td><td class="text-right">${Math.floor(p.bowlBalls / 6)}.${p.bowlBalls % 6}</td><td class="text-right">${p.bowlRuns}</td><td class="text-right">${p.eco.toFixed(2)}</td></tr>`).join('');
  } else if (cat === 'fours') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">4s</th><th class="text-right">Runs</th><th class="text-right">Balls</th></tr>`;
    pool.sort((a, b) => b.fours - a.fours || b.runs - a.runs);
    body.innerHTML = pool.slice(0, 15).map((p, i) => `<tr><td class="rank">${rank(i)}</td><td>${link(p)}</td><td class="text-right"><b style="color:var(--cyan);">${p.fours}</b></td><td class="text-right">${p.runs}</td><td class="text-right">${p.balls}</td></tr>`).join('');
  } else if (cat === 'sixes') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">6s</th><th class="text-right">Runs</th><th class="text-right">Balls</th></tr>`;
    pool.sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
    body.innerHTML = pool.slice(0, 15).map((p, i) => `<tr><td class="rank">${rank(i)}</td><td>${link(p)}</td><td class="text-right"><b style="color:var(--orange);">${p.sixes}</b></td><td class="text-right">${p.runs}</td><td class="text-right">${p.balls}</td></tr>`).join('');
  } else if (cat === 'batting') {
    head.innerHTML = `<tr><th>Player</th><th class="text-right">R</th><th class="text-right">B</th><th class="text-right">4s</th><th class="text-right">6s</th><th class="text-right">SR</th><th class="text-right">50s</th><th class="text-right">100s</th></tr>`;
    pool.sort((a, b) => b.runs - a.runs);
    body.innerHTML = pool.map(p => `<tr><td>${link(p)}</td><td class="text-right"><b style="color:var(--green);">${p.runs}</b></td><td class="text-right">${p.balls}</td><td class="text-right">${p.fours}</td><td class="text-right">${p.sixes}</td><td class="text-right">${p.sr.toFixed(1)}</td><td class="text-right">${p.fifties}</td><td class="text-right">${p.hundreds}</td></tr>`).join('');
  } else if (cat === 'bowling') {
    head.innerHTML = `<tr><th>Player</th><th class="text-right">O</th><th class="text-right">M</th><th class="text-right">R</th><th class="text-right">W</th><th class="text-right">Eco</th><th class="text-right">Avg</th><th class="text-right">SR</th></tr>`;
    pool.sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
    body.innerHTML = pool.filter(p => p.bowlBalls > 0).map(p => `<tr><td>${link(p)}</td><td class="text-right">${Math.floor(p.bowlBalls / 6)}.${p.bowlBalls % 6}</td><td class="text-right">${p.maidens}</td><td class="text-right">${p.bowlRuns}</td><td class="text-right"><b style="color:var(--red);">${p.wickets}</b></td><td class="text-right">${p.eco.toFixed(2)}</td><td class="text-right">${p.bowlAvg > 0 ? p.bowlAvg.toFixed(1) : '-'}</td><td class="text-right">${p.bowlSR > 0 ? p.bowlSR.toFixed(1) : '-'}</td></tr>`).join('');
  } else if (cat === 'fielding') {
    head.innerHTML = `<tr><th>Player</th><th class="text-right">Ct</th><th class="text-right">St</th><th class="text-right">RO</th><th class="text-right">Total</th></tr>`;
    pool.sort((a, b) => b.totalDismissals - a.totalDismissals);
    body.innerHTML = pool.filter(p => p.totalDismissals > 0).map(p => `<tr><td>${link(p)}</td><td class="text-right">${p.catches}</td><td class="text-right">${p.stumpings}</td><td class="text-right">${p.runOuts}</td><td class="text-right"><b style="color:var(--gold);">${p.totalDismissals}</b></td></tr>`).join('');
  }
}

function openPlayerCareerModal(playerName) {
  if (!playerName) return;
  document.getElementById('careerPlayerName').innerText = playerName;
  const teamAbbr = match.playerTeamMap[playerName] || '';
  document.getElementById('careerPlayerTeam').innerText = teamAbbr ? `Playing for ${teamAbbr} • Career` : 'Career performance';
  const career = buildPlayerCareerStats(playerName);
  document.getElementById('cMatches').innerText = career.matches;
  document.getElementById('cRuns').innerText = career.runs;
  document.getElementById('cHS').innerText = career.highScore;
  document.getElementById('cAvg').innerText = career.avg;
  document.getElementById('cSR').innerText = career.sr;
  document.getElementById('cBallsFaced').innerText = career.balls;
  document.getElementById('cFifties').innerText = career.fifties;
  document.getElementById('cHundreds').innerText = career.hundreds;
  document.getElementById('cWickets').innerText = career.wickets;
  document.getElementById('cOvers').innerText = `${Math.floor(career.bowlBalls / 6)}.${career.bowlBalls % 6}`;
  document.getElementById('cBowlRuns').innerText = career.bowlRuns;
  document.getElementById('cBest').innerText = career.bestBowl;
  document.getElementById('cEco').innerText = career.eco;
  document.getElementById('cBowlAvg').innerText = career.bowlAvg;
  document.getElementById('cBowlSR').innerText = career.bowlSR;
  document.getElementById('cMaidens').innerText = career.maidens;
  document.getElementById('cCatches').innerText = career.catches;
  document.getElementById('cStumpings').innerText = career.stumpings;
  document.getElementById('cRunOuts').innerText = career.runOuts;
  document.getElementById('cTotalDismissals').innerText = career.catches + career.stumpings + career.runOuts;

  const logBox = document.getElementById('careerMatchLog');
  if (!logBox) return;
  if (career.matchLog.length === 0) {
    logBox.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:16px;font-style:italic;">No matches played yet.</div>';
  } else {
    logBox.innerHTML = '';
    career.matchLog.forEach(m => {
      const batLine = m.batting ? `🏏 <b>${m.batting.runs}</b>(${m.batting.balls}) • ${m.batting.fours}×4 ${m.batting.sixes}×6` : '';
      const bowlLine = m.bowling ? `⚾ <b>${m.bowling.wickets}</b>/${m.bowling.runs} (${Math.floor(m.bowling.balls / 6)}.${m.bowling.balls % 6} ov)` : '';
      const fieldLine = m.fielding ? `🧤 ${m.fielding.catches}ct ${m.fielding.stumpings}st ${m.fielding.runOuts}ro` : '';
      logBox.innerHTML += `<div class="career-match-row">
        <b>${escapeHtml(m.fixture)}</b> <small style="color:var(--muted);">${escapeHtml(m.date || '')}</small>
        <div class="cmr-line" style="color:var(--cyan);font-size:10.5px;">${escapeHtml(m.result || '')}</div>
        <div class="cmr-line">${batLine} ${bowlLine} ${fieldLine}</div>
      </div>`;
    });
  }
  document.getElementById('playerCareerModal').style.display = 'flex';
}

function buildPlayerCareerStats(playerName) {
  const career = {
    matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0,
    highScore: 0, notOuts: 0, dismissals: 0, bowlBalls: 0, bowlRuns: 0,
    wickets: 0, maidens: 0, bestWkts: 0, bestRuns: Infinity, catches: 0,
    stumpings: 0, runOuts: 0, teams: new Set(), matchLog: []
  };

  function extract(batters, bowlers, fielding) {
    let batted = false, bowled = false, fielded = false;
    let bat = null, bwl = null, fld = null;
    if (batters && batters[playerName]) {
      const b = batters[playerName];
      if (b.status && b.status !== 'dnb') {
        batted = true;
        bat = { runs: b.runs || 0, balls: b.balls || 0, fours: b.fours || 0, sixes: b.sixes || 0, status: b.status };
      }
    }
    if (bowlers && bowlers[playerName] && bowlers[playerName].balls > 0) {
      bowled = true;
      const bw = bowlers[playerName];
      bwl = { balls: bw.balls, runs: bw.runs, wickets: bw.wickets, maidens: bw.maidens || 0 };
    }
    if (fielding && fielding[playerName]) {
      const f = fielding[playerName];
      if ((f.catches || 0) + (f.stumpings || 0) + (f.runOuts || 0) > 0) {
        fielded = true;
        fld = { catches: f.catches || 0, stumpings: f.stumpings || 0, runOuts: f.runOuts || 0 };
      }
    }
    return { batted, bowled, fielded, bat, bwl, fld };
  }

  function mergeMatch(list) {
    let played = false, mBatting = null, mBowling = null, mFielding = null;
    list.forEach(inn => {
      if (!inn) return;
      const res = extract(inn.batters, inn.bowlers, inn.fielding);
      if (res.batted) {
        played = true;
        career.runs += res.bat.runs; career.balls += res.bat.balls;
        career.fours += res.bat.fours; career.sixes += res.bat.sixes;
        if (res.bat.runs > career.highScore) career.highScore = res.bat.runs;
        if (res.bat.runs >= 50 && res.bat.runs < 100) career.fifties++;
        if (res.bat.runs >= 100) career.hundreds++;
        const st = (res.bat.status || '').toLowerCase();
        if (st === 'batting' || st === 'not out' || st === 'retired not out' || st === 'retired hurt') career.notOuts++;
        else if (st && st !== 'dnb') career.dismissals++;
        if (!mBatting) mBatting = { runs: 0, balls: 0, fours: 0, sixes: 0 };
        mBatting.runs += res.bat.runs; mBatting.balls += res.bat.balls;
        mBatting.fours += res.bat.fours; mBatting.sixes += res.bat.sixes;
      }
      if (res.bowled) {
        played = true;
        career.bowlBalls += res.bwl.balls; career.bowlRuns += res.bwl.runs;
        career.wickets += res.bwl.wickets; career.maidens += res.bwl.maidens;
        if (res.bwl.wickets > career.bestWkts || (res.bwl.wickets === career.bestWkts && res.bwl.runs < career.bestRuns)) {
          career.bestWkts = res.bwl.wickets; career.bestRuns = res.bwl.runs;
        }
        if (!mBowling) mBowling = { balls: 0, runs: 0, wickets: 0 };
        mBowling.balls += res.bwl.balls; mBowling.runs += res.bwl.runs; mBowling.wickets += res.bwl.wickets;
      }
      if (res.fielded) {
        played = true;
        career.catches += res.fld.catches; career.stumpings += res.fld.stumpings; career.runOuts += res.fld.runOuts;
        if (!mFielding) mFielding = { catches: 0, stumpings: 0, runOuts: 0 };
        mFielding.catches += res.fld.catches; mFielding.stumpings += res.fld.stumpings; mFielding.runOuts += res.fld.runOuts;
      }
    });
    return { played, mBatting, mBowling, mFielding };
  }

  pastMatchesLedger.forEach(pm => {
    const list = [];
    if (pm.innings1) list.push(pm.innings1);
    if (pm.innings2) list.push(pm.innings2);
    const merged = mergeMatch(list);
    if (merged.played) {
      career.matches++;
      if (pm.teamA) career.teams.add(pm.teamA);
      if (pm.teamB) career.teams.add(pm.teamB);
      career.matchLog.push({ fixture: pm.fixture, result: pm.result, date: pm.date, batting: merged.mBatting, bowling: merged.mBowling, fielding: merged.mFielding });
    }
  });

  if (match.isActive) {
    const list = [];
    if (match.innings === 2) {
      list.push({
        batters: match.innings1BattingSnapshot || {},
        bowlers: match.innings1BowlingSnapshot || {},
        fielding: match.innings1FieldingSnapshot || {}
      });
    }
    list.push({ batters: match.batters, bowlers: match.bowlers, fielding: match.fielding });
    const merged = mergeMatch(list);
    if (merged.played) {
      career.matches++;
      career.teams.add(match.teamBatting);
      career.teams.add(match.teamBowling);
      career.matchLog.unshift({
        fixture: `${match.teamBatting} vs ${match.teamBowling} (Live)`,
        result: match.innings === 2 ? `Target: ${match.target}` : 'Innings 1 in progress',
        date: 'Today',
        batting: merged.mBatting, bowling: merged.mBowling, fielding: merged.mFielding
      });
    }
  }

  career.teams = Array.from(career.teams).filter(Boolean);
  career.bestBowl = career.bestWkts > 0 ? `${career.bestWkts}/${career.bestRuns}` : '—';
  career.avg = career.dismissals > 0 ? (career.runs / career.dismissals).toFixed(1) : (career.runs > 0 ? `${career.runs}*` : '0.0');
  career.sr = career.balls > 0 ? ((career.runs / career.balls) * 100).toFixed(1) : '0.0';
  career.eco = career.bowlBalls > 0 ? (career.bowlRuns / (career.bowlBalls / 6)).toFixed(2) : '0.0';
  career.bowlAvg = career.wickets > 0 ? (career.bowlRuns / career.wickets).toFixed(1) : '—';
  career.bowlSR = career.wickets > 0 ? (career.bowlBalls / career.wickets).toFixed(1) : '—';
  return career;
}
