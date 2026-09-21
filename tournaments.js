/* ============================================================
   tournaments.js — Tournaments, teams, points table, past matches, H2H
   ============================================================ */

function archiveCurrentTournament() {
  if (!currentTourn) return;
  if (!currentTournId) currentTournId = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const snapshot = {
    id: currentTournId,
    name: currentTourn.name,
    overs: currentTourn.overs,
    venue: currentTourn.venue,
    teams: JSON.parse(JSON.stringify(savedTeams || [])),
    pastMatches: JSON.parse(JSON.stringify(pastMatchesLedger || [])),
    currentMatch: (match && match.isActive) ? JSON.parse(JSON.stringify(match)) : null,
    matchCode: matchCode || '',
    savedAt: new Date().toISOString()
  };
  const idx = tournamentsHistory.findIndex(t => t.id === currentTournId);
  if (idx >= 0) tournamentsHistory[idx] = snapshot;
  else tournamentsHistory.push(snapshot);
  autoPersist();
}

function openTournamentPicker() {
  const listEl = document.getElementById('pastTournamentsList');
  if (!listEl) return;
  listEl.innerHTML = '';
  const list = [...tournamentsHistory];
  if (currentTourn && currentTournId && !list.find(t => t.id === currentTournId)) {
    list.push({ id: currentTournId, name: currentTourn.name, overs: currentTourn.overs, venue: currentTourn.venue, savedAt: new Date().toISOString() });
  }
  if (list.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px;font-style:italic;">No previous tournaments yet</div>';
  } else {
    list.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
    let html = '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:800;margin-bottom:8px;">Resume Previous</div>';
    list.forEach(t => {
      const isActive = t.id === currentTournId;
      const matchInfo = (t.id === currentTournId && match && match.isActive) ? ' • <span style="color:var(--green);font-weight:900;">MATCH IN PROGRESS</span>' : '';
      html += `<div class="tourn-list-item${isActive ? ' active' : ''}" onclick="resumeTournament('${t.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-size:14px;font-weight:900;color:#fff;">${escapeHtml(t.name)}</div>
          ${isActive ? '<span style="font-size:9px;background:var(--green);color:#0a0e1a;padding:2px 7px;border-radius:8px;font-weight:900;">ACTIVE</span>' : ''}
        </div>
        <div style="font-size:10.5px;color:var(--muted);margin-top:4px;">
          ${t.overs} overs • ${escapeHtml(t.venue || 'Venue')}${t.savedAt ? ' • ' + new Date(t.savedAt).toLocaleDateString() : ''}${matchInfo}
        </div>
      </div>`;
    });
    listEl.innerHTML = html;
  }
  document.getElementById('tournamentPickerModal').style.display = 'flex';
}

function startNewTournamentFlow() {
  archiveCurrentTournament();
  currentTourn = null;
  currentTournId = null;
  savedTeams = [];
  pastMatchesLedger = [];
  match = emptyMatch();
  window.match = match;
  matchCode = '';
  const ni = document.getElementById('tNameInput'); if (ni) ni.value = '';
  const oi = document.getElementById('tOversInput'); if (oi) oi.value = '20';
  const vi = document.getElementById('tVenueInput'); if (vi) vi.value = '';
  autoPersist();
  openTournamentModal();
}

function resumeTournament(id) {
  closeModal('tournamentPickerModal');
  if (id === currentTournId) { launchDashboard('tournament'); return; }
  archiveCurrentTournament();
  const t = tournamentsHistory.find(x => x.id === id);
  if (!t) { showToast('Tournament not found'); return; }
  currentTourn = { name: t.name, overs: t.overs, venue: t.venue };
  currentTournId = t.id;
  savedTeams = JSON.parse(JSON.stringify(t.teams || []));
  pastMatchesLedger = JSON.parse(JSON.stringify(t.pastMatches || []));
  if (t.currentMatch && t.currentMatch.isActive) {
    match = t.currentMatch;
    matchCode = t.matchCode || '';
  } else {
    match = emptyMatch();
    match.totalOvers = t.overs || 20;
    match.originalOvers = t.overs || 20;
    match.venue = t.venue || '';
    matchCode = '';
  }
  window.match = match;
  autoPersist();
  launchDashboard('tournament');
  showToast('▶ Resumed: ' + t.name);
}

function openMatchPicker() {
  const resumeBtn = document.getElementById('btnResumeMatchFromHome');
  const hint = document.getElementById('matchPickerHint');
  if (match && match.isActive) {
    if (resumeBtn) {
      resumeBtn.style.display = 'block';
      resumeBtn.innerHTML = `▶ Resume: ${match.teamBatting || '?'} vs ${match.teamBowling || '?'}`;
    }
    if (hint) hint.innerText = 'A match is currently in progress';
  } else {
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (hint) hint.innerText = currentTourn ? `Tournament: ${currentTourn.name}` : 'No tournament set up yet';
  }
  document.getElementById('matchPickerModal').style.display = 'flex';
}

function startNewMatchFromHome() {
  closeModal('matchPickerModal');
  if (match && match.isActive) {
    if (!confirm('A match is already in progress.\n\nStart a NEW match?')) return;
  }
  launchDashboard('tournament');
  openTournamentModal();
}

function resumeMatchFromHome() {
  if (!match || !match.isActive) { showToast('No match in progress'); return; }
  launchDashboard('live');
}

/* Tournament modal & team selection */
function openTournamentModal() {
  if (currentTourn) {
    const ni = document.getElementById('tNameInput'); if (ni) ni.value = currentTourn.name || '';
    const oi = document.getElementById('tOversInput'); if (oi) oi.value = currentTourn.overs || 20;
    const vi = document.getElementById('tVenueInput'); if (vi) vi.value = currentTourn.venue || '';
  } else {
    const last = tournamentsHistory[0];
    const ni = document.getElementById('tNameInput'); if (ni) ni.value = '';
    const oi = document.getElementById('tOversInput'); if (oi) oi.value = (last && last.overs) ? last.overs : 20;
    const vi = document.getElementById('tVenueInput'); if (vi) vi.value = '';
  }
  document.getElementById('tournConfigModal').style.display = 'flex';
}

function saveTournamentAndProceed() {
  const name = document.getElementById('tNameInput').value.trim() || "Championship Cup";
  let overs = parseInt(document.getElementById('tOversInput').value, 10);
  if (!overs || overs <= 0) overs = 20;
  if (overs > 50) overs = 50;
  const venue = document.getElementById('tVenueInput').value.trim() || "Local Stadium";
  const isNew = !currentTourn || !currentTournId;
  currentTourn = { name, overs, venue };
  if (isNew) currentTournId = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  pendingMatchOvers = overs;
  pendingMatchVenue = venue;
  match.totalOvers = overs;
  match.originalOvers = overs;
  match.venue = venue;
  updateTournamentProfileCard();
  closeModal('tournConfigModal');
  autoPersist();
  openTeamSelectionModal();
}

function openTeamSelectionModal() {
  const i1 = document.getElementById('t1NewInput'); if (i1) i1.value = '';
  const i2 = document.getElementById('t2NewInput'); if (i2) i2.value = '';
  const dd1 = document.getElementById('t1Dropdown');
  const dd2 = document.getElementById('t2Dropdown');
  let opts = '<option value="">-- Select from saved teams --</option>';
  if (savedTeams && savedTeams.length > 0) {
    savedTeams.forEach(t => { opts += `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`; });
  } else opts = '<option value="">-- No saved teams — type below --</option>';
  if (dd1) dd1.innerHTML = opts;
  if (dd2) dd2.innerHTML = opts;
  updateTeamPreview();
  document.getElementById('teamSelectionModal').style.display = 'flex';
}

function onTeamDropdownChange(num) {
  const input = document.getElementById('t' + num + 'NewInput');
  if (input) input.value = '';
  updateTeamPreview();
}

function onNewTeamInput(num) {
  const dd = document.getElementById('t' + num + 'Dropdown');
  if (dd) dd.value = '';
  updateTeamPreview();
}

function updateTeamPreview() {
  const dd1 = document.getElementById('t1Dropdown'), dd2 = document.getElementById('t2Dropdown');
  const i1 = document.getElementById('t1NewInput'), i2 = document.getElementById('t2NewInput');
  const t1 = (i1 && i1.value.trim()) || (dd1 && dd1.value) || '--';
  const t2 = (i2 && i2.value.trim()) || (dd2 && dd2.value) || '--';
  const p = document.getElementById('teamPreview');
  if (p) p.innerText = t1 + '  vs  ' + t2;
}

function proceedToOpenersPopupDirectly() {
  const t1New = document.getElementById('t1NewInput'), t2New = document.getElementById('t2NewInput');
  const t1DD = document.getElementById('t1Dropdown'), t2DD = document.getElementById('t2Dropdown');
  const t1 = autoCapitalize(((t1New && t1New.value.trim()) || (t1DD && t1DD.value) || '').trim());
  const t2 = autoCapitalize(((t2New && t2New.value.trim()) || (t2DD && t2DD.value) || '').trim());
  if (!t1 || !t2) return alert("Please enter both team names");
  if (t1.toLowerCase() === t2.toLowerCase()) return alert("Teams must be different");

  RESOLVED_TEAM_1 = t1; RESOLVED_TEAM_2 = t2;
  let team1 = savedTeams.find(x => x.name === t1);
  if (!team1) { team1 = { name: t1, squad: [] }; savedTeams.push(team1); }
  let team2 = savedTeams.find(x => x.name === t2);
  if (!team2) { team2 = { name: t2, squad: [] }; savedTeams.push(team2); }
  selectedTeam1 = team1; selectedTeam2 = team2;
  closeModal('teamSelectionModal');

  const b = document.getElementById('battingTeamSelect');
  b.innerHTML = `<option value="${escapeHtml(RESOLVED_TEAM_1)}">${escapeHtml(RESOLVED_TEAM_1)}</option><option value="${escapeHtml(RESOLVED_TEAM_2)}">${escapeHtml(RESOLVED_TEAM_2)}</option>`;
  document.getElementById('strikerCustom').value = '';
  document.getElementById('nonStrikerCustom').value = '';
  document.getElementById('bowlerCustom').value = '';
  populatePlayerDropdowns();
  document.getElementById('openingRolesModal').style.display = 'flex';
  autoPersist();
}

function populatePlayerDropdowns() {
  const bn = document.getElementById('battingTeamSelect').value;
  const wn = bn === RESOLVED_TEAM_1 ? RESOLVED_TEAM_2 : RESOLVED_TEAM_1;
  const bt = savedTeams.find(t => t.name === bn);
  const wt = savedTeams.find(t => t.name === wn);
  const sD = document.getElementById('strikerDropdown');
  const nD = document.getElementById('nonStrikerDropdown');
  const bD = document.getElementById('bowlerDropdown');
  sD.innerHTML = '<option value="">-- From squad --</option>';
  nD.innerHTML = '<option value="">-- From squad --</option>';
  bD.innerHTML = '<option value="">-- From squad --</option>';
  if (bt && bt.squad) bt.squad.forEach(p => {
    sD.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
    nD.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
  });
  if (wt && wt.squad) wt.squad.forEach(p => {
    bD.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
  });
}

function updateTournamentProfileCard() {
  const nameDisplay = document.getElementById('tournNameDisplay');
  const metaDisplay = document.getElementById('tournMetaDisplay');
  if (currentTourn) {
    if (nameDisplay) nameDisplay.innerText = currentTourn.name;
    if (metaDisplay) metaDisplay.innerText = `${currentTourn.overs} Overs • ${currentTourn.venue}`;
  } else {
    if (nameDisplay) nameDisplay.innerText = "Tournament Not Set";
    if (metaDisplay) metaDisplay.innerText = "Tap Edit to configure";
  }
  updateContinueButton();
}

function updateContinueButton() {
  const btn = document.getElementById('btnContinueTourn');
  const nb = document.getElementById('btnStartNewMatch');
  const hint = document.getElementById('continueHint');
  if (!btn) return;
  if (match.isActive) {
    btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
    if (nb) { nb.disabled = true; nb.style.opacity = '0.35'; nb.style.cursor = 'not-allowed'; }
    if (hint) hint.innerText = '▶ Resume match in progress';
  } else {
    btn.disabled = true; btn.style.opacity = '0.35'; btn.style.cursor = 'not-allowed';
    if (nb) { nb.disabled = false; nb.style.opacity = '1'; nb.style.cursor = 'pointer'; }
    if (hint) hint.innerText = currentTourn ? 'No match in progress — start a new match' : 'Set up the tournament first, then start a new match';
  }
}

function continueFromTournament() {
  if (match.isActive) { launchDashboard('live'); return; }
  startNewMatchFlow();
}

function startNewMatchFlow() {
  if (match.isActive) {
    if (!confirm('A match is already in progress.\n\nStart a NEW match?')) return;
  }
  launchDashboard('tournament');
  openTournamentModal();
}

/* Head-to-head (item 21) */
function getHeadToHead(teamName) {
  const map = {};
  pastMatchesLedger.forEach(pm => {
    if (!pm.teamA || !pm.teamB || !pm.winner) return;
    if (pm.teamA !== teamName && pm.teamB !== teamName) return;
    const opp = pm.teamA === teamName ? pm.teamB : pm.teamA;
    if (!map[opp]) map[opp] = { opponent: opp, won: 0, lost: 0 };
    if (pm.winner === teamName) map[opp].won++;
    else if (pm.winner === opp) map[opp].lost++;
  });
  return Object.values(map).sort((a, b) => (b.won + b.lost) - (a.won + a.lost)).slice(0, 3);
}

function renderTeamsList() {
  const c = document.getElementById('teamsListContainer');
  if (!c) return;
  if (!savedTeams || savedTeams.length === 0) {
    c.innerHTML = `<div class="panel-card" style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No teams yet.</div>`;
    return;
  }
  c.innerHTML = '';
  savedTeams.forEach((team, idx) => {
    const abbr = team.name.substring(0, 3).toUpperCase();
    const squad = team.squad || [];
    const chips = squad.length === 0 ? `<div class="empty-squad-msg">No players yet.</div>`
      : squad.map(p => {
        const safeName = escapeHtml(p).replace(/'/g, "\\'");
        const bt = bowlerTypeMap[p];
        const roleTag = bt ? `<span class="chip-role" onclick="togglePlayerType('${safeName}')">${bt === 'spin' ? '🌀Spin' : '🏏Pace'}</span>` : '';
        return `<span class="player-chip">
          <span class="chip-avatar">${escapeHtml(p.charAt(0).toUpperCase())}</span>
          <span class="player-link" onclick="openPlayerCareerModal('${safeName}')">${escapeHtml(p)}</span>
          ${roleTag}
          <span class="chip-remove" onclick="removePlayerFromTeam(${idx},'${safeName}')">✕</span>
        </span>`;
      }).join('');

    const h2h = getHeadToHead(team.name);
    const h2hHtml = h2h.length === 0 ? '' :
      `<div style="margin-top:8px;padding:8px;background:rgba(255,255,255,.03);border-radius:8px;font-size:10.5px;color:var(--muted);">
        <b style="color:var(--cyan);">Head-to-Head</b><br>
        ${h2h.map(h => `${escapeHtml(h.opponent)}: <b>${h.won}W</b>-${h.lost}L`).join(' • ')}
      </div>`;

    c.innerHTML += `<div class="team-mgmt-card">
      <div class="team-header-row">
        <div class="team-name-display"><span>${escapeHtml(team.name)}</span><span class="team-abbr-badge">${abbr}</span></div>
        <span class="team-squad-count">${squad.length} player${squad.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="player-chip-grid">${chips}</div>
      <div class="add-player-inline">
        <input type="text" class="form-control" placeholder="Add player" id="addPlayerInput-${idx}" onkeydown="if(event.key==='Enter')addPlayerToTeamInline(${idx})">
        <button class="btn-ui btn-primary" onclick="addPlayerToTeamInline(${idx})">➕</button>
      </div>
      <div class="team-action-row">
        <button class="btn-ui" onclick="renameTeam(${idx})">✎ Rename</button>
        <button class="btn-ui" style="background:rgba(239,68,68,.18);border-color:var(--red);color:#fca5a5;" onclick="deleteTeam(${idx})">🗑 Delete</button>
      </div>
      ${h2hHtml}
    </div>`;
  });
}

function createNewTeamFromTab() {
  const i = document.getElementById('newTeamNameInput');
  const n = autoCapitalize(i.value.trim());
  if (!n) return alert("Enter team name");
  if (savedTeams.some(t => t.name.toLowerCase() === n.toLowerCase())) return alert("Team exists");
  savedTeams.push({ name: n, squad: [] });
  i.value = '';
  renderTeamsList();
  autoPersist();
}

function addPlayerToTeamInline(idx) {
  const i = document.getElementById('addPlayerInput-' + idx);
  const n = autoCapitalize(i.value.trim());
  if (!n) return;
  const t = savedTeams[idx];
  if (!t.squad) t.squad = [];
  if (t.squad.includes(n)) { i.value = ''; return; }
  t.squad.push(n);
  i.value = '';
  renderTeamsList();
  autoPersist();
}

function removePlayerFromTeam(ti, pn) {
  const t = savedTeams[ti];
  if (!t || !t.squad) return;
  if (!confirm(`Remove "${pn}"?`)) return;
  t.squad = t.squad.filter(p => p !== pn);
  renderTeamsList();
  autoPersist();
}

function renameTeam(idx) {
  const t = savedTeams[idx];
  const n = prompt(`Rename "${t.name}" to:`, t.name);
  if (!n || !n.trim()) return;
  const tr = autoCapitalize(n.trim());
  if (savedTeams.some((x, i) => i !== idx && x.name.toLowerCase() === tr.toLowerCase())) return alert("Name in use");
  t.name = tr;
  renderTeamsList();
  autoPersist();
}

function deleteTeam(idx) {
  const t = savedTeams[idx];
  if (!confirm(`Delete "${t.name}"?`)) return;
  savedTeams.splice(idx, 1);
  renderTeamsList();
  autoPersist();
}

function togglePlayerType(name) {
  const cur = bowlerTypeMap[name] || detectBowlerType(name);
  bowlerTypeMap[name] = cur === 'pace' ? 'spin' : 'pace';
  autoPersist();
  renderTeamsList();
}

function renderPointsTable() {
  const c = document.getElementById('pointsTableBody');
  if (!c) return;
  if (!savedTeams || savedTeams.length === 0) {
    c.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:11px;padding:16px;">No teams yet.</div>`;
    return;
  }
  const stats = {};
  savedTeams.forEach(t => { stats[t.name] = { name: t.name, P: 0, W: 0, L: 0, Pts: 0 }; });
  pastMatchesLedger.forEach(pm => {
    if (!pm.teamA || !pm.teamB || !pm.winner) return;
    const A = stats[pm.teamA], B = stats[pm.teamB];
    if (!A || !B) return;
    A.P++; B.P++;
    if (pm.winner === pm.teamA) { A.W++; B.L++; A.Pts += 2; }
    else if (pm.winner === pm.teamB) { B.W++; A.L++; B.Pts += 2; }
  });
  const arr = Object.values(stats).sort((a, b) => b.Pts - a.Pts);
  c.innerHTML = '';
  arr.forEach((t, i) => {
    c.innerHTML += `<div class="points-table-row">
      <div>${i + 1}</div><div><b>${escapeHtml(t.name)}</b></div>
      <div>${t.P}</div><div>${t.W}</div><div>${t.L}</div>
      <div><b style="color:var(--green);">${t.Pts}</b></div><div>0.00</div>
    </div>`;
  });
}

function renderPastMatchesList() {
  const c = document.getElementById('pastMatchesContainer');
  if (!c) return;
  if (!pastMatchesLedger || pastMatchesLedger.length === 0) {
    c.innerHTML = `<div class="panel-card" style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No past matches yet.</div>`;
    return;
  }
  c.innerHTML = '';
  pastMatchesLedger.forEach((pm, idx) => {
    c.innerHTML += `<div class="history-card">
      <div>
        <b style="font-size:13px;">${escapeHtml(pm.fixture)}</b><br>
        <span style="font-size:11px;color:var(--cyan);">${escapeHtml(pm.result)}</span>
      </div>
      <button class="btn-ui" onclick="viewPastMatchSummary(${idx})">View</button>
    </div>`;
  });
}

function viewPastMatchSummary(idx) {
  const pm = pastMatchesLedger[idx];
  if (!pm) return;
  const inn1 = pm.innings1, inn2 = pm.innings2;
  let msg = `${pm.fixture}\nResult: ${pm.result}\nVenue: ${pm.venue}\nDate: ${pm.date}\n\n`;
  if (inn1) msg += `1st Innings — ${inn1.team}: ${inn1.runs}/${inn1.wickets} (${Math.floor((inn1.balls || 0) / 6)}.${(inn1.balls || 0) % 6} ov)\n`;
  if (inn2) msg += `2nd Innings — ${inn2.team}: ${inn2.runs}/${inn2.wickets} (${Math.floor((inn2.balls || 0) / 6)}.${(inn2.balls || 0) % 6} ov)\n`;
  alert(msg);
}
