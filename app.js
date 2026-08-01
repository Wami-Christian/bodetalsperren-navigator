
const state={parkings:[],exploration:[],filter:'all',tab:'exploration'};

async function init(){
  const [p,s]=await Promise.all([fetch('./points.json').then(r=>r.json()),fetch('./exploration-spots.json').then(r=>r.json())]);
  state.parkings=p;state.exploration=s;
  bindTabs();bindFilters();bindPrivateForm();
  renderAll();
  if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./service-worker.js?v=3.1').then(reg=>reg.update());
      let refreshing=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(refreshing)return;
        refreshing=true;
        location.reload();
      });
    }
}
function bindTabs(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    state.tab=b.dataset.tab;document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));document.getElementById(`${state.tab}-view`).classList.remove('hidden');
  }));
}
function bindFilters(){document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.filter;renderExploration();}));}
function renderAll(){renderExploration();renderParkings();renderPrivate();}
function parkingById(id){return state.parkings.find(p=>p.id===id);}
function statusOf(id){return localStorage.getItem(`explore-status-${id}`)||'open';}
function setStatus(id,status){localStorage.setItem(`explore-status-${id}`,status);renderExploration();}
function renderExploration(){
  const el=document.getElementById('exploration-list');el.innerHTML='';
  let items=state.exploration.filter(s=>state.filter==='all'||statusOf(s.id)===state.filter);
  if(!items.length){el.innerHTML='<p class="empty">Keine Punkte in diesem Filter.</p>';return;}
  items.forEach(s=>el.appendChild(explorationCard(s)));
}
function explorationCard(s){
  const p=parkingById(s.parkingId),dist=haversine(s,p),status=statusOf(s.id);
  const aCurrent=`https://maps.apple.com/?daddr=${s.lat},${s.lon}&dirflg=w`;
  const gCurrent=`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking`;
  const aPark=`https://maps.apple.com/?saddr=${p.lat},${p.lon}&daddr=${s.lat},${s.lon}&dirflg=w`;
  const gPark=`https://www.google.com/maps/dir/?api=1&origin=${p.lat},${p.lon}&destination=${s.lat},${s.lon}&travelmode=walking`;
  const c=document.createElement('article');c.className='card';
  c.innerHTML=`<div class="head"><span class="num">${s.id}</span><div><h2>${esc(s.name)}</h2><p class="meta">${esc(s.water)}</p></div></div>
  <div class="chips"><span class="chip warn">Erkundungspunkt</span><span class="chip ${status==='confirmed'?'confirmed':status==='rejected'?'rejected':''}">${status==='confirmed'?'vor Ort bestätigt':status==='rejected'?'ungeeignet':'noch offen'}</span></div>
  <p>${esc(s.source)}</p><p><strong>Hinweis:</strong> ${esc(s.risk)}</p>
  <p><strong>Zugeordneter Ausgangspunkt:</strong><br>${esc(p.name)}<br><span class="distance">Luftlinie ca. ${formatDistance(dist)}</span></p>
  <div class="actions"><a class="btn primary" href="${aCurrent}">Apple: zu Fuß ab Standort</a><a class="btn" href="${gCurrent}">Google: zu Fuß ab Standort</a><a class="btn primary" href="${aPark}">Apple: zu Fuß ab Parkplatz</a><a class="btn" href="${gPark}">Google: zu Fuß ab Parkplatz</a></div>
  <div class="verify-actions"><button class="action-btn confirm" type="button">Vor Ort bestätigt</button><button class="action-btn reject" type="button">Ungeeignet</button></div>
  <details><summary>Prüfnotiz</summary><textarea placeholder="Zugang, Gelände, Wasserstand, Gefahr, korrigierte Koordinate …"></textarea><button class="action-btn primary save-note" type="button">Notiz speichern</button><p class="muted saved"></p></details>`;
  c.querySelector('.confirm').addEventListener('click',()=>setStatus(s.id,'confirmed'));
  c.querySelector('.reject').addEventListener('click',()=>setStatus(s.id,'rejected'));
  const ta=c.querySelector('textarea'),key=`explore-note-${s.id}`;ta.value=localStorage.getItem(key)||'';
  c.querySelector('.save-note').addEventListener('click',()=>{localStorage.setItem(key,ta.value);c.querySelector('.saved').textContent='Gespeichert';});
  return c;
}
function renderParkings(){
  const el=document.getElementById('parking-list');el.innerHTML='';
  state.parkings.forEach(p=>{
    const pub=p.access==='public';
    const apple=pub?`https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=d`:`https://maps.apple.com/?q=${p.lat},${p.lon}`;
    const c=document.createElement('article');c.className='card';c.innerHTML=`<div class="head"><span class="num">${p.id}</span><div><h2>${esc(p.name)}</h2><p class="meta">${esc(p.type)}</p></div></div><div class="chips"><span class="chip">${pub?'öffentlich':'nicht öffentlich'}</span><span class="chip">${p.accuracy==='verified'?'belegt':'Näherungswert'}</span></div><p><strong>GPS:</strong> ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</p><div class="actions"><a class="btn primary" href="${apple}">${pub?'Apple Karten: Navigation':'Apple Karten: nur anzeigen'}</a><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}">Google Maps</a></div>`;
    el.appendChild(c);
  });
}
function bindPrivateForm(){
  document.getElementById('gps').addEventListener('click',()=>{const st=document.getElementById('gps-status');st.textContent='Position wird bestimmt …';navigator.geolocation.getCurrentPosition(pos=>{document.getElementById('lat').value=pos.coords.latitude.toFixed(6);document.getElementById('lon').value=pos.coords.longitude.toFixed(6);st.textContent=`Übernommen, Genauigkeit ca. ${Math.round(pos.coords.accuracy)} m.`;},()=>st.textContent='GPS nicht verfügbar oder nicht erlaubt.',{enableHighAccuracy:true,timeout:12000});});
  document.getElementById('save-private').addEventListener('click',()=>{const name=document.getElementById('name').value.trim(),lat=parseFloat(document.getElementById('lat').value),lon=parseFloat(document.getElementById('lon').value),note=document.getElementById('note').value.trim();if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)){document.getElementById('private-status').textContent='Name und gültige Koordinaten erforderlich.';return;}const a=getPrivate();a.push({id:Date.now(),name,lat,lon,note});localStorage.setItem('private-spots-v3',JSON.stringify(a));document.getElementById('private-status').textContent='Gespeichert.';renderPrivate();});
}
function getPrivate(){try{return JSON.parse(localStorage.getItem('private-spots-v3')||'[]')}catch{return[]}}
function renderPrivate(){
  const el=document.getElementById('private-list'),items=getPrivate();el.innerHTML='';
  if(!items.length){el.innerHTML='<p class="empty">Noch keine eigenen Angelplätze gespeichert.</p>';return;}
  items.forEach(s=>{const p=nearestPublic(s),c=document.createElement('article');c.className='card';c.innerHTML=`<h2>🎣 ${esc(s.name)}</h2><p class="meta">${s.lat.toFixed(6)}, ${s.lon.toFixed(6)}</p>${s.note?`<p>${esc(s.note)}</p>`:''}<p><strong>Nächster öffentlicher Parkplatz:</strong> ${esc(p.name)} · ${formatDistance(haversine(s,p))} Luftlinie</p><div class="actions"><a class="btn primary" href="https://maps.apple.com/?daddr=${s.lat},${s.lon}&dirflg=w">Apple: zu Fuß</a><a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking">Google: zu Fuß</a></div><button class="action-btn reject delete" type="button">Löschen</button>`;c.querySelector('.delete').addEventListener('click',()=>{localStorage.setItem('private-spots-v3',JSON.stringify(getPrivate().filter(x=>x.id!==s.id)));renderPrivate();});el.appendChild(c);});
}
function nearestPublic(s){const a=state.parkings.filter(p=>p.access==='public');return a.reduce((best,p)=>haversine(s,p)<haversine(s,best)?p:best,a[0]);}
function haversine(a,b){const R=6371000,r=x=>x*Math.PI/180,dLat=r(b.lat-a.lat),dLon=r(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
function formatDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
window.addEventListener('DOMContentLoaded',init);
