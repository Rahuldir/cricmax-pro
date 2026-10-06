/* ============================================================
   speech.js — Enhanced commentary engine (v2)
   Rich phrases + ball speed + context awareness
   ============================================================ */

var speechSynth = window.speechSynthesis || null;
var preferredVoice = null;
var speechVoicesReady = false;
var isCommentaryVoiceActive = (typeof isCommentaryVoiceActive !== 'undefined') ? isCommentaryVoiceActive : false;
var commentaryDensity = (typeof commentaryDensity !== 'undefined') ? commentaryDensity : 'all';

/* Phrase memory — avoid immediate repeats */
var __lastPhrase = {};
function __pick(key, arr){
  if (!arr || !arr.length) return '';
  var tries = 0, choice;
  do {
    choice = arr[Math.floor(Math.random() * arr.length)];
    tries++;
  } while (choice === __lastPhrase[key] && tries < 8);
  __lastPhrase[key] = choice;
  return choice;
}

/* ──────────────────────────────────────────────
   Voice loading — prefers Indian English
   ────────────────────────────────────────────── */
function loadSpeechVoices(){
  if (!speechSynth){ speechSynth = window.speechSynthesis; }
  if (!speechSynth) return;
  try {
    var voices = speechSynth.getVoices();
    if (!voices || !voices.length) return;

    /* Priority: en-IN > en-GB > en-AU > en-US > any en */
    var prefs = ['en-IN', 'en-GB', 'en-AU', 'en-NZ', 'en-US'];
    for (var i = 0; i < prefs.length; i++){
      var found = voices.find(function(v){ return v.lang === prefs[i]; });
      if (found){ preferredVoice = found; speechVoicesReady = true; return; }
    }
    preferredVoice = voices.find(function(v){
      return v.lang && v.lang.toLowerCase().indexOf('en') === 0;
    }) || voices[0];
    speechVoicesReady = true;
  } catch(e){}
}

function primeSpeech(){
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;
  if (!speechVoicesReady) loadSpeechVoices();
  try {
    var warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.rate = 2;
    speechSynth.speak(warm);
  } catch(e){}
}

/* ──────────────────────────────────────────────
   Phrase Library — rich variations per event
   ────────────────────────────────────────────── */
var PHRASES = {
  dot: [
    "Dot ball.",
    "Defended solidly.",
    "No run.",
    "Good line, well blocked.",
    "Straight to the fielder.",
    "Tight bowling, no run.",
    "The batsman leaves it alone.",
    "Played into the ground, no run."
  ],
  one: [
    "Single taken.",
    "Just the one.",
    "Quick single there.",
    "Nudged away for one.",
    "Rotates the strike.",
    "One run to the total."
  ],
  two: [
    "Good running, two runs.",
    "They come back for the second.",
    "Two runs, nicely placed.",
    "Comfortable two.",
    "Excellent placement, two."
  ],
  three: [
    "Three runs! Excellent running.",
    "Three runs, great hustle.",
    "They scamper through for three.",
    "Three runs to the batsman."
  ],
  four: [
    "FOUR! Cracking shot!",
    "FOUR! Beautifully timed through the covers!",
    "FOUR! That raced away to the boundary!",
    "FOUR! Pierced the gap perfectly!",
    "FOUR! Superb timing, no chance for the fielder!",
    "FOUR! That is a textbook cover drive!",
    "FOUR! He made that look effortless!",
    "FOUR! Finds the gap and it's away!"
  ],
  six: [
    "SIX! Maximum!",
    "SIX! That is huge, into the stands!",
    "SIX! Clean strike over long-on!",
    "SIX! He's launched that into the crowd!",
    "SIX! What a shot, flat and fast!",
    "SIX! Enormous hit, that's gone miles!",
    "SIX! Picked up the length early and deposited it!",
    "SIX! That is a monster hit!"
  ],
  wicket_bowled: [
    "BOWLED HIM! Timber!",
    "BOWLED! What a delivery!",
    "BOWLED! Right through the gate!",
    "BOWLED HIM! The stumps are shattered!",
    "BOWLED! Cleaned him up!"
  ],
  wicket_caught: [
    "CAUGHT! Taken safely!",
    "CAUGHT! Straight to the fielder!",
    "CAUGHT! He's holed out!",
    "CAUGHT! Superb catch!",
    "CAUGHT! What a grab!"
  ],
  wicket_lbw: [
    "LBW! Given! Plumb in front!",
    "LBW! That looked dead straight!",
    "LBW! The finger goes up!",
    "LBW! Big wicket!"
  ],
  wicket_runout: [
    "RUN OUT! Direct hit!",
    "RUN OUT! They took a risky single!",
    "RUN OUT! Poor running between the wickets!",
    "RUN OUT! What a throw!"
  ],
  wicket_stumped: [
    "STUMPED! Lightning quick!",
    "STUMPED! Out of his crease!",
    "STUMPED! The keeper did the rest!"
  ],
  wicket_generic: [
    "WICKET! He's gone!",
    "WICKET! Big breakthrough!",
    "WICKET! Massive moment in the match!",
    "WICKET! The batsman has to go!"
  ],
  wide: [
    "Wide called.",
    "That's down the leg side, wide.",
    "Wide, extra run.",
    "Too wide outside off, wide called."
  ],
  noball: [
    "No ball! Free hit coming up!",
    "No ball called, extra run.",
    "Overstepped, no ball!",
    "No ball, and that's a costly one!"
  ],
  bye: [
    "Byes taken.",
    "Bye, the keeper missed it.",
    "Bye runs added."
  ],
  legbye: [
    "Leg bye taken.",
    "Off the pads, leg bye.",
    "Leg bye, they run through."
  ],
  over_end: [
    "End of the over.",
    "That's the end of the over.",
    "Over complete.",
    "That brings the over to a close."
  ],
  fifty: [
    "FIFTY! Well played!",
    "FIFTY up, superb knock!",
    "FIFTY! A fantastic half-century!",
    "FIFTY! Deserved milestone!"
  ],
  century: [
    "CENTURY! Magnificent hundred!",
    "CENTURY! Take a bow, what an innings!",
    "CENTURY! A truly special knock!",
    "CENTURY! Brilliant, brilliant hundred!"
  ],
  pressure: [
    "The pressure is building.",
    "The required rate is climbing.",
    "Tension in the middle.",
    "The fielding side is on top here."
  ],
  partnership: [
    "Good partnership building here.",
    "These two are steadying the ship.",
    "Excellent rotation of strike.",
    "Building a solid platform."
  ]
};

/* ──────────────────────────────────────────────
   Ball speed → natural speech
   ────────────────────────────────────────────── */
function __speedPhrase(kmh){
  if (!kmh || isNaN(kmh)) return '';
  var n = parseInt(kmh, 10);
  if (n < 90)  return n + ' kilometers per hour,';
  if (n < 110) return n + ' kph,';
  if (n >= 140) return n + ' kilometers per hour,';
  return n + ' kph,';
}

/* ──────────────────────────────────────────────
   Context helper — reads live match state
   ────────────────────────────────────────────── */
function __context(){
  var ctx = {};
  try {
    if (typeof match === 'undefined' || !match) return ctx;
    ctx.runs = match.runs || 0;
    ctx.wickets = match.wickets || 0;
    ctx.balls = match.legalBalls || 0;
    ctx.teamBatting = match.teamBatting || 'the batting side';
    ctx.teamBowling = match.teamBowling || 'the fielding side';
    ctx.striker = match.striker || 'the batsman';
    ctx.bowler = match.currentBowler || 'the bowler';
    ctx.target = match.target || 0;
    ctx.innings = match.innings || 1;

    /* Striker runs for milestone detection */
    if (match.batters && match.batters[match.striker]){
      ctx.strikerRuns = match.batters[match.striker].runs || 0;
      ctx.strikerBalls = match.batters[match.striker].balls || 0;
    }

    /* Overs remaining */
    var totalOvers = match.totalOvers || 20;
    var totalBalls = totalOvers * 6;
    ctx.ballsLeft = Math.max(0, totalBalls - ctx.balls);
    ctx.oversLeft = Math.floor(ctx.ballsLeft / 6);

    /* Chase pressure */
    if (ctx.innings === 2 && ctx.target > ctx.runs){
      ctx.needed = ctx.target - ctx.runs;
      ctx.rrr = ctx.ballsLeft > 0 ? ((ctx.needed / ctx.ballsLeft) * 6) : 0;
      ctx.crr = ctx.balls > 0 ? ((ctx.runs / ctx.balls) * 6) : 0;
    }
  } catch(e){}
  return ctx;
}

/* ──────────────────────────────────────────────
   Milestone detection — returns string or ''
   ────────────────────────────────────────────── */
function __milestone(){
  var ctx = __context();
  var r = ctx.strikerRuns || 0;
  if (r === 50)  return __pick('fifty', PHRASES.fifty) + ' ' + ctx.striker + ' brings up his half-century off ' + ctx.strikerBalls + ' balls.';
  if (r === 100) return __pick('century', PHRASES.century) + ' ' + ctx.striker + ', a hundred off just ' + ctx.strikerBalls + ' balls!';
  return '';
}

/* ──────────────────────────────────────────────
   Build commentary text from an event object
   ────────────────────────────────────────────── */
function __buildEventCommentary(ev){
  if (!ev) return '';
  var ctx = __context();
  var parts = [];

  /* Ball speed — only for deliveries */
  if (ev.speed && ev.type !== 'over_end' && ev.type !== 'milestone'){
    var sp = __speedPhrase(ev.speed);
    if (sp) parts.push(sp);
  }

  /* Milestone takes priority */
  var milestone = __milestone();
  if (milestone && (ev.type === 'run' || ev.type === 'four' || ev.type === 'six' || ev.type === 'milestone')){
    parts.push(milestone);
    return parts.join(' ');
  }

  var phrase = '';
  switch(ev.type){
    case 'dot':      phrase = __pick('dot', PHRASES.dot); break;
    case 'one':      phrase = __pick('one', PHRASES.one); break;
    case 'two':      phrase = __pick('two', PHRASES.two); break;
    case 'three':    phrase = __pick('three', PHRASES.three); break;
    case 'four':     phrase = __pick('four', PHRASES.four); break;
    case 'six':      phrase = __pick('six', PHRASES.six); break;
    case 'wide':     phrase = __pick('wide', PHRASES.wide); break;
    case 'noball':   phrase = __pick('noball', PHRASES.noball); break;
    case 'bye':      phrase = __pick('bye', PHRASES.bye); break;
    case 'legbye':   phrase = __pick('legbye', PHRASES.legbye); break;
    case 'over_end': phrase = __pick('over_end', PHRASES.over_end); break;

    case 'wicket':
      var method = String(ev.method || ev.wicketType || '').toLowerCase();
      if (method.indexOf('bowled') >= 0)      phrase = __pick('w_b', PHRASES.wicket_bowled);
      else if (method.indexOf('caught') >= 0) phrase = __pick('w_c', PHRASES.wicket_caught);
      else if (method.indexOf('lbw') >= 0)    phrase = __pick('w_l', PHRASES.wicket_lbw);
      else if (method.indexOf('run') >= 0)    phrase = __pick('w_r', PHRASES.wicket_runout);
      else if (method.indexOf('stump') >= 0)  phrase = __pick('w_s', PHRASES.wicket_stumped);
      else                                    phrase = __pick('w_g', PHRASES.wicket_generic);
      break;

    default:
      /* Fallback — just use raw text if provided */
      if (ev.text) return ev.text;
      return '';
  }
  if (phrase) parts.push(phrase);

  /* Over-end: append match summary */
  if (ev.type === 'over_end'){
    var ov = Math.floor(ctx.balls / 6) + '.' + (ctx.balls % 6);
    parts.push(ctx.teamBatting + ' ' + ctx.runs + ' for ' + ctx.wickets + ' after ' + ov + ' overs.');
  }

  /* Chase pressure — add after 4/6/run events if RRR is high */
  if ((ev.type === 'four' || ev.type === 'six' || ev.type === 'one' || ev.type === 'two')
      && ctx.innings === 2 && ctx.needed > 0 && ctx.rrr > 10 && ctx.ballsLeft > 6){
    if (Math.random() < 0.35){
      parts.push(ctx.needed + ' needed off ' + ctx.ballsLeft + ' balls.');
    }
  }

  return parts.filter(Boolean).join(' ');
}

/* ──────────────────────────────────────────────
   Main speak — accepts string OR event object
   ────────────────────────────────────────────── */
function speak(input){
  if (!isCommentaryVoiceActive) return;

  var text = '';
  var ev = null;

  if (input && typeof input === 'object'){
    ev = input;
    text = __buildEventCommentary(ev);
  } else if (typeof input === 'string'){
    text = input.trim();
  }

  if (!text) return;
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;

  try {
    if (!speechVoicesReady) loadSpeechVoices();
    if (speechSynth.speaking && speechSynth.pending){
      try { speechSynth.cancel(); } catch(e){}
      setTimeout(function(){ doSpeak(text, ev); }, 90);
    } else {
      doSpeak(text, ev);
    }
  } catch(e){}
}

/* ──────────────────────────────────────────────
   doSpeak — dynamic rate/pitch based on event
   ────────────────────────────────────────────── */
function doSpeak(text, ev){
  try {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    if (preferredVoice) u.voice = preferredVoice;

    /* Default pacing */
    var rate = 1.05, pitch = 1.0, volume = 1.0;

    if (ev){
      switch(ev.type){
        case 'six':
          rate = 1.15; pitch = 1.15; volume = 1.0;   /* Excited */
          break;
        case 'four':
          rate = 1.12; pitch = 1.10; volume = 1.0;   /* Lively */
          break;
        case 'wicket':
          rate = 0.95; pitch = 0.95; volume = 1.0;   /* Dramatic */
          break;
        case 'dot':
          rate = 1.10; pitch = 0.98;                  /* Matter-of-fact */
          break;
        case 'over_end':
          rate = 1.0; pitch = 1.0;                    /* Neutral */
          break;
        case 'milestone':
          rate = 0.92; pitch = 1.08;                  /* Celebratory */
          break;
        case 'wide':
        case 'noball':
          rate = 1.0; pitch = 0.98;
          break;
      }
    }

    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    speechSynth.speak(u);
  } catch(e){}
}

/* ──────────────────────────────────────────────
   Toggle commentary on/off
   ────────────────────────────────────────────── */
function toggleCommentaryVoice(){
  isCommentaryVoiceActive = !isCommentaryVoiceActive;
  try { window.isCommentaryVoiceActive = isCommentaryVoiceActive; } catch(e){}

  var b = document.getElementById('btnSoundToggle');
  var icon = document.getElementById('soundIcon');
  var vppIcon = document.getElementById('vppSoundIcon');
  var vppBtn = document.getElementById('vppSoundToggle');

  if (isCommentaryVoiceActive){
    if (b) b.classList.add('active');
    if (icon) icon.innerText = '🔊';
    if (vppBtn) vppBtn.classList.add('active');
    if (vppIcon) vppIcon.innerText = '🔊';
    primeSpeech();
    setTimeout(function(){
      var ctx = __context();
      var greeting = 'Commentary enabled.';
      if (ctx.teamBatting && typeof ctx.runs !== 'undefined'){
        var ov = Math.floor((ctx.balls || 0) / 6) + '.' + ((ctx.balls || 0) % 6);
        greeting = 'Commentary enabled. ' + ctx.teamBatting + ' are ' +
                   ctx.runs + ' for ' + ctx.wickets + ' in ' + ov + ' overs.';
      }
      speak(greeting);
    }, 150);
  } else {
    if (b) b.classList.remove('active');
    if (icon) icon.innerText = '🔇';
    if (vppBtn) vppBtn.classList.remove('active');
    if (vppIcon) vppIcon.innerText = '🔇';
    if (speechSynth){ try { speechSynth.cancel(); } catch(e){} }
  }
}

/* ──────────────────────────────────────────────
   Density setter
   ────────────────────────────────────────────── */
function setVoiceDensity(val){
  commentaryDensity = val;
  try { localStorage.setItem('CricMax_VoiceDensity', val); } catch(e){}
}

/* ──────────────────────────────────────────────
   Filter — should we speak this delivery?
   ────────────────────────────────────────────── */
function shouldSpeakDelivery(isWicket, runs, desc){
  if (!isCommentaryVoiceActive) return false;
  if (commentaryDensity === 'all') return true;
  if (commentaryDensity === 'wickets') return isWicket;
  if (commentaryDensity === 'boundaries') return isWicket || runs === 4 || runs === 6;
  if (commentaryDensity === 'milestones') return /CENTURY|FIFTY|WICKET|FIVE-FOR/i.test(desc || '');
  return true;
}

/* ──────────────────────────────────────────────
   Expose event-based speak globally
   ────────────────────────────────────────────── */
try {
  window.speakEvent = function(ev){ speak(ev); };
} catch(e){}

/* Auto-load voices on init */
try { if (speechSynth && speechSynth.onvoiceschanged !== undefined) {
  speechSynth.onvoiceschanged = loadSpeechVoices;
} } catch(e){}

console.log('[Speech] ✅ Enhanced commentary engine loaded');
