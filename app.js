
const state = { points: [], filter: 'all' };

async function init() {
  const response = await fetch('./points.json');
  state.points = await response.json();
  render();
  restoreAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

function render() {
  const list = document.getElementById('points');
  list.innerHTML = '';
  const visible = state.points.filter(p => {
    if (state.filter === 'all') return true;
    if (state.filter === 'public') return p.access === 'public';
    if (state.filter === 'restricted') return p.access === 'restricted';
    if (state.filter === 'approx') return p.accuracy === 'approx';
    return true;
  });

  for (const p of visible) {
    const isPublic = p.access === 'public';
    const apple = isPublic
      ? `https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=d`
      : `https://maps.apple.com/?q=${p.lat},${p.lon}`;
    const google = isPublic
      ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;

    const article = document.createElement('article');
    article.className = 'point';
    article.innerHTML = `
      <div class="point-head">
        <span class="num">${p.id}</span>
        <div><h2>${escapeHtml(p.name)}</h2><p class="meta">${escapeHtml(p.type)}</p></div>
      </div>
      <div class="chips">
        <span class="chip">${isPublic ? 'öffentlich' : 'nicht öffentlich'}</span>
        <span class="chip">${p.accuracy === 'verified' ? 'belegt' : 'Näherungswert'}</span>
      </div>
      <p><strong>GPS:</strong> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</p>
      <div class="actions">
        <a class="btn primary" href="${apple}">${isPublic ? 'Apple Karten: Navigation' : 'Apple Karten: nur anzeigen'}</a>
        <a class="btn" href="${google}">${isPublic ? 'Google Maps: Navigation' : 'Google Maps: nur anzeigen'}</a>
      </div>
      <details>
        <summary>Vor-Ort-Prüfung</summary>
        ${check('position','Position stimmt ungefähr')}
        ${check('route','Zufahrt entspricht dem roten Weg')}
        ${check('parking','Abstellfläche ist gekennzeichnet')}
        ${check('fire','Keine Sperrung / keine Waldbrandstufe 5')}
        <textarea class="note" data-field="note" placeholder="Datum, Schild, Schranke, Wegzustand, korrigierte GPS-Koordinate …"></textarea>
        <button class="save" type="button">Prüfung speichern</button><span class="saved" aria-live="polite"></span>
      </details>`;
    article.dataset.id = p.id;
    article.querySelector('.save').addEventListener('click', () => savePoint(article));
    list.appendChild(article);
  }
}

function check(field,label){
  return `<label><input type="checkbox" data-field="${field}"> ${label}</label>`;
}

function savePoint(article){
  const data = {};
  article.querySelectorAll('[data-field]').forEach(el => {
    data[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value;
  });
  localStorage.setItem(`bode-point-${article.dataset.id}`, JSON.stringify(data));
  const saved = article.querySelector('.saved');
  saved.textContent = 'Gespeichert';
  setTimeout(()=> saved.textContent='', 1500);
}

function restoreAll(){
  document.querySelectorAll('.point').forEach(article => {
    const raw = localStorage.getItem(`bode-point-${article.dataset.id}`);
    if (!raw) return;
    const data = JSON.parse(raw);
    article.querySelectorAll('[data-field]').forEach(el => {
      if (!(el.dataset.field in data)) return;
      if (el.type === 'checkbox') el.checked = data[el.dataset.field];
      else el.value = data[el.dataset.field];
    });
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    render();
    restoreAll();
  });
});

window.addEventListener('DOMContentLoaded', init);
