/* Home page: a few seconds in, the game's pixel GRLS CRY runs along the header (feet on the ticker line), stops by the
   logo and asks if you want to play. It sits in the header so it never covers page content or a button.
   One file, loaded by index.html. Sprite sheet = play/invite.png (10 frames of 34x42: 8 run, stand, peace; the game's
   own art with a 1 px cream outline so the black outfit reads on the dark page). ?invite=1 shows it at once and ignores the "already seen" memory. */
(() => {
'use strict';
const FORCE = /[?&]invite=1/.test(location.search), KEY = 'gc-invite-until', DAY = 864e5;
const get = (s, k) => { try { return s.getItem(k); } catch (e) { return null; } };
const set = (s, k, v) => { try { s.setItem(k, v); } catch (e) {} };
if (!FORCE && (+get(localStorage, KEY) > Date.now() || get(sessionStorage, KEY))) return;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const css = `
.gi { position: fixed; left: var(--gi-l, 120px); top: calc(var(--nav-h, 80px) - 82px); z-index: 650; display: flex; align-items: center; gap: 10px; pointer-events: none; }
.gi-s { flex: none; width: 68px; height: 84px; pointer-events: auto; background: url(/play/invite.png) 0 0 / 680px 84px no-repeat; image-rendering: pixelated;
  transform: translateX(calc(-100% - var(--gi-l, 120px) - 8px)); transition: transform 1.1s linear, translate .35s cubic-bezier(0.86,0,0.07,1); }
.gi.in .gi-s { transform: none; }
.gi.run .gi-s { animation: gi-legs .64s steps(8) infinite; }
.gi.out .gi-s { scale: -1 1; transform: translateX(calc(100% + var(--gi-l, 120px) + 8px)); }
.gi.up .gi-s, .gi.up .gi-b { translate: 0 -180px; }       /* the header slides away on scroll-down: he rides with it */
.gi.still .gi-s { transition: opacity .2s; transform: none; opacity: 0; }
.gi.still.in .gi-s { opacity: 1; }
@keyframes gi-legs { to { background-position: -544px 0; } }
.gi-b { pointer-events: auto; padding: 4px 0 4px 14px; display: flex; align-items: center; gap: 12px; background: var(--s1, #1a1a1a); border: 1px solid var(--bm, rgba(215,239,194,.22));
  box-shadow: 0 6px 24px rgba(0,0,0,.45); opacity: 0; transform: translateX(-6px); transition: opacity .18s, transform .18s, translate .35s cubic-bezier(0.86,0,0.07,1); visibility: hidden; }
.gi.ask .gi-b { opacity: 1; transform: none; visibility: visible; }
.gi-q { margin: 0; font: 500 12px/1.3 var(--mono, monospace); letter-spacing: .08em; text-transform: uppercase; color: var(--white, #fff); white-space: nowrap; }
.gi-go { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; background: var(--sage, #d7efc2); color: var(--black, #0e0e0e); font: 500 12px/1 var(--mono, monospace); letter-spacing: .1em; text-transform: uppercase; text-decoration: none; }
.gi-x { width: 44px; height: 44px; margin-left: -12px; background: none; border: 0; color: var(--sage-dim, rgba(215,239,194,.55)); font: 400 20px/1 var(--mono, monospace); cursor: pointer; }
.gi-go:hover { background: var(--white, #fff); } .gi-x:hover { color: var(--white, #fff); }
.gi-go:focus-visible, .gi-x:focus-visible { outline: 2px solid var(--white, #fff); outline-offset: 2px; }
/* phone: no room beside him in the header, so the question hangs under the ticker */
@media (max-width: 900px) { .gi-b { position: fixed; right: 8px; top: calc(var(--nav-h, 80px) + var(--ticker-h, 32px) + 8px); transform: translateY(-6px); } }
`;

let el, timer, gone = false;
const frame = n => { el.firstChild.style.backgroundPosition = (-68 * n) + 'px 0'; };

const nav = document.getElementById('nav'), navUp = () => !!(nav && nav.style.transform);
const wait = ms => { clearTimeout(timer); if (!gone) timer = setTimeout(leave, ms); };

function show() {
  const a = document.activeElement, busy = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (document.hidden || busy || navUp() || document.querySelector('#nt[aria-expanded="true"]')) { setTimeout(show, 1500); return; }   // header away, menu open or someone typing: later
  set(sessionStorage, KEY, '1');
  document.head.appendChild(document.createElement('style')).textContent = css;
  el = document.createElement('aside'); el.className = 'gi' + (still ? ' still' : ' run'); el.setAttribute('aria-label', 'Game');
  el.innerHTML = '<a class="gi-s" href="/play" tabindex="-1" aria-hidden="true"></a>' +
    '<div class="gi-b"><p class="gi-q">Want to play a game?</p><a class="gi-go" href="/play">Play</a><button class="gi-x" type="button" aria-label="No thanks">×</button></div>';
  const logo = document.querySelector('#nav a, #nav img'), r = logo && logo.getBoundingClientRect();     // he stops just right of the logo, feet on the ticker line
  if (r && r.right > 0 && r.right < innerWidth * 0.5) el.style.setProperty('--gi-l', Math.round(r.right + 14) + 'px');
  document.body.appendChild(el);
  el.querySelector('.gi-x').addEventListener('click', () => { set(localStorage, KEY, Date.now() + 30 * DAY); leave(); });
  el.querySelectorAll('a').forEach(l => l.addEventListener('click', () => set(localStorage, KEY, Date.now() + 30 * DAY)));
  el.addEventListener('pointerenter', () => clearTimeout(timer)); el.addEventListener('focusin', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => wait(8000));
  if (nav) new MutationObserver(() => { if (gone) return; const up = navUp(); el.classList.toggle('up', up); if (up) clearTimeout(timer); else wait(8000); }).observe(nav, { attributes: true, attributeFilter: ['style'] });
  document.addEventListener('click', e => { if (!gone && e.target.closest && e.target.closest('#nt')) leave(); }, true);      // menu opening: get out of its way
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const arrived = () => { if (gone) return; el.classList.remove('run'); frame(8); setTimeout(() => { if (!gone) { frame(9); el.classList.add('ask'); } }, 160); wait(15000); };
  if (still) setTimeout(arrived, 200); else el.firstChild.addEventListener('transitionend', e => { if (e.propertyName === 'transform') arrived(); });
}

function leave() {
  if (gone) return; gone = true; clearTimeout(timer); el.classList.remove('ask');
  if (still) { el.classList.remove('in'); setTimeout(() => el.remove(), 250); return; }
  el.firstChild.style.backgroundPosition = ''; el.classList.add('run', 'out');
  setTimeout(() => el.remove(), 1300);
}

setTimeout(show, FORCE ? 300 : 4000);
})();
