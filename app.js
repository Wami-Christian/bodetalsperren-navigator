
const state = { points: [], filter: 'all', activeView: 'parkings' };

async function init() {
  const response = await fetch('./points.json');
  state.points = await response.json();
  bindTabs();
  bindFilters();
  bindSpotForm();
  renderPoints();
  renderSpots();
  restoreAllChecks();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

function bindTabs(){
  document.querySelectorAll('[data-view]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.activeView=btn.dataset.view;
      document.getElementById('parkings-view').classList.toggle('hidden',state.activeView!=='parkings');
      document.getElementById('spots-view').classList.toggle('hidden',state.activeView!=='spots');
    });
  });
}

function bindFilters(){
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      renderPoints();
      restoreAllChecks();
    });
  });
}

function renderPoints() {
  const list = document.getElementById('points');
  list.innerHTML = '';
  const visible = state.points.filter(p => {
    if (state.filter === 'all') return true;
    if (state.filter === 'public') return p.access === 'public';
    if (state.filter === 'restricted') return p.access === 'restricted';
    if (state.filter === 'approx') return p.accuracy === 'approx';
  });
  for (const p of visible) list.appendChild(pointCard(p));
}

function pointCard(p){
  const isPublic=p.access==='public';
  const apple=isPublic?`https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=d`:`https://maps.apple.com/?q=${p.lat},${p.lon}`;
  const google=isPublic?`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving`:`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  const article=document.createElement('article');
  article.className='point'; article.dataset.id=p.id;
  article.innerHTML=`
    <div class="point-head"><span class="num">${p.id}</span><div><h2>${esc(p.name)}</h2><p class="meta">${esc(p.type)}</p></div></div>
    <div class="chips"><span class="chip">${isPublic?'öffentlich':'nicht öffentlich'}</span><span class="chip">${p.accuracy==='verified'?'belegt':'Näherungswert'}</span></div>
    <p><strong>GPS:</strong> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</p>
    <div class="actions"><a class="btn primary" href="${apple}">${isPublic?'Apple Karten: Navigation':'Apple Karten: nur anzeigen'}</a><a class="btn" href="${google}">${isPublic?'Google Maps: Navigation':'Google Maps: nur anzeigen'}</a></div>
    <details><summary>Vor-Ort-Prüfung</summary>
      ${check('position','Position stimmt ungefähr')}${check('route','Zufahrt entspricht dem roten Weg')}${check('parking','Abstellfläche ist gekennzeichnet')}${check('fire','Keine Sperrung / keine Waldbrandstufe 5')}
      <textarea class="note" data-field="note" placeholder="Datum, Schild, Schranke, Wegzustand, korrigierte GPS-Koordinate …"></textarea>
      <button class="primary-button save-check" type="button">Prüfung speichern</button><span class="saved" aria-live="polite"></span>
    </details>`;
  article.querySelector('.save-check').addEventListener('click',()=>saveCheck(article));
  return article;
}

function bindSpotForm(){
  document.getElementById('use-location').addEventListener('click',()=>{
    const status=document.getElementById('location-status');
    if(!navigator.geolocation){status.textContent='GPS wird von diesem Browser nicht unterstützt.';return;}
    status.textContent='Position wird bestimmt …';
    navigator.geolocation.getCurrentPosition(pos=>{
      document.getElementById('spot-lat').value=pos.coords.latitude.toFixed(6);
      document.getElementById('spot-lon').value=pos.coords.longitude.toFixed(6);
      status.textContent=`Position übernommen (Genauigkeit ca. ${Math.round(pos.coords.accuracy)} m).`;
    },err=>{status.textContent='Position konnte nicht bestimmt werden. Bitte Safari-Berechtigung prüfen.';},
    {enableHighAccuracy:true,timeout:12000,maximumAge:0});
  });
  document.getElementById('save-spot').addEventListener('click',saveSpot);
}

function getSpots(){
  try{return JSON.parse(localStorage.getItem('bode-spots')||'[]');}catch{return [];}
}
function setSpots(spots){localStorage.setItem('bode-spots',JSON.stringify(spots));}

function saveSpot(){
  const name=document.getElementById('spot-name').value.trim();
  const lat=parseFloat(document.getElementById('spot-lat').value);
  const lon=parseFloat(document.getElementById('spot-lon').value);
  const note=document.getElementById('spot-note').value.trim();
  const status=document.getElementById('spot-status');
  if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)){status.textContent='Bitte Name sowie gültige Breiten- und Längengrade eingeben.';return;}
  const spots=getSpots();
  spots.push({id:Date.now(),name,lat,lon,note,created:new Date().toISOString()});
  setSpots(spots);
  document.getElementById('spot-name').value='';
  document.getElementById('spot-lat').value='';
  document.getElementById('spot-lon').value='';
  document.getElementById('spot-note').value='';
  status.textContent='Angelplatz gespeichert.';
  renderSpots();
}

function renderSpots(){
  const list=document.getElementById('spots');
  const spots=getSpots();
  list.innerHTML='';
  if(!spots.length){list.innerHTML='<p class="empty">Noch keine privaten Angelplätze gespeichert.</p>';return;}
  spots.sort((a,b)=>b.id-a.id).forEach(s=>list.appendChild(spotCard(s)));
}

function spotCard(s){
  const nearest=nearestParking(s);
  const appleCurrent=`https://maps.apple.com/?daddr=${s.lat},${s.lon}&dirflg=w`;
  const googleCurrent=`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking`;
  const appleParking=`https://maps.apple.com/?saddr=${nearest.lat},${nearest.lon}&daddr=${s.lat},${s.lon}&dirflg=w`;
  const googleParking=`https://www.google.com/maps/dir/?api=1&origin=${nearest.lat},${nearest.lon}&destination=${s.lat},${s.lon}&travelmode=walking`;
  const article=document.createElement('article');
  article.className='spot';
  article.innerHTML=`
    <h2>🎣 ${esc(s.name)}</h2>
    <p class="meta">${s.lat.toFixed(6)}, ${s.lon.toFixed(6)}</p>
    ${s.note?`<p>${esc(s.note)}</p>`:''}
    <p><strong>Nächstgelegener gespeicherter öffentlicher Parkplatz:</strong><br>${esc(nearest.name)} · Luftlinie ca. ${formatDistance(haversine(s,nearest))}</p>
    <div class="actions">
      <a class="btn primary" href="${appleCurrent}">Apple: zu Fuß ab Standort</a>
      <a class="btn" href="${googleCurrent}">Google: zu Fuß ab Standort</a>
      <a class="btn primary" href="${appleParking}">Apple: ab Parkplatz</a>
      <a class="btn" href="${googleParking}">Google: ab Parkplatz</a>
    </div>
    <p class="muted">Fußrouten können gesperrte, gefährliche oder nicht vorhandene Wege enthalten. Uferzugang und örtliche Regeln prüfen.</p>
    <button class="danger" type="button">Angelplatz löschen</button>`;
  article.querySelector('.danger').addEventListener('click',()=>{
    if(confirm(`„${s.name}“ wirklich löschen?`)){
      setSpots(getSpots().filter(x=>x.id!==s.id)); renderSpots();
    }
  });
  return article;
}

function nearestParking(spot){
  const parks=state.points.filter(p=>p.access==='public');
  return parks.reduce((best,p)=>haversine(spot,p)<haversine(spot,best)?p:best,parks[0]);
}
function haversine(a,b){
  const R=6371000,toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function formatDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;}
function check(field,label){return `<label><input type="checkbox" data-field="${field}"> ${label}</label>`;}
function saveCheck(article){
  const data={};article.querySelectorAll('[data-field]').forEach(el=>data[el.dataset.field]=el.type==='checkbox'?el.checked:el.value);
  localStorage.setItem(`bode-point-${article.dataset.id}`,JSON.stringify(data));
  const saved=article.querySelector('.saved');saved.textContent='Gespeichert';setTimeout(()=>saved.textContent='',1500);
}
function restoreAllChecks(){
  document.querySelectorAll('.point').forEach(article=>{
    const raw=localStorage.getItem(`bode-point-${article.dataset.id}`);if(!raw)return;
    const data=JSON.parse(raw);article.querySelectorAll('[data-field]').forEach(el=>{if(!(el.dataset.field in data))return;el.type==='checkbox'?el.checked=data[el.dataset.field]:el.value=data[el.dataset.field];});
  });
}
function esc(str){return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.addEventListener('DOMContentLoaded',init);
