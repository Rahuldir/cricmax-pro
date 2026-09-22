/* ============================================================
   viewer.js — Viewer-mode state application + landing screen
   ✅ normalizeMatch() runs before applying any remote state
   ============================================================ */

function applyViewerState(newMatch) {
  if (!newMatch || !newMatch.teamBatting) return;

  /* ⚡ Self-heal BEFORE assigning to global match */
  if (typeof normalizeMatch === 'function') normalizeMatch(newMatch);

  match = newMatch;
  window.match = match;

  /* Hide landing screen (viewer mode) */
  const landing = document.getElementById('viewerLanding');
  if (landing && landing.style.display !== 'none') landing.style.display = 'none';

  /* Ensure new-format fields exist (belt + suspenders) */
  if (!Array.isArray(match.shotLog))              match.shotLog = [];
  if (!Array.isArray(match.innings1PartnerRuns))  match.innings1PartnerRuns = [];
  if (!Array.isArray(match.innings1Fow))          match.innings1Fow = [];
  if (!Array.isArray(match.innings1SectorRuns))   match.innings1SectorRuns = [0,0,0,0,0,0,0,0];
  if (!Array.isArray(match.innings2SectorRuns))   match.innings2SectorRuns = [0,0,0,0,0,0,0,0];
  if (typeof match._currentOverRuns !== 'number') match._currentOverRuns = 0;
  if (typeof match._lastOverRuns    !== 'number') match._lastOverRuns    = 0;

  /* Switch to dashboard view */
  const homeView = document.getElementById('view-home');
  const dashView = document.getElementById('view-dashboard');
  if (homeView && homeView.style.display !== 'none') {
    homeView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
  }

  /* Update header */
  const hTitle = document.getElementById('headerMainTitle');
  const hSub   = document.getElementById('headerSubTitle');
  if (hTitle) hTitle.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (hSub)   hSub.innerText   = `📺 LIVE • ${match.venue} • Innings ${match.innings}`;

  /* Render */
  try { renderLive(); }        catch (e) { console.warn('renderLive (viewer):', e); }
  try { renderCommentary(); }  catch (e) { console.warn('renderCommentary (viewer):', e); }
  try { renderScorecard(); }   catch (e) { console.warn('renderScorecard (viewer):', e); }
  try { updateLiveShareBadge(); } catch (e) {}
}
