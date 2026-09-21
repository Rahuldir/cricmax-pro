/* ============================================================
   viewer.js — Viewer mode state application, landing screen
   ============================================================ */

function applyViewerState(newMatch) {
  if (!newMatch || !newMatch.teamBatting) return;
  match = newMatch;
  window.match = match;

  // Hide landing screen (item 26)
  const landing = document.getElementById('viewerLanding');
  if (landing && landing.style.display !== 'none') landing.style.display = 'none';

  if (!match.shotLog) match.shotLog = [];
  if (!match.innings1PartnerRuns) match.innings1PartnerRuns = [];
  if (!match.innings1Fow) match.innings1Fow = [];
  if (!match.innings1SectorRuns) match.innings1SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  if (!match.innings2SectorRuns) match.innings2SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  if (typeof match._currentOverRuns !== 'number') match._currentOverRuns = 0;
  if (typeof match._lastOverRuns !== 'number') match._lastOverRuns = 0;

  const homeView = document.getElementById('view-home');
  const dashView = document.getElementById('view-dashboard');
  if (homeView && homeView.style.display !== 'none') {
    homeView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
  }

  const hTitle = document.getElementById('headerMainTitle');
  const hSub = document.getElementById('headerSubTitle');
  if (hTitle) hTitle.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (hSub) hSub.innerText = `📺 LIVE • ${match.venue} • Innings ${match.innings}`;

  renderLive();
  renderCommentary();
  renderScorecard();
  updateLiveShareBadge();
}
