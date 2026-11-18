// Componente reutilizable para juegos de cartas: imágenes, dorsos y mano con selección.
// Uso: Cartas.init({ redraw, play }); Cartas.mano(mazo, cartas, activa) devuelve el HTML de la mano.
const Cartas = (() => {
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let sel = null, scroll = 0, centrar = false, redraw = () => {}, play = () => {};

  const label = (m, c) => {
    const v = m.valores.find(x => x.id === c.v), p = m.palos.find(x => x.id === c.p);
    return `${v ? v.etiqueta : c.v} de ${p ? p.nombre : c.p}`;
  };
  const texto = t => { const s = document.createElement('span'); s.className = 'carta ctexto'; s.textContent = t; return s; };
  // Imagen de la carta; si falta el archivo (o el mazo no tiene imágenes) se muestra el texto.
  const img = (m, c, cls = 'carta') => m.imagenes
    ? `<img class="${cls}" src="/cartas/${m.carpeta}/${c.id}.${m.ext}" alt="${esc(label(m, c))}" loading="lazy" onerror="this.replaceWith(Cartas.texto(this.alt))">`
    : `<span class="${cls} ctexto">${esc(label(m, c))}</span>`;
  const dorsos = (m, n) => `<div class="row">${Array.from({ length: Math.min(n, 20) }, () => m.imagenes && m.dorso
    ? `<img class="carta chica" src="/cartas/${m.carpeta}/${m.dorso}" alt="Carta boca abajo">` : '<span class="back"></span>').join('')}</div>`;

  // Mano con scroll horizontal. Tocar una carta la levanta, bloquea el scroll y muestra "Jugar";
  // tocarla de nuevo la baja; tocar otra visible cambia la selección.
  const mano = (m, cartas, activa) => {
    if (!activa || !cartas.some(c => c.id === sel)) sel = null;
    return `<div class="mano${sel ? ' bloqueada' : ''}">${cartas.map(c => `<div class="cw${c.id === sel ? ' sel' : ''}">
      <button class="cb" ${activa ? '' : 'disabled'} aria-pressed="${c.id === sel}" aria-label="${esc(label(m, c))}" onclick="Cartas.tap('${c.id}')">${img(m, c)}</button>
      ${c.id === sel ? '<button class="jugar" onclick="Cartas.jugar()">Jugar</button>' : ''}</div>`).join('')}</div>`;
  };
  const tap = id => { sel = sel === id ? null : id; centrar = !!sel; redraw(); };
  const jugar = () => { const id = sel; sel = null; if (id) play(id); };

  // La pantalla se redibuja entera con cada novedad del servidor: se conserva la posición del scroll.
  const guardar = () => { const e = document.querySelector('.mano'); scroll = e ? e.scrollLeft : 0; };
  const restaurar = () => {
    const e = document.querySelector('.mano');
    if (!e) return;
    e.scrollLeft = scroll;
    const c = centrar && e.querySelector('.sel');
    centrar = false;
    if (c) { e.scrollLeft = c.offsetLeft - (e.clientWidth - c.offsetWidth) / 2; scroll = e.scrollLeft; }
  };
  const init = o => { redraw = o.redraw; play = o.play; };
  return { label, texto, img, dorsos, mano, tap, jugar, guardar, restaurar, init };
})();
