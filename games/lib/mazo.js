// Mazos compartidos por los juegos de cartas. Cada mazo vive en public/cartas/<carpeta>/mazo.json
// y se identifica como "<carpeta>-<variante>", por ejemplo "espanola-40".
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..', '..', 'public', 'cartas');
const cache = {};

function load(id) {
  id = String(id);
  if (!/^[a-z0-9]+-\d+$/.test(id)) return null;
  if (cache[id]) return cache[id];
  const [carpeta, variante] = id.split('-');
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(BASE, carpeta, 'mazo.json'), 'utf8')); } catch { return null; }
  const vals = m.variantes && m.variantes[variante];
  if (!vals) return null;
  return (cache[id] = { id, carpeta, ext: m.ext, dorso: m.dorso, imagenes: !!m.imagenes, palos: m.palos,
    valores: m.valores.filter(v => vals.includes(v.id)) });
}
const crear = mz => mz.palos.flatMap(p => mz.valores.map(v => ({ id: `${p.id}-${v.id}`, p: p.id, v: v.id })));
function mezclar(cartas) {
  const a = [...cartas];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function repartir(cartas, ids) {
  const manos = {};
  ids.forEach(i => (manos[i] = []));
  cartas.forEach((c, i) => manos[ids[i % ids.length]].push(c));
  return manos;
}
module.exports = { load, crear, mezclar, repartir };
