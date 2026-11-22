const NS = 'http://www.w3.org/2000/svg';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

/* Jeden odcisk łapki: x, y, kąt (stopnie, 0 = palce do góry), rozmiar */
function makePrint(layer, x, y, angle, size, opacity = 1) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', '#paw');
  use.setAttribute('x', -size / 2);
  use.setAttribute('y', -size * 0.6);
  use.setAttribute('width', size);
  use.setAttribute('height', size * 1.2);
  use.setAttribute('class', 'print');
  use.dataset.opacity = opacity;
  g.append(use);
  layer.append(g);
  return use;
}

function stepIn(use, delay) {
  const target = +use.dataset.opacity;
  if (reduced) { use.style.opacity = target; return; }
  use.animate(
    [
      { opacity: 0, transform: 'scale(1.35)' },
      { opacity: target, transform: 'scale(1)' }
    ],
    { duration: 260, delay, easing: 'ease-out', fill: 'forwards' }
  );
  use.style.transformBox = 'fill-box';
  use.style.transformOrigin = 'center';
}

/* Punkty na krzywej Béziera, rozłożone co ~step px */
function bezierPoints(p0, p1, p2, p3, step) {
  const pt = (t) => {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  };
  const out = [];
  let prev = pt(0), acc = step;
  for (let i = 1; i <= 600; i++) {
    const p = pt(i / 600);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    if (acc >= step) {
      out.push({ ...p, angle: Math.atan2(p.y - prev.y, p.x - prev.x) });
      acc = 0;
    }
    prev = p;
  }
  return out;
}

/* Tropy wzdłuż listy punktów – na zmianę lewa i prawa łapa */
function walk(layer, points, { size, spread, opacity = 1 }) {
  return points.map((p, i) => {
    const side = i % 2 ? 1 : -1;
    const nx = -Math.sin(p.angle) * spread * side;
    const ny = Math.cos(p.angle) * spread * side;
    const deg = (p.angle * 180) / Math.PI + 90 + side * 6;
    return makePrint(layer, p.x + nx, p.y + ny, deg, size, opacity);
  });
}

/* ---------- SCENA 1 ---------- */
async function intro() {
  const layer = $('#intro-trail');
  const w = window.innerWidth, h = window.innerHeight;
  const small = w < 600;
  const size = small ? 22 : 28;

  // pies wchodzi z lewego dołu, kręci się i dochodzi pod napis
  const pts = bezierPoints(
    { x: -40, y: h * 0.95 },
    { x: w * 0.35, y: h * 1.05 },
    { x: w * 0.15, y: h * 0.55 },
    { x: w * 0.5, y: h * 0.62 },
    small ? 34 : 44
  );
  const pts2 = bezierPoints(
    { x: w * 0.5, y: h * 0.62 },
    { x: w * 0.8, y: h * 0.68 },
    { x: w * 0.95, y: h * 0.25 },
    { x: w + 40, y: h * 0.12 },
    small ? 34 : 44
  );

  const first = walk(layer, pts, { size, spread: size * 0.45 });
  const second = walk(layer, pts2, { size, spread: size * 0.45 });

  await sleep(500);
  first.forEach((u, i) => stepIn(u, i * 170));
  await sleep(first.length * 170 + 200);

  const btn = $('#open-letter');
  btn.disabled = false;
  btn.classList.add('show');

  await sleep(500);
  second.forEach((u, i) => stepIn(u, i * 170));
}

/* ---------- SCENA 2 ---------- */
function sideTrails() {
  const scene = $('#letter-scene');
  const letter = $('.letter');
  const layer = $('#side-trails');
  layer.innerHTML = '';

  const W = scene.clientWidth;
  const H = scene.scrollHeight;
  const lr = letter.getBoundingClientRect();
  const sr = scene.getBoundingClientRect();
  const margin = lr.left - sr.left;

  const roomy = margin > 90;
  const size = roomy ? Math.min(30, margin * 0.22) : 18;
  const opacity = roomy ? 1 : 0.55;
  const amp = roomy ? Math.min(margin * 0.18, 40) : 6;
  const xL = roomy ? margin / 2 : 12;
  const xR = W - xL;
  const step = size * 1.6;

  const prints = [];
  [[xL, 0], [xR, Math.PI]].forEach(([x0, phase], k) => {
    const pts = [];
    let prev = { x: x0, y: -30 };
    for (let y = -30; y < H + 30; y += 2) {
      const p = { x: x0 + Math.sin(y / 180 + phase) * amp, y };
      if (Math.hypot(p.x - prev.x, p.y - prev.y) >= step || y === -30) {
        pts.push({ ...p, angle: Math.atan2(p.y - prev.y, p.x - prev.x) || Math.PI / 2 });
        prev = p;
      }
    }
    walk(layer, pts, { size, spread: size * 0.42, opacity }).forEach((u, i) => {
      prints.push({ u, delay: i * 110 + k * 300 });
    });
  });
  prints.forEach(({ u, delay }) => stepIn(u, delay));
}

async function openLetter() {
  const introEl = $('#intro');
  const scene = $('#letter-scene');

  introEl.classList.add('fading');
  await sleep(600);
  introEl.classList.remove('is-active');
  introEl.setAttribute('aria-hidden', 'true');

  scene.classList.add('is-active', 'letter-scene-in');
  scene.removeAttribute('aria-hidden');
  window.scrollTo(0, 0);

  // poczekaj na czcionkę, bo zmienia wysokość listu
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch (e) {}
  sideTrails();

  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(sideTrails, 250);
  });
}

$('#open-letter').addEventListener('click', (e) => {
  e.currentTarget.disabled = true;
  openLetter();
}, { once: true });

intro();
