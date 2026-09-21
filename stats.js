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
    const mvp = Math.round((b.runs * 1) + (b.fours * 1.5) + (b.sixes *
