/* Live Sets clip band: three muted loops; tap a clip to hear its longer cut with sound, tap it again to stop (Luke 2026-11-23: no buttons).
   Markup is in index.html (#after12, [data-clips]); styling in clips.css. Loaded with defer, script-src 'self'.
   - Each clip has one transparent button over the whole tile (.a12-hit); nothing is drawn on the video except a thin progress line
     while sound plays. The hint line (.a12-hint) tells people to tap, and says what is happening.
   - Loops: no src until the clip is within 300px of the screen; playing only while at least half of it is on screen.
     The loops have no pause (Luke's call, 2026-11-23). Reduced motion: they never autoplay, the poster shows until a tap.
   - Sound: the tap swaps this clip to its cut with sound (the same tap that starts it, because iOS allows sound only inside the
     gesture), pauses the crate player (grlscry:clip-sound) and says so. The cut ends, scrolls under half visible, the tab hides,
     the clip is tapped again or the crate player starts (grlscry:player-play): back to the muted loop. */
(function () {
  'use strict';
  var root = document.querySelector('[data-clips]');
  if (!root) return;

  var small = window.matchMedia('(max-width: 768px)');            /* same test as the artist loop: the 9:16 cut under 768px */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canMp4 = document.createElement('video').canPlayType('video/mp4') !== '';
  var hint = root.querySelector('.a12-hint');
  var HINT = 'Tap a clip for sound';
  var STATES = ['is-default', 'is-loading', 'is-error', 'is-success'];
  if (!canMp4) return;                                             /* posters only; the hit buttons and the hint stay hidden */

  /* The lazy img has no currentSrc yet at defer time, so read the poster from the markup: the 9:16 <source> on phones, else the 16:9 img. */
  function posterFor(fig, img) {
    var s = small.matches && fig.querySelector('source[srcset]');
    if (s) return s.getAttribute('srcset').split(/\s+/)[0];
    return (img && (img.currentSrc || img.src)) || '';
  }

  var clips = [].slice.call(root.querySelectorAll('.a12-clip')).map(function (fig) {
    var img = fig.querySelector('img');
    var hit = fig.querySelector('.a12-hit');
    var c = { fig: fig, hit: hit, bar: null, name: fig.getAttribute('data-name') || 'clip', secs: fig.getAttribute('data-secs'),
      mode: 'loop', busy: false, err: false, inView: false, video: null, playerWas: false };
    var v = document.createElement('video');
    v.className = 'a12-v';
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
    v.preload = 'none';
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('aria-hidden', 'true');
    v.tabIndex = -1;
    v.poster = posterFor(fig, img);
    fig.insertBefore(v, hit);
    c.video = v;
    var bar = document.createElement('span');
    bar.className = 'a12-prog';
    bar.setAttribute('aria-hidden', 'true');
    fig.insertBefore(bar, hit);
    c.bar = bar;
    ['playing', 'pause', 'waiting', 'loadstart', 'canplay'].forEach(function (t) {
      v.addEventListener(t, function () {
        if (t === 'playing' || t === 'canplay' && !v.paused) c.busy = false;
        if (t === 'pause') c.busy = false;
        if (t === 'waiting' && !v.paused) c.busy = true;
        if (t === 'playing') c.err = false;
        render(c);
      });
    });
    v.addEventListener('timeupdate', function () {
      if (c.mode === 'snd' && v.duration) bar.style.transform = 'scaleX(' + Math.min(1, v.currentTime / v.duration).toFixed(3) + ')';
    });
    v.addEventListener('error', function () { c.busy = false; if (v.getAttribute('src')) c.err = true; render(c); });
    v.addEventListener('ended', function () { if (c.mode === 'snd') endSound(c); });
    hit.addEventListener('click', function () { onTap(c); });
    hit.hidden = false;
    render(c);
    return c;
  });
  if (hint) { hint.textContent = HINT; hint.hidden = false; }

  /* The tile's state: default (a muted loop or its poster), loading, error or success (its cut with sound is playing). */
  function render(c) {
    var snd = c.mode === 'snd', nm = 'the ' + c.name + ' clip';
    var st = !snd ? 'default' : c.err ? 'error' : c.busy ? 'loading' : 'success';
    STATES.forEach(function (s) { c.fig.classList.remove(s); });
    c.fig.classList.add('is-' + st);
    if (st === 'loading') c.hit.setAttribute('aria-busy', 'true'); else c.hit.removeAttribute('aria-busy');
    c.hit.setAttribute('aria-pressed', snd ? 'true' : 'false');
    c.hit.setAttribute('aria-label', {
      default: 'Play ' + nm + ' with sound' + (c.secs ? ', ' + c.secs + ' seconds' : ''),
      loading: 'Loading ' + nm + ' with sound',
      error: 'Retry ' + nm + ' with sound',
      success: 'Stop the sound on ' + nm
    }[st]);
    if (!snd) c.bar.style.transform = 'scaleX(0)';
    say();
  }

  /* The hint line doubles as the status line (role=status): what to do, or what is happening now. */
  function say() {
    if (!hint) return;
    var on = clips && clips.filter(function (o) { return o.mode === 'snd'; })[0];
    var t = HINT;
    /* One line at 375px in every state (white-space: nowrap in clips.css), so the clips below never move. */
    if (on) {
      t = on.err ? 'Sound didn’t load. Tap to retry.'
        : on.busy ? 'Loading the sound'
        : on.playerWas ? 'Player paused. Tap again to stop.' : 'Sound on. Tap again to stop.';
    }
    if (hint.textContent !== t) hint.textContent = t;
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
      /* Blocked autoplay or Low Power Mode: back to the poster, not an error. An interrupted play (pause, load) is not one either. */
      c.busy = false;
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError' && v.getAttribute('src')) c.err = true;
      render(c);
    });
  }

  /* Loop mode: should this clip be playing right now? */
  function sync(c) {
    if (c.mode === 'snd') { if (!c.inView || document.hidden) endSound(c); return; }
    var want = c.inView && !document.hidden && !reduce.matches;
    if (want) {
      if (c.video.paused && !c.busy) { ensureSrc(c); tryPlay(c); }
    } else if (!c.video.paused || c.busy) {
      c.video.pause();
    }
  }

  function onTap(c) {
    if (c.mode === 'snd' && !c.err) { endSound(c); return; }
    /* Everything below runs inside the click, before any await: iOS allows sound only inside the gesture. */
    var v = c.video;
    var player = document.getElementById('player');
    c.playerWas = !!(player && player.classList.contains('playing'));
    document.dispatchEvent(new CustomEvent('grlscry:clip-sound'));
    clips.forEach(function (o) { if (o !== c && o.mode === 'snd') endSound(o); });
    c.mode = 'snd'; c.err = false;
    v.removeAttribute('muted');
    v.defaultMuted = false; v.muted = false; v.loop = false;
    v.src = sndSrc(c);
    v.currentTime = 0;
    tryPlay(c);
  }

  /* Back to the muted loop (or the poster, when motion is off or the clip is off screen). */
  function endSound(c) {
    if (c.mode !== 'snd') return;
    var v = c.video;
    c.mode = 'loop'; c.err = false; c.busy = false; c.playerWas = false;
    v.pause();
    v.defaultMuted = true; v.muted = true; v.loop = true;
    v.removeAttribute('src');
    v.load();
    render(c);
    sync(c);
  }

  if ('IntersectionObserver' in window) {
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

  /* The band adds height above the page's scroll triggers; its boxes are reserved by aspect-ratio, so one refresh is enough. */
  window.addEventListener('load', function () {
    if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') window.ScrollTrigger.refresh();
  });
})();
