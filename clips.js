/* After12 clip band: three muted loops, each with a play/pause control and a "play with sound" cut.
   Markup is in index.html (#after12, [data-clips]); styling in clips.css. Loaded with defer, script-src 'self'.
   - Loops: no src until the clip is within 300px of the screen; playing only while at least half of it is on screen.
   - Reduced motion: never autoplays; the first Play sets the src and plays.
   - Sound: a tap on "Play with sound" swaps this clip to its longer cut with sound (the same tap that starts it, because iOS
     allows sound only inside the gesture), pauses the crate player (grlscry:clip-sound) and says so. The cut ends, scrolls
     under half visible, the tab hides or the crate player starts (grlscry:player-play): back to the muted loop. */
(function () {
  'use strict';
  var root = document.querySelector('[data-clips]');
  if (!root) return;

  var small = window.matchMedia('(max-width: 768px)');            /* same test as the artist loop: the 9:16 cut under 768px */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canMp4 = document.createElement('video').canPlayType('video/mp4') !== '';
  var live = root.querySelector('.a12-live');
  var LABEL = {
    loop: { default: 'Play', loading: 'Loading', error: 'Retry', success: 'Pause' },
    snd: { default: 'Play with sound', loading: 'Loading', error: 'Retry', success: 'Sound off' }
  };
  var STATES = ['is-default', 'is-loading', 'is-error', 'is-success', 'is-disabled'];

  function paint(btn, state, label, name) {
    STATES.forEach(function (s) { btn.classList.remove(s); });
    btn.classList.add('is-' + state);
    btn.disabled = state === 'disabled';
    if (state === 'loading') btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
    btn.querySelector('.a12-lb').textContent = label;
    btn.setAttribute('aria-label', name);
  }

  /* The lazy img has no currentSrc yet at defer time, so read the poster from the markup: the 9:16 <source> on phones, else the 16:9 img. */
  function posterFor(fig, img) {
    var s = small.matches && fig.querySelector('source[srcset]');
    if (s) return s.getAttribute('srcset').split(/\s+/)[0];
    return (img && (img.currentSrc || img.src)) || '';
  }

  var clips = [].slice.call(root.querySelectorAll('.a12-clip')).map(function (fig) {
    var img = fig.querySelector('img');
    var c = {
      fig: fig, name: fig.getAttribute('data-name') || 'clip', secs: fig.getAttribute('data-secs'),
      loopBtn: fig.querySelector('.a12-loop'), sndBtn: fig.querySelector('.a12-snd'),
      mode: 'loop', busy: false, err: false, held: false, userPlay: false, inView: false, video: null
    };
    if (canMp4) {
      var v = document.createElement('video');
      v.className = 'a12-v';
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      v.preload = 'none';
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('aria-hidden', 'true');
      v.tabIndex = -1;
      v.poster = posterFor(fig, img);
      fig.insertBefore(v, fig.querySelector('.a12-bar'));
      c.video = v;
      ['playing', 'pause', 'waiting', 'loadstart', 'canplay'].forEach(function (t) {
        v.addEventListener(t, function () {
          if (t === 'playing' || t === 'canplay' && !v.paused) c.busy = false;
          if (t === 'pause') c.busy = false;
          if (t === 'waiting' && !v.paused) c.busy = true;
          if (t === 'playing') c.err = false;
          render(c);
        });
      });
      v.addEventListener('error', function () { c.busy = false; if (v.getAttribute('src')) c.err = true; render(c); });
      v.addEventListener('ended', function () { if (c.mode === 'snd') endSound(c); });
      c.loopBtn.addEventListener('click', function () { onLoopClick(c); });
      c.sndBtn.addEventListener('click', function () { onSoundClick(c); });
    }
    c.loopBtn.hidden = false;
    c.sndBtn.hidden = false;
    render(c);
    return c;
  });

  function render(c) {
    var nm = c.name + ' clip';
    if (!canMp4) {
      paint(c.loopBtn, 'disabled', "Can’t play here", "Can’t play here: the " + nm);
      paint(c.sndBtn, 'disabled', "Can’t play here", "Can’t play here: the " + nm + ' with sound');
      return;
    }
    var snd = c.mode === 'snd', v = c.video;
    var playing = !v.paused && !c.busy && !v.ended;
    var ls = c.err ? 'error' : c.busy ? 'loading' : playing ? 'success' : 'default';
    var lname = { default: 'Play the ' + nm, loading: 'Loading the ' + nm, error: 'Retry the ' + nm, success: 'Pause the ' + nm }[ls];
    paint(c.loopBtn, ls, LABEL.loop[ls], lname);
    var ss = !snd ? 'default' : c.err ? 'error' : c.busy ? 'loading' : 'success';
    var sname = { default: 'Play with sound: the ' + nm + (c.secs ? ', ' + c.secs + ' seconds' : ''),
      loading: 'Loading the ' + nm + ' with sound', error: 'Retry the ' + nm + ' with sound', success: 'Sound off for the ' + nm }[ss];
    /* Stacked side tiles at 769px and up are narrow: the visible label is "Sound"; the accessible name keeps the full words. */
    var sl = ss === 'default' && !small.matches && !c.fig.classList.contains('a12-lead') ? 'Sound' : LABEL.snd[ss];
    paint(c.sndBtn, ss, sl, sname);
  }

  function loopSrc(c) { return c.fig.getAttribute(small.matches ? 'data-t' : 'data-w'); }
  function sndSrc(c) { return c.fig.getAttribute(small.matches ? 'data-t-snd' : 'data-w-snd'); }

  function ensureSrc(c) {
    if (c.mode === 'loop' && !c.video.getAttribute('src')) c.video.src = loopSrc(c);
  }

  function tryPlay(c) {
    var v = c.video;
    c.busy = true; c.err = false; render(c);
    var p = v.play();
    if (p && p.catch) p.catch(function (e) {
      /* Blocked autoplay or Low Power Mode: back to Play, not an error. An interrupted play (pause, load) is not one either. */
      c.busy = false;
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError' && v.getAttribute('src')) c.err = true;
      render(c);
    });
  }

  /* Loop mode: should this clip be playing right now? */
  function sync(c) {
    if (!c.video) return;
    if (c.mode === 'snd') { if (!c.inView || document.hidden) endSound(c); return; }
    var want = c.inView && !document.hidden && (reduce.matches ? c.userPlay : !c.held);
    if (!c.inView && reduce.matches) c.userPlay = false;
    if (want) {
      if (c.video.paused && !c.busy) { ensureSrc(c); tryPlay(c); }
    } else if (!c.video.paused || c.busy) {
      c.video.pause();
    }
  }

  function onLoopClick(c) {
    var v = c.video;
    if (c.err) { v.load(); tryPlay(c); return; }
    if (!v.paused || c.busy) { c.held = true; c.userPlay = false; v.pause(); return; }
    c.held = false; c.userPlay = true;
    ensureSrc(c);
    tryPlay(c);
  }

  function onSoundClick(c) {
    var v = c.video;
    if (c.mode === 'snd' && !c.err) { endSound(c); return; }
    /* Everything below runs inside the click, before any await: iOS allows sound only inside the gesture. */
    var playerWas = document.getElementById('player');
    var wasPlaying = !!(playerWas && playerWas.classList.contains('playing'));
    document.dispatchEvent(new CustomEvent('grlscry:clip-sound'));
    clips.forEach(function (o) { if (o !== c && o.mode === 'snd') endSound(o); });
    c.mode = 'snd'; c.err = false; c.held = false;
    v.removeAttribute('muted');
    v.defaultMuted = false; v.muted = false; v.loop = false;
    v.src = sndSrc(c);
    v.currentTime = 0;
    if (live) live.textContent = wasPlaying ? 'Music player paused.' : '';
    tryPlay(c);
  }

  /* Back to the muted loop (or the poster, when motion is off or the clip is off screen). */
  function endSound(c) {
    if (c.mode !== 'snd') return;
    var v = c.video;
    c.mode = 'loop'; c.err = false; c.busy = false; c.userPlay = false;
    v.pause();
    v.defaultMuted = true; v.muted = true; v.loop = true;
    v.removeAttribute('src');
    v.load();
    if (live && !clips.some(function (o) { return o.mode === 'snd'; })) live.textContent = '';
    render(c);
    sync(c);
  }

  if ('IntersectionObserver' in window && canMp4) {
    var near = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var c = clips.filter(function (o) { return o.fig === e.target; })[0];
        if (c && e.isIntersecting && !reduce.matches) ensureSrc(c);
      });
    }, { rootMargin: '300px' });
    var half = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var c = clips.filter(function (o) { return o.fig === e.target; })[0];
        if (!c) return;
        c.inView = e.isIntersecting && e.intersectionRatio >= 0.5;
        sync(c);
      });
    }, { threshold: [0, 0.5, 1] });
    clips.forEach(function (c) { near.observe(c.fig); half.observe(c.fig); });
  }

  document.addEventListener('visibilitychange', function () { clips.forEach(sync); });
  document.addEventListener('grlscry:player-play', function () { clips.forEach(endSound); });
  if (reduce.addEventListener) reduce.addEventListener('change', function () { clips.forEach(sync); });
  if (small.addEventListener) small.addEventListener('change', function () { clips.forEach(render); });

  /* The band adds height above the page's scroll triggers; its boxes are reserved by aspect-ratio, so one refresh is enough. */
  window.addEventListener('load', function () {
    if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') window.ScrollTrigger.refresh();
  });
})();
