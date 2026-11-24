/* GRLS CRY · Run to Sunbar. One file, no dependencies, all art drawn in code.
   Debug flags: ?sheet=1 (sprite sheet) ?bot=1 (autopilot) ?ts=4 (time scale) ?lvl=2 (start level) ?end=win|nousb|lose */
(() => {
'use strict';
const cv = document.getElementById('g'), cx = cv.getContext('2d');
const Q = new URLSearchParams(location.search);
const TAU = Math.PI * 2, PI = Math.PI;
const INK = '#0b0820', OL = '#1a0f2b', CREAM = '#f2e3c8', PINK = '#ff5aa0', GOLD = '#ffcf7a', RED = '#ff4d5e';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- seeded random ---------- */
let seed = 1;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));

/* ---------- colour ---------- */
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (c, f) => toHex(hex(c).map(v => v * f));
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

/* ---------- pixel buffer for sprites ---------- */
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.d[y * this.w + x]; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  limb(x0, y0, x1, y1, t, c) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2 || 1, o = (t - 1) / 2;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n - o), y = Math.round(y0 + (y1 - y0) * i / n - o);
      this.rect(x, y, t, t, c);
    }
  }
  stamp(rows, x, y, pal) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) this.set(x + i, y + j, c); } });
  }
  /* draw another buffer on top, with a dark edge where it overlaps what is already there */
  over(t) {
    const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
      if (!t.get(x, y)) continue;
      for (const [dx, dy] of N) if (!t.get(x + dx, y + dy) && this.get(x + dx, y + dy)) this.set(x + dx, y + dy, OL);
    }
    for (let i = 0; i < t.d.length; i++) if (t.d[i]) this.d[i] = t.d[i];
  }
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push(y * this.w + x);
    }
    add.forEach(i => this.d[i] = c);
    return this;
  }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const p = this.d[y * this.w + x]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); }
    }
    return c;
  }
}
const sprite = (rows, pal, pad = 1) => {
  const b = new Buf(rows[0].length + pad * 2, rows.length + pad * 2); b.stamp(rows, pad, pad, pal); return b.outline(OL).canvas();
};

/* ---------- characters: one rig, many fits ---------- */
const HEAD_M = [
  '....hhhhhh..',
  '..hhHHHHhhh.',
  '.hhHhhhhhss.',
  '.hhhhhhssss.',
  'hhhhhhssbbs.',
  'hhhhdssseSs.',
  'hhh.dsssssss',
  '.hh..sssmmm.',
  '.....dssmss.',
  '.....ddsss..',
  '......dss...'];
const HEAD_M_SHADES = HEAD_M.map((r, i) => i === 4 ? 'hhhhhhsssss.' : i === 5 ? 'hhhhggggwgg.' : i === 6 ? 'hhh.dssgggss' : r);
const HEAD_F = [
  '...hhhhhh...',
  '..hhHHHHhh..',
  '.hhHhhhhhhh.',
  '.hhhhhhhsss.',
  '.hhhhhsssss.',
  '.hhhhssseSs.',
  '.hhhhsssssss',
  '.hhhhsssrrs.',
  '.hhhhdssss..',
  '.hhhh.dss...',
  '.hhhh..ss...'];
const SKIN = '#e2a878';
const FITS = [
  { name: 'RUN KIT', ref: 'no photo on the site: a guess', top: '#f4efe6', sleeve: 'none', bib: true, bottoms: 'shorts', bot: '#16121f', shoes: '#ff5aa0' },
  { name: 'STRIPED POLO', ref: 's01 s02 s03 s05 s07', top: '#8f927f', stripes: '#5c6157', sleeve: 'short', sleeveCol: '#8f927f', cuff: '#1c2238', collar: '#1c2238', bottoms: 'pants', bot: '#2a2433', shoes: '#efe9df' },
  { name: 'GRLS CRY JERSEY', ref: 's04 s06 s08 s10 s13', top: '#15131c', sleeve: 'short', sleeveCol: '#15131c', cuff: '#f4efe6', collar: '#f4efe6', logo: true, bottoms: 'pants', bot: '#23202b', shoes: '#efe9df' },
  { name: 'BLACK TANK + SHADES', ref: 's16 s19', top: '#121016', sleeve: 'none', tank: true, shades: true, belt: '#c9ccd6', bottoms: 'pants', bot: '#27304a', shoes: '#15131c' },
];
const FANS = [
  { fem: true, hair: '#f0c35a', skin: '#f1c7a4', top: '#e0457f', shoes: '#f4efe6' },
  { fem: true, hair: '#5a2f24', skin: '#c98d62', top: '#f2e3c8', shoes: '#15131c' },
  { fem: true, hair: '#17121d', skin: '#8f5d3f', top: '#9d86d9', shoes: '#f4efe6' },
];
const CW = 32, CH = 40, GROUND = 38;      // sprite cell; row 38 is the sole

function drawDude(o, pose) {
  const B = new Buf(CW, CH), fem = !!o.fem, skin = o.skin || SKIN, far = c => shade(c, 0.7);
  const lean = pose.lean || 0, TL = 6, LT = fem ? 2 : 3;
  const legs = pose.legs.map(([a, k]) => {
    const kx = Math.sin(a) * TL, ky = Math.cos(a) * TL, s = a - k;
    return { kx, ky, fx: kx + Math.sin(s) * TL, fy: ky + Math.cos(s) * TL, s };
  });
  const hipX = 15, hipY = 36 - Math.max(...legs.map(l => l.fy)) - (pose.hop || 0);
  const top = Math.round(hipY) - 10;                       // first shirt row
  const hx = hipX - 6 + lean + (fem ? 0 : 1), hy = top - 10;
  const shX = hipX + lean, shY = top + 2;

  const leg = (b, l, isFar) => {
    const c = v => isFar ? far(v) : v;
    const thigh = o.bottoms === 'pants' ? o.bot : fem ? skin : o.bot, shin = o.bottoms === 'pants' ? o.bot : skin;
    const kx = hipX + l.kx, ky = hipY + l.ky, fx = hipX + l.fx, fy = hipY + l.fy;
    b.limb(hipX, hipY, kx, ky, LT, c(thigh));
    if (o.bottoms === 'shorts' && !fem) b.limb(hipX + l.kx * 0.6, hipY + l.ky * 0.6, kx, ky, LT, c(skin));
    b.limb(kx, ky, fx, fy, LT, c(shin));
    const X = Math.round(fx), Y = Math.round(fy);
    if (l.s < -0.85) { b.rect(X - 2, Y - 1, 3, 4, c(o.shoes)); }                      // kicked back: shoe points down
    else { b.rect(X - 1, Y, 5, 2, c(o.shoes)); b.rect(X - 1, Y + 2, 5, 1, c(fem ? o.shoes : '#f4efe6')); }
  };
  const arm = (b, [a, e], isFar) => {
    const c = v => isFar ? far(v) : v, UL = 5;
    const ex = shX + Math.sin(a) * UL, ey = shY + Math.cos(a) * UL;
    const wx = ex + Math.sin(a + e) * UL, wy = ey + Math.cos(a + e) * UL;
    const sl = o.sleeve, up = sl === 'none' || fem ? skin : o.sleeveCol;
    b.limb(shX, shY, ex, ey, 2, c(up));
    if (sl === 'short') {
      b.limb(shX + (ex - shX) * 0.6, shY + (ey - shY) * 0.6, ex, ey, 2, c(skin));
      if (o.cuff) b.limb(shX + (ex - shX) * 0.5, shY + (ey - shY) * 0.5, shX + (ex - shX) * 0.6, shY + (ey - shY) * 0.6, 2, c(o.cuff));
    }
    b.limb(ex, ey, wx, wy, 2, c(sl === 'long' ? o.sleeveCol : skin));
    if (sl === 'long') b.rect(Math.round(wx), Math.round(wy), 2, 2, c(skin));
    if (pose.phone && !isFar) { const X = Math.round(wx), Y = Math.round(wy); b.rect(X, Y - 4, 3, 5, '#17121d'); b.rect(X + 1, Y - 3, 1, 3, '#9fe8ff'); }
    if (pose.peace && !isFar) { const X = Math.round(wx), Y = Math.round(wy); b.set(X, Y - 2, skin); b.set(X + 2, Y - 2, skin); b.set(X, Y - 1, skin); b.set(X + 2, Y - 1, skin); }
  };

  arm(B, pose.arms[1], true);
  leg(B, legs[1], true);
  if (fem) B.rect(hx + 1, hy + 10, 4, 7, shade(o.hair, 0.8));
  // torso
  for (let r = 0; r < 8; r++) {
    const xo = Math.round(lean * (1 - r / 10)), y = top + r;
    for (let i = 0; i < 7; i++) {
      let c = o.stripes && r % 2 ? o.stripes : o.top;
      if (i === 0) c = shade(c, 0.78);
      if (o.tank && r < 2 && (i === 0 || i === 6)) c = skin;
      if (fem && r > 3 && (i === 0 || i === 6)) continue;
      if (fem && r < 2 && (i < 1 || i > 5)) c = skin;
      B.set(12 + xo + i, y, c);
    }
    if (o.collar && r === 0) B.rect(14 + xo, y, 4, 1, o.collar);
    if (o.logo && r === 3) B.rect(16 + xo, y, 2, 1, '#f4efe6');
    if (o.bib && r > 1 && r < 6) { B.rect(14 + xo, y, 4, 1, '#ffffff'); if (r === 3 || r === 4) B.set(15 + xo + (r & 1), y, '#16121f'); }
  }
  if (!fem) {
    B.rect(12, top + 8, 7, 3, o.bot); B.rect(12, top + 8, 1, 3, shade(o.bot, 0.78));
    if (o.belt) { B.rect(12, top + 8, 7, 1, o.belt); B.set(17, top + 8, '#ffffff'); B.set(14, top + 8, shade(o.belt, 0.7)); }
  }
  const T = new Buf(CW, CH); leg(T, legs[0], false); B.over(T);
  if (fem) for (let r = 0; r < 6; r++) { const w = 7 + Math.min(4, r + 1), x = 12 - Math.floor((w - 7) / 2); B.rect(x, top + 8 + r, w, 1, r === 5 ? shade(o.top, 0.8) : o.top); B.set(x, top + 8 + r, shade(o.top, 0.75)); }
  const Hd = new Buf(CW, CH);
  Hd.stamp(fem ? HEAD_F : o.shades ? HEAD_M_SHADES : HEAD_M, hx, hy, fem
    ? { h: o.hair, H: mix(o.hair, '#ffffff', 0.35), s: skin, d: shade(skin, 0.82), e: '#2a1a2e', S: skin, r: '#d8456f' }
    : { h: '#2b1c19', H: '#5a4036', s: skin, d: shade(skin, 0.8), e: '#1d1420', S: skin, m: '#24150f', b: '#2b1c19', g: '#0b0a10', w: '#8fa3c7' });
  B.over(Hd);
  const A = new Buf(CW, CH); arm(A, pose.arms[0], false); B.over(A);
  return B.outline(OL).canvas();
}

const legPose = ph => [0.15 + 0.85 * Math.sin(ph), 0.25 + 1.3 * Math.pow(Math.max(0, Math.cos(ph)), 1.5)];
const runPose = (i, n, extra) => {
  const ph = i / n * TAU, s = Math.sin(ph);
  return Object.assign({ legs: [legPose(ph), legPose(ph + PI)], arms: [[-0.95 * s, 1.35], [0.95 * s, 1.35]], lean: 1 }, extra);
};
const POSE = {
  stand: { legs: [[0.12, 0], [-0.12, 0]], arms: [[0.1, 0.25], [-0.1, 0.25]] },
  up: { legs: [[1.05, 1.5], [-0.35, 0.9]], arms: [[1.75, 0.95], [-1.0, 0.9]], lean: 1 },
  down: { legs: [[0.55, 0.5], [-0.5, 0.35]], arms: [[1.5, 0.7], [-1.6, 0.4]], lean: 1 },
  peace: { legs: [[0.12, 0], [-0.12, 0]], arms: [[1.8, 1.1], [-0.1, 0.25]], peace: true },
  film: { legs: [[0.1, 0], [-0.1, 0]], arms: [[1.7, 0.75], [0.3, 0.5]], phone: true },
  film2: { legs: [[0.1, 0], [-0.1, 0]], arms: [[1.85, 0.75], [0.3, 0.5]], phone: true, hop: 1 },
  selfie: { legs: [[0.1, 0], [-0.1, 0]], arms: [[2.25, 0.25], [0.2, 0.4]], phone: true },
  dj: { legs: [[0.14, 0], [-0.14, 0]], arms: [[0.95, 0.55], [0.6, 0.7]], lean: 1 },
};
const RUN_N = 8;
const mkSet = o => ({
  run: Array.from({ length: RUN_N }, (_, i) => drawDude(o, runPose(i, RUN_N))),
  up: drawDude(o, POSE.up), down: drawDude(o, POSE.down), stand: drawDude(o, POSE.stand), peace: drawDude(o, POSE.peace), dj: drawDude(o, POSE.dj),
});
const mkFan = o => {
  o = Object.assign({ sleeve: 'none', bottoms: 'shorts', bot: o.top }, o);
  return {
    idle: [drawDude(o, POSE.film), drawDude(o, POSE.film2)],
    run: Array.from({ length: RUN_N }, (_, i) => drawDude(o, runPose(i, RUN_N, { arms: [[1.6, 0.6], [1.3, 0.6]], phone: true }))),
    selfie: drawDude(o, POSE.selfie),
  };
};
const DUDE = FITS.map(mkSet), FAN = FANS.map(mkFan);

/* ---------- small sprites ---------- */
const USB = sprite(['..sSs..', '..sss..', '..sSs..', '.ppppp.', '.pPppp.', '.pPppp.', '.ppwpp.', '.ppppp.', '.ppppp.', '..ppp..'],
  { s: '#c9ccd6', S: '#ffffff', p: '#ff5aa0', P: '#ffb3d1', w: '#fff4e6' });
const DONUT = sprite(['...fffff...', '.ffwfffyff.', 'fffyfffffwf', 'fwff...ffff', 'dfff...fyfd', 'ddffffffffd', '.ddddddddd.', '..ddddddd..'],
  { f: '#f58ab4', w: '#ffffff', y: '#ffe07a', d: '#c98a4e' });
const HEART = sprite(['.rr.rr.', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#ff5aa0', R: '#ffd0e2' });
const BANG = sprite(['yy', 'yy', 'yy', 'yy', '..', 'yy'], { y: '#ffe07a' });

/* ---------- 5x7 bitmap font ---------- */
const GLY = {
  A: '.XXX./X...X/X...X/XXXXX/X...X/X...X/X...X', B: 'XXXX./X...X/X...X/XXXX./X...X/X...X/XXXX.', C: '.XXX./X...X/X..../X..../X..../X...X/.XXX.',
  D: 'XXXX./X...X/X...X/X...X/X...X/X...X/XXXX.', E: 'XXXXX/X..../X..../XXXX./X..../X..../XXXXX', F: 'XXXXX/X..../X..../XXXX./X..../X..../X....',
  G: '.XXX./X...X/X..../X.XXX/X...X/X...X/.XXX.', H: 'X...X/X...X/X...X/XXXXX/X...X/X...X/X...X', I: '.XXX./..X../..X../..X../..X../..X../.XXX.',
  J: '..XXX/...X./...X./...X./...X./X..X./.XX..', K: 'X...X/X..X./X.X../XX.../X.X../X..X./X...X', L: 'X..../X..../X..../X..../X..../X..../XXXXX',
  M: 'X...X/XX.XX/X.X.X/X.X.X/X...X/X...X/X...X', N: 'X...X/XX..X/XX..X/X.X.X/X..XX/X..XX/X...X', O: '.XXX./X...X/X...X/X...X/X...X/X...X/.XXX.',
  P: 'XXXX./X...X/X...X/XXXX./X..../X..../X....', Q: '.XXX./X...X/X...X/X...X/X.X.X/X..X./.XX.X', R: 'XXXX./X...X/X...X/XXXX./X.X../X..X./X...X',
  S: '.XXXX/X..../X..../.XXX./....X/....X/XXXX.', T: 'XXXXX/..X../..X../..X../..X../..X../..X..', U: 'X...X/X...X/X...X/X...X/X...X/X...X/.XXX.',
  V: 'X...X/X...X/X...X/X...X/X...X/.X.X./..X..', W: 'X...X/X...X/X...X/X.X.X/X.X.X/XX.XX/X...X', X: 'X...X/X...X/.X.X./..X../.X.X./X...X/X...X',
  Y: 'X...X/X...X/.X.X./..X../..X../..X../..X..', Z: 'XXXXX/....X/...X./..X../.X.../X..../XXXXX',
  0: '.XXX./X...X/X..XX/X.X.X/XX..X/X...X/.XXX.', 1: '..X../.XX../..X../..X../..X../..X../.XXX.', 2: '.XXX./X...X/....X/...X./..X../.X.../XXXXX',
  3: 'XXXXX/...X./..X../...X./....X/X...X/.XXX.', 4: '...X./..XX./.X.X./X..X./XXXXX/...X./...X.', 5: 'XXXXX/X..../XXXX./....X/....X/X...X/.XXX.',
  6: '..XX./.X.../X..../XXXX./X...X/X...X/.XXX.', 7: 'XXXXX/....X/...X./..X../.X.../.X.../.X...', 8: '.XXX./X...X/X...X/.XXX./X...X/X...X/.XXX.',
  9: '.XXX./X...X/X...X/.XXXX/....X/...X./.XX..',
  ':': '...../.XX../.XX../...../.XX../.XX../.....', '.': '...../...../...../...../...../.XX../.XX..', ',': '...../...../...../...../..X../..X../.X...',
  '!': '..X../..X../..X../..X../..X../...../..X..', '?': '.XXX./X...X/....X/...X./..X../...../..X..', '-': '...../...../...../.XXX./...../...../.....',
  '+': '...../..X../..X../XXXXX/..X../..X../.....', "'": '..X../..X../...../...../...../...../.....', '/': '....X/...X./...X./..X../.X.../.X.../X....',
  '>': '.X.../..X../...X./....X/...X./..X../.X...', '<': '...X./..X../.X.../X..../.X.../..X../...X.', '%': 'XX..X/XX.X./...X./..X../.X.../.X.XX/X..XX',
  '=': '...../...../XXXXX/...../XXXXX/...../.....',
  '×': '...../...../X...X/.X.X./..X../.X.X./X...X',
};
for (const k in GLY) GLY[k] = GLY[k].split('/');
const textW = (s, sc = 1) => (String(s).length * 6 - 1) * sc;
function text(s, x, y, sc = 1, col = CREAM, align = 0, sh = INK) {
  s = String(s).toUpperCase().replace(/X(?=\d)/g, '×');
  x = Math.round(x - textW(s, sc) * align); y = Math.round(y);
  const pass = (ox, oy, c) => {
    cx.fillStyle = c;
    for (let i = 0; i < s.length; i++) {
      const g = GLY[s[i]]; if (!g) continue;
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === 'X') cx.fillRect(x + ox + (i * 6 + q) * sc, y + oy + r * sc, sc, sc);
    }
  };
  if (sh) pass(sc, sc, sh);
  pass(0, 0, col);
}

/* ---------- levels ---------- */
const LEVELS = [
  { n: 'THE WARM-UP', fit: 0, len: 2400, gap: [150, 215], w: { fan: 5, row: 3, walk: 1 },
    sky: ['#211c57', '#5b3380', '#b3487b', '#ea7f55', '#ffc77e'], sun: '#ffe6a6', mtn: '#6d3f7d', mtn2: '#4f2d68', city: '#33204f', lit: 0.2,
    near: '#1c1232', walk: '#b3948f', walk2: '#9c7f7c', curb: '#5f4763', road: '#2c2040', line: '#c9a560' },
  { n: 'LAST MILE', fit: 1, len: 2700, gap: [128, 185], w: { fan: 5, pair: 2, row: 2, walk: 2, rush: 1 },
    sky: ['#0f0d33', '#2f1b63', '#74297f', '#c93f78', '#f27c62'], mtn: '#4a2a6b', mtn2: '#341d55', city: '#231643', lit: 0.4,
    near: '#130c26', walk: '#8d7488', walk2: '#79637a', curb: '#473652', road: '#211733', line: '#a98a58' },
  { n: 'THE LINE', fit: 2, len: 3000, gap: [108, 160], w: { fan: 4, pair: 3, row: 2, walk: 2, rush: 3 },
    sky: ['#05051a', '#0b0b2e', '#161042', '#2a1558', '#4f2170'], moon: '#f2e3c8', stars: true, mtn: '#211446', mtn2: '#170e33', city: '#150d2c', lit: 0.6, neon: true,
    near: '#1b1236', walk: '#5f5173', walk2: '#514462', curb: '#30263f', road: '#150f24', line: '#7d6a4c' },
];
const CLOCK = 96;                  // seconds for the whole run, all three levels
const FINAL = FITS.length - 1;

function buildLevel(i) {
  const L = LEVELS[i], E = [], bag = [];
  seed = 4242 + i * 977;
  for (const k in L.w) for (let j = 0; j < L.w[k]; j++) bag.push(k);
  const fan = (x, mode) => E.push({ t: 'fan', x, mode, v: rint(0, 2), ph: rnd() * TAU });
  const usb = (x, y) => E.push({ t: 'usb', x, y });
  const arc = x => { usb(x - 21, 34); usb(x, 46); usb(x + 21, 34); };
  let x = 250, nextDonut = 380, last = '';
  while (x < L.len - (i === 2 ? 470 : 200)) {
    let k = bag[rint(0, bag.length - 1)];
    if (k === 'row' && last === 'row') k = 'fan';
    last = k;
    if (k === 'fan') { fan(x, 'stand'); arc(x); }
    else if (k === 'pair') { fan(x, 'stand'); fan(x + 13, 'stand'); arc(x + 6); x += 13; }
    else if (k === 'walk') fan(x + 30, 'walk');
    else if (k === 'rush') fan(x + 45, 'rush');
    else for (let j = 0; j < 4; j++) usb(x - 27 + j * 18, 13);
    const g = L.gap[0] + rnd() * (L.gap[1] - L.gap[0]), mid = x + g / 2 + (k === 'walk' ? 20 : k === 'rush' ? 30 : 0);
    if (mid >= nextDonut && k !== 'row') { E.push({ t: 'donut', x: mid, y: g > 175 && rnd() < 0.4 ? 40 : 13 }); nextDonut = mid + 400 + rnd() * 120; }
    x += g;
  }
  if (i === 2) { for (let j = 0; j < 3; j++) { fan(L.len - 330 + j * 86, 'stand'); arc(L.len - 330 + j * 86); } }
  return E.sort((a, b) => a.x - b.x);
}

/* ---------- backdrops ---------- */
const TILE = 512;
let W = 200, H = 200, S = 2, gy = 150, safe = { t: 0, r: 0, b: 0, l: 0 };
const BG = {};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function skyColor(L, t) { const n = L.sky.length - 1, f = Math.max(0, Math.min(0.9999, t)) * n, i = Math.floor(f); return mix(L.sky[i], L.sky[i + 1], f - i); }
function hexPath(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3; g[i ? 'lineTo' : 'moveTo'](Math.round(x + Math.cos(a) * r) + 0.5, Math.round(y + Math.sin(a) * r) + 0.5); } g.closePath(); }
function palm(g, x, base, h, c) {
  g.fillStyle = c;
  for (let i = 0; i < h; i++) g.fillRect(x + Math.round(Math.sin(i / h * 1.6) * 3), base - i, 2, 1);
  const tx = x + Math.round(Math.sin(1.6) * 3), ty = base - h;
  for (const [dx, dy] of [[-9, 3], [-7, -3], [-2, -6], [4, -5], [9, -1], [10, 4], [-10, 7], [6, 8]])
    for (let i = 0; i <= 10; i++) g.fillRect(Math.round(tx + dx * i / 10), Math.round(ty + dy * i / 10 + (i / 10) ** 2 * 3), 2, 1);
}
function buildBG(i) {
  const L = LEVELS[i], o = {};
  seed = 99 + i * 31;
  // sky: banded, with a dithered row between bands
  let [c, g] = mk(W, gy); const steps = 18;
  for (let y = 0; y < gy; y++) {
    const s = y / gy * steps, b = Math.floor(s);
    g.fillStyle = skyColor(L, b / steps); g.fillRect(0, y, W, 1);
    if (s - b > 0.7) { g.fillStyle = skyColor(L, (b + 1) / steps); for (let x = (y & 1); x < W; x += 2) g.fillRect(x, y, 1, 1); }
  }
  if (L.stars) for (let k = 0; k < 70; k++) { g.fillStyle = rnd() < 0.2 ? '#fff4e6' : '#8a7fc0'; g.fillRect(rint(0, W), rint(0, Math.round(gy * 0.7)), 1, 1); }
  const orb = (x, y, r, col) => { g.fillStyle = col; for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(r * r - j * j)); g.fillRect(x - w, y + j, w * 2, 1); } };
  if (L.sun) { orb(Math.round(W * 0.68), gy - 44, 30, mix(L.sun, L.sky[4], 0.55)); orb(Math.round(W * 0.68), gy - 44, 24, L.sun); }
  if (L.moon) { orb(Math.round(W * 0.72), Math.round(gy * 0.3), 11, L.moon); orb(Math.round(W * 0.72) + 5, Math.round(gy * 0.3) - 3, 9, skyColor(L, 0.3)); }
  o.sky = c;
  // mountains
  [c, g] = mk(TILE, 80);
  const ridge = (col, base, a, p) => { g.fillStyle = col; for (let x = 0; x < TILE; x++) { const t = x / TILE * TAU, h = base + a * Math.sin(t * 2 + p) + a * 0.6 * Math.sin(t * 5 + p * 2) + a * 0.25 * Math.sin(t * 11 + p * 3); g.fillRect(x, 80 - Math.round(h), 1, Math.round(h)); } };
  ridge(L.mtn, 40, 14, 1); ridge(L.mtn2, 24, 9, 2.4);
  o.mtn = c;
  // skyline
  [c, g] = mk(TILE, 90);
  for (let x = 0; x < TILE;) {
    const w = rint(14, 36), h = rint(14, 50);
    if (x + w > TILE) break;
    g.fillStyle = L.city; g.fillRect(x, 90 - h, w, h);
    for (let wy = 90 - h + 3; wy < 86; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < L.lit) { g.fillStyle = rnd() < 0.85 ? GOLD : '#ff9ac2'; g.fillRect(wx, wy, 2, 2); }
    x += w + rint(0, 10);
  }
  for (let k = 0; k < 5; k++) palm(g, 30 + k * 100 + rint(0, 30), 90, rint(34, 54), L.city);
  o.city = c;
  // near strip: wall, palms, saguaros, lamps, neon
  [c, g] = mk(TILE, 96);
  g.fillStyle = L.near; g.fillRect(0, 82, TILE, 14);
  for (let x = 0; x < TILE; x += 32) g.fillRect(x, 78, 3, 18);
  for (let k = 0; k < 4; k++) {
    const x = 20 + k * 128 + rint(0, 40);
    if (k % 2) palm(g, x, 90, rint(52, 70), L.near);
    else { g.fillStyle = L.near; g.fillRect(x, 54, 5, 30); g.fillRect(x - 6, 64, 6, 3); g.fillRect(x - 6, 58, 3, 8); g.fillRect(x + 5, 68, 6, 3); g.fillRect(x + 8, 60, 3, 10); }
  }
  for (let k = 0; k < 3; k++) {
    const x = 80 + k * 170; g.fillStyle = L.near; g.fillRect(x, 26, 2, 60); g.fillRect(x, 26, 12, 2);
    g.fillStyle = GOLD; g.fillRect(x + 9, 28, 4, 2);
  }
  if (L.neon) for (let k = 0; k < 5; k++) {
    const x = 40 + k * 100 + rint(0, 20), col = [PINK, '#ffb36b', '#6ee0ff'][k % 3];
    g.strokeStyle = col; g.lineWidth = 1; hexPath(g, x, 72, 8); g.stroke(); hexPath(g, x + 14, 64, 8); g.stroke();
  }
  o.near = c;
  // foreground silhouettes (tall screens only)
  [c, g] = mk(TILE, 40); g.fillStyle = '#07051a';
  for (let k = 0; k < 9; k++) { const x = k * 57 + rint(0, 20); g.fillRect(x, 16, 5, 24); g.fillRect(x - 1, 14, 7, 3); }
  for (let k = 0; k < 4; k++) { const x = 40 + k * 128; for (let j = -4; j <= 4; j++) for (let q = 0; q < 16; q++) g.fillRect(Math.round(x + j * q * 0.45), 40 - q - 4 + Math.round(Math.abs(j) * q * 0.12), 2, 2); }
  o.fore = c;
  // Sunbar (drawn once, used at the end of the last level and on the title)
  [c, g] = mk(230, 120);
  g.fillStyle = '#1b1030'; g.fillRect(0, 26, 230, 94);
  for (let x = 0; x < 230; x += 7) { g.fillStyle = x % 14 ? '#22143a' : '#170d29'; g.fillRect(x, 26, 6, 94); }
  g.fillStyle = '#0c071a'; g.fillRect(0, 22, 230, 5);
  g.fillStyle = '#0c071a'; g.fillRect(52, 0, 126, 22); g.fillStyle = '#2a1848'; g.fillRect(54, 2, 122, 18);
  o.bar = c; o.barG = g;
  return o;
}
function drawBar(L, bg, sx, t) {
  cx.drawImage(bg.bar, sx, gy - 120);
  text('SUNBAR', sx + 115, gy - 116, 2, CREAM, 0.5, '#7a2a55');
  const cols = [PINK, '#ffb36b', CREAM];
  cx.lineWidth = 1;
  [[30, 62], [46, 80], [30, 98], [196, 70], [212, 88]].forEach(([x, y], k) => { cx.strokeStyle = cols[k % 3]; hexPath(cx, sx + x, gy - 120 + y, 10); cx.stroke(); });
  // door
  cx.fillStyle = '#0c071a'; cx.fillRect(sx + 136, gy - 44, 30, 44);
  cx.fillStyle = '#ffb36b'; cx.fillRect(sx + 139, gy - 41, 24, 41);
  cx.fillStyle = PINK; cx.fillRect(sx + 139, gy - 41 + Math.round(8 + 4 * Math.sin(t * 2)), 24, 41 - Math.round(8 + 4 * Math.sin(t * 2)));
  cx.fillStyle = 'rgba(255,90,160,.14)'; cx.fillRect(sx + 128, gy - 2, 46, 4);
  // rope line
  cx.fillStyle = GOLD; for (const x of [20, 70, 120]) { cx.fillRect(sx + x, gy - 14, 2, 14); cx.fillRect(sx + x - 1, gy - 15, 4, 2); }
  cx.fillStyle = '#b2304a'; for (let x = 22; x < 120; x++) cx.fillRect(sx + x, gy - 12 + Math.round(3 * Math.sin((x - 22) % 50 / 50 * PI)), 1, 1);
}
const DOOR = 151;     // door centre inside the Sunbar art

function drawWorld(i, cam, t) {
  const L = LEVELS[i], bg = BG[i] || (BG[i] = buildBG(i));
  cx.drawImage(bg.sky, 0, 0);
  const tile = (img, f, y) => { const o = -Math.floor((cam * f) % TILE); for (let x = o; x < W; x += TILE) cx.drawImage(img, x, y); };
  tile(bg.mtn, 0.06, gy - 80 - 14);
  tile(bg.city, 0.2, gy - 90);
  tile(bg.near, 0.5, gy - 96);
  // ground
  const o = -Math.floor(cam % 32);
  cx.fillStyle = L.walk; cx.fillRect(0, gy, W, 12);
  cx.fillStyle = L.walk2; cx.fillRect(0, gy, W, 1); for (let x = o; x < W; x += 32) cx.fillRect(x, gy, 1, 12);
  cx.fillStyle = L.curb; cx.fillRect(0, gy + 12, W, 5);
  cx.fillStyle = shade(L.curb, 0.7); cx.fillRect(0, gy + 16, W, 1);
  cx.fillStyle = L.road; cx.fillRect(0, gy + 17, W, H - gy - 17);
  if (H - gy > 46) { cx.fillStyle = L.line; const lo = -Math.floor((cam * 1.15) % 48); for (let x = lo; x < W; x += 48) cx.fillRect(x, gy + 38, 22, 2); }
  return bg;
}
function drawFore(i, cam) {
  if (H - gy < 90) return;
  const bg = BG[i], o = -Math.floor((cam * 1.6) % TILE), y = Math.min(H - 40, gy + 78);
  for (let x = o; x < W; x += TILE) cx.drawImage(bg.fore, x, y);
  cx.fillStyle = '#07051a'; cx.fillRect(0, y + 40, W, H - y - 40);
}

/* ---------- sound ---------- */
const AU = { ctx: null, on: true, master: null, timer: 0, step: 0, next: 0, music: false };
try { AU.on = localStorage.getItem('gc-snd') !== '0'; } catch (e) {}
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  AU.ctx = new AC(); AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.on ? 0.5 : 0; AU.master.connect(AU.ctx.destination);
  const n = AU.ctx.sampleRate * 0.2, b = AU.ctx.createBuffer(1, n, AU.ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = b;
  AU.timer = setInterval(sched, 40);
}
function setSound(on) { AU.on = on; if (AU.master) AU.master.gain.value = on ? 0.5 : 0; try { localStorage.setItem('gc-snd', on ? '1' : '0'); } catch (e) {} }
function tone(f, d, type = 'square', v = 0.12, f2, when) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime, o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + d + 0.02);
}
function hiss(d, v = 0.1, when, hp = 6000) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime, s = AU.ctx.createBufferSource(), g = AU.ctx.createGain(), f = AU.ctx.createBiquadFilter();
  s.buffer = AU.noise; f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t); s.stop(t + d + 0.02);
}
const SFX = {
  jump: () => tone(300, 0.13, 'square', 0.07, 620),
  usb: () => { tone(988, 0.06, 'square', 0.06); tone(1319, 0.1, 'square', 0.06, null, AU.ctx && AU.ctx.currentTime + 0.06); },
  donut: () => { tone(392, 0.08, 'triangle', 0.14); tone(523, 0.08, 'triangle', 0.14, null, AU.ctx && AU.ctx.currentTime + 0.08); tone(784, 0.14, 'triangle', 0.14, null, AU.ctx && AU.ctx.currentTime + 0.16); },
  oops: () => tone(220, 0.2, 'sawtooth', 0.07, 110),
  snap: () => { hiss(0.05, 0.25, null, 3000); hiss(0.08, 0.18, AU.ctx && AU.ctx.currentTime + 0.09, 2000); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.08, null, AU.ctx && AU.ctx.currentTime + i * 0.11)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, null, AU.ctx && AU.ctx.currentTime + i * 0.2)),
  tick: () => tone(1500, 0.03, 'square', 0.04),
};
/* placeholder beat: four on the floor, 145 BPM, A# minor. Not a GRLS CRY track. */
const BASS = [58.27, 0, 58.27, 58.27, 0, 58.27, 0, 69.3, 58.27, 0, 58.27, 58.27, 0, 51.91, 0, 51.91];
function sched() {
  if (!AU.ctx || !AU.music) return;
  const spb = 60 / 145 / 4;
  if (AU.next < AU.ctx.currentTime) AU.next = AU.ctx.currentTime + 0.05;
  while (AU.next < AU.ctx.currentTime + 0.15) {
    const s = AU.step % 16, t = AU.next;
    if (s % 4 === 0) tone(130, 0.14, 'sine', 0.5, 42, t);
    if (s % 4 === 2) hiss(0.04, 0.07, t, 7000);
    if (BASS[s]) tone(BASS[s] * 2, spb * 0.9, 'square', 0.05, null, t);
    AU.step++; AU.next += spb;
  }
}

/* ---------- game state ---------- */
let state = 'title', G = null, T = 0, cardT = 0, prevFit = 0, flash = 0, shake = 0, btns = [], best = null, endT = 0, paused = false;
try { best = JSON.parse(localStorage.getItem('gc-best') || 'null'); } catch (e) {}
const input = { held: false, buf: 0 };
const BOT = Q.has('bot'), TS = +Q.get('ts') || 1;

function newRun(lvl = 0) {
  G = { lvl, clock: CLOCK, usb: 0, usbAll: 0, selfies: 0, donuts: 0, parts: [], ents: [], dist: 0,
    p: { x: 0, y: 0, vy: 0, air: false, energy: 1, selfie: 0, inv: 0, ph: 0, snapped: false } };
  loadLevel(lvl);
}
function loadLevel(i) {
  G.lvl = i; G.ents = buildLevel(i); G.usbAll += G.ents.filter(e => e.t === 'usb').length;
  Object.assign(G.p, { x: 0, y: 0, vy: 0, air: false, selfie: 0, inv: 0 });
  G.parts = [];
}
const totalLen = LEVELS.reduce((a, l) => a + l.len, 0);
const progress = () => (LEVELS.slice(0, G.lvl).reduce((a, l) => a + l.len, 0) + Math.min(G.p.x, LEVELS[G.lvl].len)) / totalLen;
const speedOf = p => p.selfie > 0 ? 0 : 66 + 52 * Math.sqrt(p.energy);
const say = (s, x, y, c = CREAM) => G.parts.push({ s, x, y, c, t: 0 });

function step(dt) {
  const p = G.p, L = LEVELS[G.lvl];
  G.clock -= dt;
  if (G.clock <= 0) { G.clock = 0; return finish('lose'); }
  if (G.clock < 10 && Math.floor(G.clock) !== Math.floor(G.clock + dt)) SFX.tick();
  p.energy = Math.max(0, p.energy - dt / 20);
  p.inv = Math.max(0, p.inv - dt);
  input.buf = Math.max(0, input.buf - dt);
  if (BOT) botThink();
  if (p.selfie > 0) {
    p.selfie -= dt;
    if (!p.snapped && p.selfie < 0.7) { p.snapped = true; flash = 0.1; SFX.snap(); }
    if (p.selfie <= 0) { p.inv = 0.8; p.snapped = false; }
  } else if (input.buf > 0 && !p.air) { p.vy = 310; p.air = true; input.buf = 0; SFX.jump(); }
  if (p.air) {
    if (!input.held && p.vy > 200) p.vy = 200;
    p.vy -= 950 * dt; p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.air = false; }
  }
  const v = speedOf(p);
  p.x += v * dt; p.ph += v * dt / 50 * TAU;
  for (const e of G.ents) {
    const dx = e.x - p.x;
    if (dx < -80 || dx > 420) continue;
    if (e.t === 'fan') {
      e.ph += dt * 4;
      if (e.sel > 0) { e.sel -= dt; continue; }
      if (e.done) continue;
      if (e.mode === 'walk') e.x -= 22 * dt;
      if (e.mode === 'rush') { if (dx < 150) e.act = true; if (e.act) e.x -= 60 * dt; }
      if (p.inv <= 0 && p.selfie <= 0 && Math.abs(dx) < 9 && p.y < 23) {
        e.done = true; e.sel = 1.25; e.x = p.x + 12; p.selfie = 1.25; G.selfies++; shake = REDUCED ? 0 : 0.2;
        SFX.oops(); say('SELFIE!', p.x, 50, PINK);
      }
    } else if (!e.got && Math.abs(dx) < 11 && p.y < e.y + 7 && p.y + 30 > e.y - 7) {
      e.got = true;
      if (e.t === 'usb') { G.usb++; SFX.usb(); }
      else { p.energy = Math.min(1, p.energy + 0.45); G.donuts++; SFX.donut(); say('REFUEL', p.x, 48, GOLD); }
    }
  }
  for (const q of G.parts) q.t += dt;
  G.parts = G.parts.filter(q => q.t < 0.9);
  if (p.x >= L.len) {
    if (G.lvl < LEVELS.length - 1) { prevFit = L.fit; state = 'card'; cardT = 0; AU.music = false; loadLevel(G.lvl + 1); }
    else finish(G.usb ? 'win' : 'nousb');
  }
}
function botThink() {
  const p = G.p; if (p.air || p.selfie > 0) return;
  const v = speedOf(p);
  for (const e of G.ents) {
    const dx = e.x - p.x; if (dx < 0 || dx > 160 || e.done || e.got) continue;
    const close = v + (e.t === 'fan' ? (e.mode === 'walk' ? 22 : e.mode === 'rush' ? 60 : 0) : 0);
    if (e.t === 'fan' || (e.t === 'donut' && e.y > 30)) { if (dx / close < 0.3) { input.buf = 0.1; input.held = true; } return; }
  }
}
function finish(kind) {
  state = kind; endT = 0; AU.music = false;
  if (kind === 'lose') SFX.lose(); else {
    SFX.win();
    if (!best || G.usb > best.usb || (G.usb === best.usb && G.clock > best.spare)) { best = { usb: G.usb, spare: Math.round(G.clock * 10) / 10 }; try { localStorage.setItem('gc-best', JSON.stringify(best)); } catch (e) {} }
  }
}

/* ---------- drawing ---------- */
const big = (img, x, y, sc, flip) => {
  x = Math.round(x); y = Math.round(y);
  if (flip) { cx.save(); cx.translate(x + img.width * sc, y); cx.scale(-1, 1); cx.drawImage(img, 0, 0, img.width * sc, img.height * sc); cx.restore(); }
  else cx.drawImage(img, x, y, img.width * sc, img.height * sc);
};
const shadow = (x, w = 12) => { cx.fillStyle = 'rgba(11,8,32,.35)'; cx.fillRect(Math.round(x - w / 2), gy + 1, w, 2); cx.fillRect(Math.round(x - w / 2) + 2, gy + 3, w - 4, 1); };
const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function button(label, x, y, w, h, fn, primary) {
  cx.fillStyle = INK; cx.fillRect(x + 2, y + 2, w, h);
  cx.fillStyle = primary ? CREAM : '#2a1848'; cx.fillRect(x, y, w, h);
  cx.fillStyle = primary ? '#ffffff' : '#4a2f78'; cx.fillRect(x, y, w, 1);
  cx.fillStyle = primary ? '#c9b48f' : '#170d29'; cx.fillRect(x, y + h - 2, w, 2);
  text(label, x + w / 2, y + Math.floor((h - 7) / 2) - 1, 1, primary ? INK : CREAM, 0.5, null);
  btns.push({ x, y, w, h, fn });
}
function playerSprite(p, fit) {
  const D = DUDE[fit];
  if (p.selfie > 0) return D.peace;
  if (p.air) return p.vy > 0 ? D.up : D.down;
  return D.run[Math.floor(p.ph / TAU * RUN_N) % RUN_N];
}
function drawPlay() {
  const p = G.p, L = LEVELS[G.lvl], px = Math.round(W * (W > 280 ? 0.24 : 0.2));
  let cam = p.x - px;
  const sh = shake > 0 ? Math.round(Math.sin(T * 90) * 2) : 0;
  cx.save(); cx.translate(sh, 0);
  const bg = drawWorld(G.lvl, cam, T);
  const X = wx => Math.round(wx - cam);
  if (G.lvl === 2) drawBar(L, bg, X(L.len - DOOR), T);
  else {   // road sign at the end of the level
    const sx = X(L.len - 20); cx.fillStyle = '#17121d'; cx.fillRect(sx, gy - 46, 2, 46);
    cx.fillStyle = '#1f6b4a'; cx.fillRect(sx - 24, gy - 60, 50, 16); cx.fillStyle = CREAM; cx.fillRect(sx - 24, gy - 60, 50, 1); cx.fillRect(sx - 24, gy - 45, 50, 1);
    text('SUNBAR >', sx + 1, gy - 56, 1, CREAM, 0.5, null);
  }
  for (const e of G.ents) {
    const sx = X(e.x); if (sx < -30 || sx > W + 30) continue;
    if (e.t === 'fan') {
      const F = FAN[e.v]; shadow(sx);
      const img = e.sel > 0 ? F.selfie : e.mode === 'stand' || (e.mode === 'rush' && !e.act) || e.done ? F.idle[Math.floor(e.ph / 2) % 2] : F.run[Math.floor(e.ph * (e.mode === 'rush' ? 2 : 1)) % RUN_N];
      big(img, sx - 16, gy - GROUND - 1, 1, true);
      if (e.sel > 0 || e.done) cx.drawImage(HEART, sx - 4, gy - 52 - Math.round(Math.abs(Math.sin(e.ph)) * 3));
      else if (e.mode === 'rush' && e.act) cx.drawImage(BANG, sx - 2, gy - 52);
    } else if (!e.got) {
      const bob = Math.round(Math.sin(T * 5 + e.x * 0.05) * 1.5), img = e.t === 'usb' ? USB : DONUT;
      cx.drawImage(img, sx - (img.width >> 1), gy - e.y - (img.height >> 1) + bob);
    }
  }
  // player
  const fit = L.fit, img = playerSprite(p, fit);
  shadow(px, p.air ? 8 : 12);
  if (!(p.inv > 0 && Math.floor(T * 14) % 2)) cx.drawImage(img, px - 16, gy - GROUND - 1 - Math.round(p.y));
  for (const q of G.parts) text(q.s, X(q.x), gy - q.y - q.t * 26, 1, q.c, 0.5);
  drawFore(G.lvl, cam);
  cx.restore();
  if (flash > 0) { cx.fillStyle = 'rgba(255,244,230,.5)'; cx.fillRect(0, 0, W, H); }
  drawHUD();
}
function drawHUD() {
  const p = G.p, x0 = 6 + safe.l, y0 = 6 + safe.t, low = G.clock < 10;
  text('SET IN', x0, y0, 1, '#c9b6e6');
  text(fmt(G.clock), x0, y0 + 10, 2, low && Math.floor(T * 2.5) % 2 ? RED : CREAM);
  // energy
  const ex = x0 + 62, bw = Math.min(56, W - ex - 64 - safe.r);
  cx.drawImage(DONUT, ex, y0 + 9);
  cx.fillStyle = INK; cx.fillRect(ex + 15, y0 + 11, bw + 2, 8);
  cx.fillStyle = '#2a1848'; cx.fillRect(ex + 16, y0 + 12, bw, 6);
  cx.fillStyle = p.energy < 0.25 ? (Math.floor(T * 2.5) % 2 ? RED : '#7a2a55') : GOLD; cx.fillRect(ex + 16, y0 + 12, Math.round(bw * p.energy), 6);
  cx.fillStyle = 'rgba(11,8,32,.5)'; for (let i = 1; i < 7; i++) cx.fillRect(ex + 16 + Math.round(bw * i / 7), y0 + 12, 1, 6);
  if (p.energy < 0.25) text('REFUEL', ex + 16, y0, 1, RED);
  // usb + pause
  const rx = W - 6 - safe.r;
  cx.fillStyle = INK; cx.fillRect(rx - 13, y0 - 1, 14, 14); cx.fillStyle = CREAM; cx.fillRect(rx - 9, y0 + 2, 2, 8); cx.fillRect(rx - 5, y0 + 2, 2, 8);
  btns.push({ x: rx - 22, y: 0, w: 28 + safe.r, h: y0 + 22, fn: () => { paused = true; AU.music = false; } });
  text(String(G.usb), rx - 20, y0 + 3, 1, CREAM, 1); cx.drawImage(USB, rx - 20 - textW(String(G.usb)) - 12, y0 - 1);
  // route
  const by = y0 + 30, bx = x0, bw2 = W - x0 - 6 - safe.r;
  cx.fillStyle = INK; cx.fillRect(bx - 1, by - 1, bw2 + 2, 4); cx.fillStyle = '#3a2760'; cx.fillRect(bx, by, bw2, 2);
  cx.fillStyle = PINK; cx.fillRect(bx, by, Math.round(bw2 * progress()), 2);
  let acc = 0; for (const l of LEVELS.slice(0, -1)) { acc += l.len; cx.fillStyle = CREAM; cx.fillRect(bx + Math.round(bw2 * acc / totalLen), by - 1, 1, 4); }
  cx.fillStyle = CREAM; cx.fillRect(bx + Math.round(bw2 * progress()) - 1, by - 2, 3, 6);
  text('L' + (G.lvl + 1), bx, by + 6, 1, '#c9b6e6'); text('SUNBAR', bx + bw2, by + 6, 1, '#c9b6e6', 1);
}
function drawTitle() {
  const cam = T * 40, bg = drawWorld(0, cam, T), px = Math.round(W * 0.24);
  shadow(px); cx.drawImage(DUDE[0].run[Math.floor(T * 10) % RUN_N], px - 16, gy - GROUND - 1);
  const fx = px + 70 + (1 - (T * 0.35 % 1)) * 60; shadow(fx); big(FAN[0].run[Math.floor(T * 8) % RUN_N], fx - 16, gy - GROUND - 1, 1, false);
  drawFore(0, cam);
  const sc = W >= 300 ? 4 : 3, ty = Math.max(18 + safe.t, Math.round(gy * 0.16));
  text('GRLS CRY', W / 2, ty, sc, CREAM, 0.5, '#7a2a55');
  text('RUN TO SUNBAR', W / 2, ty + sc * 7 + 6, 1 + (W >= 300), PINK, 0.5);
  const ly = ty + sc * 7 + 6 + (W >= 300 ? 26 : 18), lx = Math.round(W / 2 - 52);
  cx.drawImage(USB, lx, ly - 2); text('GRAB THE USBS', lx + 16, ly + 2, 1);
  cx.drawImage(DONUT, lx - 2, ly + 15); text('DONUTS = PACE', lx + 16, ly + 17, 1);
  cx.drawImage(HEART, lx, ly + 30); text('JUMP THE SELFIES', lx + 16, ly + 31, 1);
  const hy = H - gy > 100 ? gy + 50 : ly + 48;
  if (Math.floor(T * 1.6) % 2) text(('ontouchstart' in window) ? 'TAP TO RUN' : 'TAP OR PRESS SPACE', W / 2, hy, 1, CREAM, 0.5);
  text('HOLD FOR A HIGHER JUMP', W / 2, hy + 12, 1, '#c9b6e6', 0.5);
  if (best && H - gy > 100) text('BEST ' + best.usb + ' USBS, ' + fmt(best.spare) + ' EARLY', W / 2, hy + 26, 1, GOLD, 0.5);
  const bw = 74, by = H - 22 - safe.b;
  button('SOUND ' + (AU.on ? 'ON' : 'OFF'), 6 + safe.l, by, bw, 16, () => setSound(!AU.on));
  button('GRLSCRY.COM', W - 6 - safe.r - bw, by, bw, 16, () => { location.href = '/'; });
}
function drawCard() {
  const L = LEVELS[G.lvl];
  cx.fillStyle = INK; cx.fillRect(0, 0, W, H);
  const bg = BG[G.lvl] || (BG[G.lvl] = buildBG(G.lvl));
  cx.globalAlpha = 0.5; cx.drawImage(bg.sky, 0, 0); cx.globalAlpha = 1;
  cx.fillStyle = INK; cx.fillRect(0, gy, W, H - gy);
  const sc = H > 300 ? 4 : 2, sw = CW * sc, cy = Math.round(H * 0.5), swapped = cardT > 0.7;
  text('LEVEL ' + (G.lvl + 1), W / 2, cy - CH * sc / 2 - 34, 2, CREAM, 0.5);
  text(L.n, W / 2, cy - CH * sc / 2 - 14, 1, PINK, 0.5);
  cx.fillStyle = 'rgba(11,8,32,.45)'; cx.fillRect(Math.round(W / 2 - sw * 0.3), cy + CH * sc / 2 - sc * 2, Math.round(sw * 0.6), sc * 2);
  big(DUDE[swapped ? L.fit : prevFit].stand, W / 2 - sw / 2, cy - CH * sc / 2, sc);
  if (cardT > 0.6 && cardT < 0.95 && !REDUCED) { cx.fillStyle = CREAM; const r = Math.round((cardT - 0.6) * 160); for (let a = 0; a < 8; a++) cx.fillRect(Math.round(W / 2 + Math.cos(a * PI / 4) * r), Math.round(cy + Math.sin(a * PI / 4) * r), sc, sc); }
  if (swapped) { text('FIT CHANGE', W / 2, cy + CH * sc / 2 + 8, 1, '#c9b6e6', 0.5); text(FITS[L.fit].name, W / 2, cy + CH * sc / 2 + 20, 1, GOLD, 0.5); }
  text('SET IN ' + fmt(G.clock), W / 2, cy + CH * sc / 2 + 38, 1, CREAM, 0.5);
  if (cardT > 1.1 && Math.floor(T * 1.6) % 2) text('TAP TO RUN', W / 2, Math.min(H - 16 - safe.b, cy + CH * sc / 2 + 56), 1, CREAM, 0.5);
}
function drawEnd() {
  const lose = state === 'lose', nousb = state === 'nousb', tall = H > 300, sc = tall ? 4 : 2;
  cx.fillStyle = '#100820'; cx.fillRect(0, 0, W, H);
  const top = 12 + safe.t + (tall && !lose ? Math.max(0, Math.round((H - (150 + 46 * (W >= 240 ? 4 : 3))) * 0.4)) : 0);
  if (lose) {
    const bg = BG[2] || (BG[2] = buildBG(2)); cx.globalAlpha = 0.6; cx.drawImage(bg.sky, 0, 0); cx.globalAlpha = 1;
    cx.fillStyle = INK; cx.fillRect(0, gy, W, H - gy);
    text('LATE.', W / 2, top + 6, 3, RED, 0.5);
    text('SET TIME CAME AND WENT.', W / 2, top + 34, 1, CREAM, 0.5);
    big(DUDE[LEVELS[G.lvl].fit].stand, W / 2 - CW * sc / 2, gy - GROUND * sc - sc, sc);
    text(Math.round(progress() * 100) + '% OF THE WAY TO SUNBAR', W / 2, gy + 10, 1, '#c9b6e6', 0.5);
  } else {
    // the booth, side on like the Sunbar photos
    const u = tall ? (W >= 240 ? 4 : 3) : 2, floor = top + (tall ? 40 : 30) + 46 * u, mx = Math.round(W / 2);
    for (let x = 0; x < W; x += 9) { cx.fillStyle = (x / 9) % 2 ? '#2a1848' : '#22143a'; cx.fillRect(x, 0, 8, floor); }
    cx.fillStyle = 'rgba(255,90,160,.10)'; cx.fillRect(0, floor - 30 * u, W, 30 * u); cx.fillStyle = 'rgba(255,90,160,.12)'; cx.fillRect(0, floor - 14 * u, W, 14 * u);
    cx.lineWidth = 1; [[-20, -34, PINK], [-11, -26, '#ffb36b'], [12, -36, CREAM], [21, -28, PINK], [3, -30, '#ffb36b']].forEach(([dx, dy, c]) => { cx.strokeStyle = c; hexPath(cx, mx + dx * u, floor + dy * u, 5 * u); cx.stroke(); });
    big(DUDE[FINAL].dj, mx - 27 * u, floor - 39 * u, u);
    const tx = mx - 9 * u, tw = 34 * u, ty = floor - 16 * u;
    cx.fillStyle = '#0c071a'; cx.fillRect(tx, ty, tw, 16 * u); cx.fillStyle = '#1b1030'; cx.fillRect(tx + u, ty + 2 * u, tw - 2 * u, 14 * u);
    [[1, 10], [12, 8], [21, 10]].forEach(([gx, gw], k) => {
      cx.fillStyle = '#e9e6ee'; cx.fillRect(tx + gx * u, ty - 3 * u, gw * u, 3 * u);
      cx.fillStyle = '#a9a4b5'; cx.fillRect(tx + gx * u, ty - u, gw * u, u);
      cx.fillStyle = k === 1 ? PINK : '#3a3344'; cx.fillRect(tx + (gx + 2) * u, ty - 4 * u, (gw - 4) * u, u);
    });
    if (!nousb) cx.drawImage(USB, tx + 22 * u, ty - 4 * u - 12, USB.width * (u > 2 ? 2 : 1), USB.height * (u > 2 ? 2 : 1));
    for (let i = 0; i < W / (7 * u) + 1; i++) {
      const b = Math.round(Math.abs(Math.sin(T * 5 + i * 1.7)) * 2) * u, x = Math.round(i * 7 * u - 3 * u), y = floor - 5 * u - (i % 3) * u - b;
      cx.fillStyle = i % 2 ? '#07051a' : '#0f0926';
      cx.fillRect(x, y, 6 * u, floor - y); cx.fillRect(x + u, y - u, 4 * u, u); cx.fillRect(x + 2 * u, y - 4 * u, 2 * u, 3 * u); cx.fillRect(x + 1.5 * u, y - 3.5 * u, 3 * u, 2 * u);
      if (i % 3 !== 2) { cx.fillRect(x, y - 6 * u, u, 6 * u); cx.fillRect(x + 5 * u, y - 5 * u, u, 5 * u); }
      if (i % 4 === 1) { cx.fillRect(x + 4.5 * u, y - 7 * u, 2 * u, 2 * u); cx.fillStyle = '#9fe8ff'; cx.fillRect(x + 5 * u, y - 6.5 * u, u, u); }
    }
    cx.fillStyle = '#07051a'; cx.fillRect(0, floor, W, H - floor);
    text(nousb ? 'NO USB.' : 'YOU MADE IT', W / 2, top + 4, nousb ? 3 : 2, nousb ? RED : CREAM, 0.5);
    text(nousb ? 'YOU MADE IT. YOUR MUSIC DIDN\'T.' : 'SET TIME. SUNBAR IS YOURS.', W / 2, top + (nousb ? 30 : 22), 1, PINK, 0.5);
    const sy = floor + (tall ? 10 : 5);
    text(G.usb + '/' + G.usbAll + ' USBS   ' + fmt(G.clock) + ' EARLY', W / 2, sy, 1, GOLD, 0.5);
    if (tall) text(G.selfies + ' SELFIE' + (G.selfies === 1 ? '' : 'S') + '   ' + G.donuts + ' DONUT' + (G.donuts === 1 ? '' : 'S'), W / 2, sy + 11, 1, '#c9b6e6', 0.5);
  }
  if (endT > 0.7) {
    const side = W >= 260, bw = side ? 110 : Math.min(150, W - 24), bh = 24;
    const by = Math.min(H - (side ? bh : bh * 2 + 6) - 10 - safe.b, lose ? gy + 28 : top + 40 + 46 * (tall ? (W >= 240 ? 4 : 3) : 2) + 40);
    button('RUN IT BACK', side ? W / 2 - bw - 4 : Math.round(W / 2 - bw / 2), by, bw, bh, start, true);
    button('SEE THE SHOWS', side ? W / 2 + 4 : Math.round(W / 2 - bw / 2), side ? by : by + bh + 6, bw, bh, () => { location.href = '/#events'; });
  }
}
function drawPause() {
  cx.fillStyle = 'rgba(11,8,32,.78)'; cx.fillRect(0, 0, W, H);
  const bw = 120, x = Math.round(W / 2 - bw / 2), y = Math.round(H / 2 - 50);
  text('PAUSED', W / 2, y - 22, 2, CREAM, 0.5);
  button('KEEP RUNNING', x, y, bw, 24, () => { paused = false; AU.music = true; }, true);
  button('SOUND ' + (AU.on ? 'ON' : 'OFF'), x, y + 30, bw, 24, () => setSound(!AU.on));
  button('BACK TO GRLSCRY.COM', x, y + 60, bw, 24, () => { location.href = '/'; });
}

/* ---------- loop ---------- */
function start() { newRun(Math.min(2, Math.max(0, (+Q.get('lvl') || 1) - 1))); state = 'play'; paused = false; AU.music = true; AU.step = 0; }
let lastT = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
  btns = [];
  if (!paused) {
    T += dt; flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt);
    if (state === 'play') { acc += dt * TS; while (acc >= 1 / 120 && state === 'play') { step(1 / 120); acc -= 1 / 120; } }
    else if (state === 'card') { cardT += dt * TS; if (BOT && cardT > 1.3) { state = 'play'; AU.music = true; } }
    else endT += dt;
  }
  cx.imageSmoothingEnabled = false;
  if (state === 'title') drawTitle();
  else if (state === 'play') drawPlay();
  else if (state === 'card') drawCard();
  else drawEnd();
  if (paused) drawPause();
}

/* ---------- input ---------- */
function press(x, y) {
  audioInit();
  if (x != null) for (const b of btns.slice().reverse()) if (x >= b.x && x <= b.x + b.w && y >= b.y - 4 && y <= b.y + b.h + 4) { b.fn(); return; }
  if (paused) return;
  if (state === 'title') start();
  else if (state === 'play') { input.held = true; input.buf = 0.12; }
  else if (state === 'card') { if (cardT > 1.1) { state = 'play'; AU.music = true; } }
  else if (x == null && endT > 0.7) start();
}
cv.addEventListener('pointerdown', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); press((e.clientX - r.left) / S, (e.clientY - r.top) / S); });
addEventListener('pointerup', () => { input.held = false; });
addEventListener('pointercancel', () => { input.held = false; });
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) press(); }
  else if (e.code === 'KeyM') setSound(!AU.on);
  else if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'play') { paused = !paused; AU.music = !paused; }
});
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.held = false; });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') { paused = true; AU.music = false; } });
addEventListener('blur', () => { if (state === 'play' && !BOT) { paused = true; AU.music = false; } });

function resize() {
  if (Q.has('sheet')) return;
  const vw = innerWidth, vh = innerHeight, f = Math.min(vw / 180, vh / 170);
  S = f >= 2 ? Math.floor(f) : Math.max(1, f);
  W = Math.ceil(vw / S); H = Math.ceil(vh / S);
  cv.width = W; cv.height = H; cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  gy = H < 260 ? H - 30 : Math.round(H * 0.64);
  const cs = getComputedStyle(document.getElementById('safe')), n = k => Math.ceil((parseFloat(cs[k]) || 0) / S);
  safe = { t: n('paddingTop'), r: n('paddingRight'), b: n('paddingBottom'), l: n('paddingLeft') };
  for (const k in BG) delete BG[k];
}
addEventListener('resize', resize); addEventListener('orientationchange', resize);

/* ---------- sprite sheet (debug + the outfit line-up) ---------- */
function sheet() {
  const sc = 4, rows = [...DUDE.map((d, i) => [FITS[i].name, [d.stand, ...d.run, d.up, d.down, d.peace]]), ...FAN.map((f, i) => ['FAN ' + (i + 1), [...f.idle, ...f.run, f.selfie]])];
  cv.width = 20 + 12 * CW * sc; cv.height = rows.length * (CH * sc + 14) + 70; cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
  document.body.style.position = 'static'; document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto';
  cx.imageSmoothingEnabled = false; cx.fillStyle = '#5b3380'; cx.fillRect(0, 0, cv.width, cv.height);
  rows.forEach(([n, fr], j) => { text(n, 8, j * (CH * sc + 14) + 4, 1); fr.forEach((f, i) => big(f, 8 + i * CW * sc, j * (CH * sc + 14) + 12, sc)); });
  const y = rows.length * (CH * sc + 14) + 6;
  big(USB, 10, y, sc); big(DONUT, 70, y, sc); big(HEART, 140, y, sc); big(BANG, 200, y, sc);
  text('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 :.,!?-+\'/><%', 240, y + 6, 2); text('GRLS CRY ×12', 240, y + 30, 3);
}

if (Q.has('sheet')) sheet();
else {
  resize();
  if (BOT) { start(); }
  const end = Q.get('end');
  if (end) { newRun(); G.lvl = 2; G.usb = end === 'nousb' ? 0 : 31; G.usbAll = 58; G.clock = end === 'lose' ? 0 : 11.4; G.selfies = 2; G.donuts = 9; G.p.x = 1400; BG[2] = buildBG(2); state = end; endT = 1; }
  window.__gc = { get state() { return state; }, get G() { return G; }, get paused() { return paused; } };
  requestAnimationFrame(frame);
}
})();
