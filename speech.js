/* ============================================================
   speech.js — Text-to-speech commentary + density
   ============================================================ */

function loadSpeechVoices() {
  if (!speechSynth) return;
  try {
    const voices = speechSynth.getVoices();
    if (!voices || voices.length === 0) return;
    preferredVoice = voices.find(v => v.lang === 'en-IN') ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
      voices[0];
    speechVoicesReady = true;
  } catch (e) {}
}

function primeSpeech() {
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;
  if (!speechVoicesReady) loadSpeechVoices();
  try {
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.rate = 2;
    speechSynth.speak(warm);
  } catch (e) {}
}

function speak(text) {
  if (!isCommentaryVoiceActive || !text || !text.trim()) return;
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;
  try {
    if (!speechVoicesReady) loadSpeechVoices();
    if (speechSynth.speaking && speechSynth.pending) {
      try { speechSynth.cancel(); } catch (e) {}
      setTimeout(() => doSpeak(text), 90);
    } else doSpeak(text);
  } catch (e) {}
}

function doSpeak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.lang = 'en-IN';
    if (preferredVoice) u.voice = preferredVoice;
    speechSynth.speak(u);
  } catch (e) {}
}

function toggleCommentaryVoice() {
  isCommentaryVoiceActive = !isCommentaryVoiceActive;
  const b = document.getElementById('btnSoundToggle');
  const icon = document.getElementById('soundIcon');
  const vppIcon = document.getElementById('vppSoundIcon');
  const vppBtn = document.getElementById('vppSoundToggle');

  if (isCommentaryVoiceActive) {
    if (b) b.classList.add('active');
    if (icon) icon.innerText = '🔊';
    if (vppBtn) vppBtn.classList.add('active');
    if (vppIcon) vppIcon.innerText = '🔊';
    primeSpeech();
    setTimeout(() => {
      const team = match.teamBatting || 'the batting side';
      const ovStr = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
      const greeting = match.isActive
        ? `Commentary enabled. ${team} are ${match.runs} for ${match.wickets} in ${ovStr} overs.`
        : 'Commentary enabled.';
      speak(greeting);
    }, 150);
  } else {
    if (b) b.classList.remove('active');
    if (icon) icon.innerText = '🔇';
    if (vppBtn) vppBtn.classList.remove('active');
    if (vppIcon) vppIcon.innerText = '🔇';
    if (speechSynth) { try { speechSynth.cancel(); } catch (e) {} }
  }
}

function setVoiceDensity(val) {
  commentaryDensity = val;
  try { localStorage.setItem('CricMax_VoiceDensity', val); } catch (e) {}
}

/* Whether to speak this delivery (item 24) */
function shouldSpeakDelivery(isWicket, runs, desc) {
  if (!isCommentaryVoiceActive) return false;
  if (commentaryDensity === 'all') return true;
  if (commentaryDensity === 'wickets') return isWicket;
  if (commentaryDensity === 'boundaries') return isWicket || runs === 4 || runs === 6;
  if (commentaryDensity === 'milestones') return /CENTURY|FIFTY|WICKET|FIVE-FOR/i.test(desc);
  return true;
}
