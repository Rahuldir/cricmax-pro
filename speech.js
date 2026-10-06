/* ============================================================
   speech.js — Enhanced commentary engine (v2)
   ✅ Rich phrase library
   ✅ Ball speed callouts
   ✅ Milestone detection (fifty / century)
   ✅ Chase pressure context
   ✅ Dynamic rate / pitch per event type
   ✅ Wrapped in IIFE — never clashes with state.js globals
   ============================================================ */

(function(){
  'use strict';

  /* ──────────────────────────────────────────────
     SAFE GLOBAL ACCESSORS
     (state.js owns speechSynth, preferredVoice,
      speechVoicesReady, isCommentaryVoiceActive,
      commentaryDensity — we only read/write them)
     ────────────────────────────────────────────── */
  function synth(){ return window.speechSynth || window.speechSynthesis || null; }
  function getActive(){ return !!window.isCommentaryVoiceActive; }
  function setActive(v){ window.isCommentaryVoiceActive = !!v; }
  function getDensity(){ return window.commentaryDensity || 'all'; }
  function setDensity(v){ window.commentaryDensity = v; }

  /* ──────────────────────────────────────────────
     PHRASE MEMORY — avoid immediate repeats
     ────────────────────────────────────────────── */
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
     PHRASE LIBRARY
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
    ]
  };

  /* ──────────────────────────────────────────────
     SPEED PHRASE
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
     CONTEXT READER — reads live match state
     ────────────────────────────────────────────── */
  function __context(){
    var ctx = {};
    try {
      if (typeof match === 'undefined' || !match) return ctx;
      ctx.runs = match.runs || 0;
      ctx.wickets = match.wickets || 0;
      ctx.balls = match.legalBalls || 0;
      ctx.teamBatting = match.teamBatting || 'the batting side';
      ctx.striker = match.striker || 'the batsman';
      ctx.bowler = match.currentBowler || 'the bowler';
      ctx.target = match.target || 0;
      ctx.innings = match.innings || 1;

      if (match.batters && match.batters[match.striker]){
        ctx.strikerRuns  = match.batters[match.striker].runs  || 0;
        ctx.strikerBalls = match.batters[match.striker].balls || 0;
      }

      var totalOvers = match.totalOvers || 20;
      var totalBalls = totalOvers * 6;
      ctx.ballsLeft = Math.max(0, totalBalls - ctx.balls);

      if (ctx.innings === 2 && ctx.target > ctx.runs){
        ctx.needed = ctx.target - ctx.runs;
        ctx.rrr = ctx.ballsLeft > 0 ? ((ctx.needed / ctx.ballsLeft) * 6) : 0;
      }
    } catch(e){}
    return ctx;
  }

  /* ──────────────────────────────────────────────
     MILESTONE DETECTION
     ────────────────────────────────────────────── */
  function __milestone(){
    var ctx = __context();
    var r = ctx.strikerRuns || 0;
    if (r === 50){
      return __pick('fifty', PHRASES.fifty) + ' ' +
             ctx.striker + ' brings up his half-century off ' + ctx.strikerBalls + ' balls.';
    }
    if (r === 100){
      return __pick('century', PHRASES.century) + ' ' +
             ctx.striker + ', a hundred off just ' + ctx.strikerBalls + ' balls!';
    }
    return '';
  }

  /* ──────────────────────────────────────────────
     BUILD COMMENTARY FROM EVENT OBJECT
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

    /* Milestone priority */
    var milestone = __milestone();
    if (milestone && (ev.type === 'run' || ev.type === 'four' ||
        ev.type === 'six' || ev.type === 'milestone')){
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
        var m = String(ev.method || ev.wicketType || '').toLowerCase();
        if (m.indexOf('bowled') >= 0)      phrase = __pick('w_b', PHRASES.wicket_bowled);
        else if (m.indexOf('caught') >= 0) phrase = __pick('w_c', PHRASES.wicket_caught);
        else if (m.indexOf('lbw') >= 0)    phrase = __pick('w_l', PHRASES.wicket_lbw);
        else if (m.indexOf('run') >= 0)    phrase = __pick('w_r', PHRASES.wicket_runout);
        else if (m.indexOf('stump') >= 0)  phrase = __pick('w_s', PHRASES.wicket_stumped);
        else                                phrase = __pick('w_g', PHRASES.wicket_generic);
        break;

      default:
        if (ev.text) return ev.text;
        return '';
    }
    if (phrase) parts.push(phrase);

    /* Over-end summary */
    if (ev.type === 'over_end'){
      var ov = Math.floor(ctx.balls / 6) + '.' + (ctx.balls % 6);
      parts.push(ctx.teamBatting + ' ' + ctx.runs + ' for ' +
                 ctx.wickets + ' after ' + ov + ' overs.');
    }

    /* Chase pressure — random insertion after boundaries */
    if ((ev.type === 'four' || ev.type === 'six') &&
        ctx.innings === 2 && ctx.needed > 0 && ctx.rrr > 10 && Math.random() < 0.35){
      parts.push(ctx.needed + ' needed off ' + ctx.ballsLeft + ' balls.');
    }

    return parts.filter(Boolean).join(' ');
  }

  /* ──────────────────────────────────────────────
     VOICE LOADING
     ────────────────────────────────────────────── */
  window.loadSpeechVoices = function(){
    var s = synth();
    if (!s) return;
    try {
      var voices = s.getVoices();
      if (!voices || !voices.length) return;

      var prefs = ['en-IN', 'en-GB', 'en-AU', 'en-NZ', 'en-US'];
      for (var i = 0; i < prefs.length; i++){
        var found = null;
        for (var j = 0; j < voices.length; j++){
          if (voices[j].lang === prefs[i]){ found = voices[j]; break; }
        }
        if (found){
          window.preferredVoice = found;
          window.speechVoicesReady = true;
          return;
        }
      }
      /* Fallback — any English voice */
      var anyEn = null;
      for (var k = 0; k < voices.length; k++){
        if (voices[k].lang && voices[k].lang.toLowerCase().indexOf('en') === 0){
          anyEn = voices[k];
          break;
        }
      }
      window.preferredVoice = anyEn || voices[0];
      window.speechVoicesReady = true;
    } catch(e){}
  };

  window.primeSpeech = function(){
    var s = synth();
    if (!s) return;
    if (!window.speechVoicesReady) window.loadSpeechVoices();
    try {
      var warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      warm.rate = 2;
      s.speak(warm);
    } catch(e){}
  };

  /* ──────────────────────────────────────────────
     MAIN SPEAK — accepts string OR event object
     ────────────────────────────────────────────── */
  window.speak = function(input){
    if (!getActive()) return;

    var text = '';
    var ev = null;

    if (input && typeof input === 'object'){
      ev = input;
      text = __buildEventCommentary(ev);
    } else if (typeof input === 'string'){
      text = input.trim();
    }

    if (!text) return;
    var s = synth();
    if (!s) return;

    try {
      if (!window.speechVoicesReady) window.loadSpeechVoices();
      if (s.speaking && s.pending){
        try { s.cancel(); } catch(e){}
        setTimeout(function(){ doSpeak(text, ev); }, 90);
      } else {
        doSpeak(text, ev);
      }
    } catch(e){}
  };

  /* ──────────────────────────────────────────────
     doSpeak — dynamic rate/pitch per event type
     ────────────────────────────────────────────── */
  function doSpeak(text, ev){
    try {
      var s = synth();
      if (!s) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-IN';
      if (window.preferredVoice) u.voice = window.preferredVoice;

      var rate = 1.05, pitch = 1.0, volume = 1.0;
      if (ev){
        switch(ev.type){
          case 'six':       rate = 1.15; pitch = 1.15; break;
          case 'four':      rate = 1.12; pitch = 1.10; break;
          case 'wicket':    rate = 0.95; pitch = 0.95; break;
          case 'dot':       rate = 1.10; pitch = 0.98; break;
          case 'over_end':  rate = 1.00; pitch = 1.00; break;
          case 'milestone': rate = 0.92; pitch = 1.08; break;
          case 'wide':
          case 'noball':    rate = 1.00; pitch = 0.98; break;
        }
      }
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      s.speak(u);
    } catch(e){}
  }

  /* ──────────────────────────────────────────────
     TOGGLE COMMENTARY ON/OFF
     ────────────────────────────────────────────── */
  window.toggleCommentaryVoice = function(){
    setActive(!getActive());
    var on = getActive();

    var b       = document.getElementById('btnSoundToggle');
    var icon    = document.getElementById('soundIcon');
    var vppIcon = document.getElementById('vppSoundIcon');
    var vppBtn  = document.getElementById('vppSoundToggle');

    if (on){
      if (b)       b.classList.add('active');
      if (icon)    icon.innerText = '🔊';
      if (vppBtn)  vppBtn.classList.add('active');
      if (vppIcon) vppIcon.innerText = '🔊';
      window.primeSpeech();
      setTimeout(function(){
        var ctx = __context();
        var greeting = 'Commentary enabled.';
        if (ctx.teamBatting){
          var ov = Math.floor((ctx.balls || 0) / 6) + '.' + ((ctx.balls || 0) % 6);
          greeting = 'Commentary enabled. ' + ctx.teamBatting + ' are ' +
                     ctx.runs + ' for ' + ctx.wickets + ' in ' + ov + ' overs.';
        }
        window.speak(greeting);
      }, 150);
    } else {
      if (b)       b.classList.remove('active');
      if (icon)    icon.innerText = '🔇';
      if (vppBtn)  vppBtn.classList.remove('active');
      if (vppIcon) vppIcon.innerText = '🔇';
      var s = synth();
      if (s){ try { s.cancel(); } catch(e){} }
    }
  };

  /* ──────────────────────────────────────────────
     VOICE DENSITY
     ────────────────────────────────────────────── */
  window.setVoiceDensity = function(val){
    setDensity(val);
    try { localStorage.setItem('CricMax_VoiceDensity', val); } catch(e){}
  };

  /* ──────────────────────────────────────────────
     FILTER — should we speak this delivery?
     ────────────────────────────────────────────── */
  window.shouldSpeakDelivery = function(isWicket, runs, desc){
    if (!getActive()) return false;
    var d = getDensity();
    if (d === 'all')        return true;
    if (d === 'wickets')    return isWicket;
    if (d === 'boundaries') return isWicket || runs === 4 || runs === 6;
    if (d === 'milestones') return /CENTURY|FIFTY|WICKET|FIVE-FOR/i.test(desc || '');
    return true;
  };

  /* ──────────────────────────────────────────────
     EXPOSE EVENT-BASED API
     ────────────────────────────────────────────── */
  window.speakEvent = function(ev){ window.speak(ev); };

  /* ──────────────────────────────────────────────
     AUTO-INIT
     ────────────────────────────────────────────── */
  try {
    var s = synth();
    if (s && s.onvoiceschanged !== undefined){
      s.onvoiceschanged = window.loadSpeechVoices;
    }
    if (s) setTimeout(window.loadSpeechVoices, 500);
  } catch(e){}

  console.log('[Speech] ✅ Enhanced commentary engine loaded');
})();
