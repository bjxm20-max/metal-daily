const C={death:'--death',black:'--black',doom:'--doom',power:'--power',thrash:'--thrash',
  heavy:'--heavy',symph:'--symph',core:'--core',rock:'--rock',folk:'--folk',prog:'--prog',
  indus:'--indus',punk:'--punk',grind:'--grind',
  pop:'--pop',indie:'--indie',hiphop:'--hiphop',electro:'--electro',rnb:'--rnb'};
const GL={death:'Death',black:'Black',doom:'Doom / Sludge / Stoner',power:'Power',thrash:'Thrash / Speed',
  heavy:'Heavy',symph:'Symphonic / Viking',core:'Metalcore / Deathcore',rock:'Alt / Hard Rock',
  folk:'Folk',prog:'Prog / Post / Avant',indus:'Industrial / Darkwave',punk:'Punk / Hardcore',grind:'Grind',
  pop:'Pop',indie:'Indie / Alternativo',hiphop:'Hip-Hop / R&B',electro:'Eletrónica',rnb:'R&B / Soul'};
const ORDER=['death','black','thrash','doom','heavy','power','symph','folk','prog','core','indus','punk','grind','rock'];
const MORDER=['rock','pop','indie','rnb','hiphop','electro'];
const cv=g=>'var('+(C[g]||'--line')+')';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
function safeUrl(value){
  try{
    const url=new URL(String(value||''),location.href);
    return /^(https?:)$/.test(url.protocol)?url.href:'#';
  }catch(e){ return '#'; }
}
function readJSON(key,fallback){
  try{ const value=JSON.parse(localStorage.getItem(key)||'null'); return value??fallback; }
  catch(e){ return fallback; }
}
function normalizeData(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid data.json root');
  const data={...value};
  ['fresh','recent','alter','main','news','buzz','pt','mc','core','watch','rev','dt','st'].forEach(key=>{
    if(!Array.isArray(data[key])) data[key]=[];
  });
  if(!data.core.length && data.mc.length) data.core=data.mc;
  if(!Array.isArray(data.future)) data.future=[];
  data.future=data.future.filter(day=>day&&typeof day==='object').map(day=>({
    ...day,items:Array.isArray(day.items)?day.items:[]
  }));
  if(!data.bios||typeof data.bios!=='object'||Array.isArray(data.bios)) data.bios={};
  return data;
}

let D=null, sec='recent', route='home', view='all', query='', activeGenres=new Set(readJSON('md_genres',[]));
let archiveItems=[], archiveLoaded=false, archiveLoading=false;
const store={
  get fav(){return readJSON('md_fav',{})},
  get heard(){return readJSON('md_heard',{})},
  get follow(){return readJSON('md_follow',{})},
  get watch(){return readJSON('md_watch',{})},
  set(k,o){localStorage.setItem('md_'+k,JSON.stringify(o))}
};
const bandKey=b=>(b||'').toLowerCase().trim();
const PT_BANDS=new Set(['moonspell','gaerea','oblivion','ramp','tarantula','sacred sin','filii nigrantium infernalium',
  'decayed','heavenwood','desire','ava inferi','grog','holocausto canibal','corpus christii','process of guilt',
  'bizarra locomotiva','more than a thousand','for the glory','colosso','analepsy','concealment','equaleft',
  'angelus apatrida','sinistro','besta','dawnrider','jering','switchtense','vibrion','revolution within',
  'before the harvest','blasted','the soulbreaker company','wells valley','daxma','iron void']);
function isPT(r){ const b=bandKey(r.b); if(PT_BANDS.has(b)) return true;
  const t=((r.title||'')+' '+(r.d||'')).toLowerCase();
  return /\b(portug|português|portuguesa|lisboa|porto|moonspell|gaerea)\b/.test(t) || PT_BANDS.has(bandKey(r.title)); }
let REPO_FOLLOW=new Set();
function spotifyFollowKeys(){return readJSON('md_spotify_artists',[]).map(a=>bandKey(a.name)).filter(Boolean);}
function isFollowed(b){ const k=bandKey(b); const lf=store.follow; if(k in lf) return !!lf[k]; return REPO_FOLLOW.has(k)||spotifyFollowKeys().includes(k); }
function followKeys(){ const lf=store.follow; const s=new Set([...REPO_FOLLOW,...spotifyFollowKeys()]); Object.keys(lf).forEach(k=>{ if(lf[k]) s.add(k); else s.delete(k); }); return [...s]; }
function isWatched(nm){ return !!store.watch[bandKey(nm)]; }
function watchKeys(){ const o=store.watch; return Object.keys(o).filter(k=>o[k]); }
function toggleList(t,nm){ const key=t==='watch'?'watch':'follow'; const o=store[key]; const k=bandKey(nm); const now=t==='watch'?isWatched(nm):isFollowed(nm); o[k]=now?0:1; store.set(key,o); applyCounts(); return !now; }
function renderWatch(){
  const keys=watchKeys();
  const automatic=D&&Array.isArray(D.watch)?D.watch:[];
  const search='<div class="bandsearch"><input id="bandQ" data-target="watch" type="search" placeholder="🔎 Procurar banda promissora…" autocomplete="off" autocapitalize="off" spellcheck="false"><div id="bandRes"></div></div>';
  if(!keys.length&&!automatic.length) return search+'<div class="empty">Ainda não encontrei novas promessas nesta edição.</div>';
  const rel=allReleases().filter(r=>isWatched(r.b));
  const nws=allNews().filter(n=>keys.some(k=>(n.title||'').toLowerCase().includes(k)));
  const chips=keys.map(k=>{ const disp=k.replace(/\b\w/g,c=>c.toUpperCase()); return '<button class="bchip" data-name="'+encodeURIComponent(k)+'">'+esc(disp)+'</button>'; }).join('');
  let html=search+'<div class="digcard" style="border-left-color:var(--folk)"><span class="eyebrow">ESCOLHIDAS POR TI</span><h3>👀 A tua lista ('+keys.length+')</h3><div class="dl">Bandas que decidiste acompanhar manualmente.</div><div class="bchips">'+(chips||'<span class="mutedline">A tua lista manual está vazia.</span>')+'</div></div>';
  if(automatic.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--folk)"></span><span style="color:var(--folk)">Descobertas automáticas</span><span class="count">'+automatic.length+'</span></div>'+automatic.map(a=>'<article class="watchcard"><div><span class="watchscore">'+esc(a.score||'—')+'</span><h3>'+esc(a.b)+'</h3><p>'+esc(a.reason)+'</p><span>'+esc(a.release||'')+' · '+esc((a.sources||[]).join(' · '))+'</span></div><a href="'+safeUrl(a.url)+'" target="_blank" rel="noopener noreferrer">Explorar ↗</a></article>').join(''); }
  if(rel.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--folk)"></span><span style="color:var(--folk)">Lançamentos</span><span class="count">'+rel.length+'</span></div>'+rel.map(cardHTML).join(''); }
  if(nws.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--symph)"></span><span style="color:var(--symph)">Notícias</span><span class="count">'+nws.length+'</span></div>'+feedHTML(nws,'var(--symph)'); }
  if(!rel.length && !nws.length) html+='<div class="empty">Sem novidades das bandas em vigia nesta edição.</div>';
  return html;
}
function reviewCard(r){
  const col=r.cat==='metal'?'var(--death)':'var(--pop)';
  const sc=r.score?'<span class="rev-score" style="border-color:'+col+';color:'+col+'">'+esc(r.score)+'</span>':'';
  const star=r.star?' ★':'';
  return '<div class="card" style="border-left-color:'+col+'">'+
    coverHTML(coverQ((r.b||'')+' '+(r.t||'')), col)+
    '<div class="band" style="padding-right:8px">'+esc(r.b)+sc+'<span style="color:var(--power)">'+star+'</span></div>'+
    '<div class="title">'+esc(r.t)+'</div>'+
    '<div class="meta" style="margin-top:6px"><b style="color:'+col+'">'+esc(r.src)+'</b> · '+esc(r.date)+(r.d?'<br>'+esc(r.d):'')+'</div>'+
    '<a class="spot" style="background:var(--bg2);color:var(--symph);border:1px solid var(--line)" href="'+safeUrl(r.url)+'" target="_blank" rel="noopener noreferrer">Ler review →</a>'+
  '</div>';
}
function renderReviews(){
  const list=(D.rev||[]); if(!list.length) return '<div class="empty">Sem reviews nesta edição.<br>Volta amanhã para novas críticas.</div>';
  const met=sortFeed(list.filter(r=>r.cat==='metal')); const ger=sortFeed(list.filter(r=>r.cat!=='metal'));
  const grouped={}; list.forEach(r=>{const key=r.releaseKey||bandKey((r.b||'')+'|'+(r.t||''));(grouped[key]=grouped[key]||[]).push(r);});
  const consensus=Object.values(grouped).filter(group=>group.length>1);
  let html='<div class="digcard"><span class="eyebrow">CRÍTICAS · 14 DIAS</span><h3>📝 Opiniões e consenso</h3><div class="dl">Cada review mantém a fonte original. Quando várias publicações analisam o mesmo disco, a app reúne as opiniões sem copiar os textos.</div></div>';
  if(consensus.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--power)"></span><span style="color:var(--power)">Consenso</span><span class="count">'+consensus.length+'</span></div>'+consensus.map(group=>'<div class="consensus"><strong>'+esc(group[0].b)+' — '+esc(group[0].t)+'</strong><span>'+group.length+' críticas · '+esc([...new Set(group.map(r=>r.src))].join(' · '))+'</span></div>').join(''); }
  if(met.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--death)"></span><span style="color:var(--death)">Metal</span><span class="count">'+met.length+'</span></div>'+met.map(reviewCard).join(''); }
  if(ger.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--pop)"></span><span style="color:var(--pop)">Geral</span><span class="count">'+ger.length+'</span></div>'+ger.map(reviewCard).join(''); }
  return html;
}
async function loadBands(){ try{ const r=await fetch('bands.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return;
  const a=await r.json(); REPO_FOLLOW=new Set((a||[]).map(x=>bandKey(typeof x==='string'?x:(x&&x.b)||''))); applyCounts(); if(route!=='home') render(); }catch(e){} }
function isMC(x){
  const text=((x.b||'')+' '+(x.title||'')+' '+(x.t||'')+' '+(x.d||'')+' '+(x.g||'')).toLowerCase();
  return x.g==='core'||x.g==='punk'||/(metalcore|post[- ]hardcore|deathcore|hardcore|mathcore|electronicore|beatdown|easycore)/.test(text);
}
function renderMC(){
  const feed=(D.core||D.mc||[]); const rel=allReleases().filter(isMC);
  if(!feed.length && !rel.length) return '<div class="empty">Sem novidades CORE nesta edição.</div>';
  let html='<div class="digcard coreintro"><span class="eyebrow">CORE WORLDWIDE</span><h3>⛓️ Do hardcore punk ao metalcore moderno</h3><div class="dl">Metalcore em primeiro plano, com post-hardcore, deathcore, hardcore punk, mathcore, electronicore e todos os ramos da família.</div></div>';
  if(feed.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--rock)"></span><span style="color:var(--rock)">Notícias e movimento</span><span class="count">'+feed.length+'</span></div>'+splitFeedHTML(feed,'var(--rock)'); }
  if(rel.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--core)"></span><span style="color:var(--core)">Lançamentos CORE</span><span class="count">'+rel.length+'</span></div>'+rel.map(cardHTML).join(''); }
  return html;
}
const idOf=r=>(r.b+'|'+r.t).toLowerCase();
const SPOT_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.22c3.8-.87 7.07-.5 9.71 1.11.3.18.39.57.22.86Zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.16a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.36.22.48.7.25 1.06Zm.11-2.85C14.83 8.96 9.4 8.78 6.3 9.72a.94.94 0 1 1-.54-1.8c3.56-1.08 9.56-.87 13.34 1.37a.94.94 0 0 1-.96 1.61Z"/></svg>';

function spotifyUrl(r){return 'https://open.spotify.com/search/'+encodeURIComponent(r.b+' '+r.t.replace(/\(.*?\)/g,''))}
function strmQ(r){return encodeURIComponent((r.b+' '+r.t.replace(/\(.*?\)/g,'')).trim())}
function ytmUrl(r){return 'https://music.youtube.com/search?q='+strmQ(r)}
function tidalUrl(r){return 'https://tidal.com/search?q='+strmQ(r)}
function amUrl(r){return 'https://music.apple.com/search?term='+strmQ(r)}
function bcUrl(r){return 'https://bandcamp.com/search?q='+strmQ(r)}
function qobuzUrl(r){return 'https://www.qobuz.com/search?q='+strmQ(r)}
const AM_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3.5 8.6 5.1c-.5.1-.8.5-.8 1v8.7a2.7 2.7 0 1 0 1.4 2.4V9l5.6-1.2v5.2a2.7 2.7 0 1 0 1.4 2.4V4.5c0-.7-.6-1.1-1.2-1Z"/></svg>';
const BC_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7h14l-4 10H-1 z M16 7h5l-4 10h-5z" transform="translate(1 0)"/></svg>';
const YTM_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17ZM9.8 8.2v7.6l6.4-3.8-6.4-3.8Z"/></svg>';
const TIDAL_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.33 6 8 8.67 5.33 11.33 2.67 8.67 5.33 6Zm5.34 0L13.33 8.67 10.67 11.33 8 8.67 10.67 6Zm5.33 0L18.67 8.67 16 11.33 13.33 8.67 16 6Zm-5.33 5.33L13.33 14 10.67 16.67 8 14l2.67-2.67Z"/></svg>';
const QOB_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 5.6 18.27l1.7 1.7 1.4-1.4-1.7-1.7A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z"/></svg>';
function toast(msg,cls){const t=document.getElementById('toast');t.textContent=msg;t.className='show '+(cls||'');
  clearTimeout(t._h);t._h=setTimeout(()=>t.className='',2200);}
function nowHM(){const d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}

let lastSig=null, loading=false, histMode=false;
const GH_REPO='bjxm20-max/metal-daily';
async function openHistory(){
  const box=document.getElementById('histList');
  document.getElementById('histModal').classList.add('show');
  try{history.pushState({nav:'modal'},'');}catch(e){}
  box.innerHTML='<div class="empty">A carregar&hellip;</div>';
  try{
    const r=await fetch('https://api.github.com/repos/'+GH_REPO+'/commits?path=data.json&per_page=60',{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const arr=await r.json(); const seen=new Set();
    let html='<button class="hitem cur" data-sha="">⚡ Mais recente (ao vivo)</button>';
    arr.forEach(c=>{
      let lbl=((c.commit&&c.commit.message)||'').replace(/^.*?(\d{4}-\d{2}-\d{2}).*$/,'$1');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(lbl)) lbl=((c.commit&&c.commit.committer&&c.commit.committer.date)||'').slice(0,10);
      if(!lbl||seen.has(lbl))return; seen.add(lbl);
      html+='<button class="hitem" data-sha="'+esc(c.sha)+'" data-lbl="'+esc(lbl)+'">'+esc(lbl)+'</button>';
    });
    box.innerHTML=html;
    box.querySelectorAll('.hitem').forEach(b=>b.onclick=()=>loadSnapshot(b.dataset.sha,b.dataset.lbl));
  }catch(e){ box.innerHTML='<div class="empty">Não consegui carregar o histórico agora<br>(limite do GitHub?). Tenta daqui a pouco.</div>'; }
}
async function loadSnapshot(sha,lbl){
  document.getElementById('histModal').classList.remove('show');
  if(!sha){ histMode=false; document.getElementById('histBanner').style.display='none'; loadData('boot'); return; }
  try{
    const r=await fetch('https://raw.githubusercontent.com/'+GH_REPO+'/'+sha+'/data.json',{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const j=normalizeData(await r.json()); D=j; lastSig=sig(j); histMode=true;
    document.getElementById('histBanner').style.display='flex';
    document.getElementById('histLbl').textContent=lbl||j.range||j.generated||'';
    document.getElementById('chips').dataset.built='';
    buildChips(); paint(); applyCounts(); window.scrollTo(0,0);
  }catch(e){ toast('Falha ao abrir esse dia',''); }
}

/* ---------- Spotify playlist (Authorization Code + PKCE, sem servidor) ---------- */
const SP_REDIRECT = location.origin + location.pathname;
function spClientId(){ return localStorage.getItem('md_spclient')||'2946a52fcd9c44d3a49aad0b5b95ede6'; }
function openSpSettings(){ document.getElementById('spInput').value=spClientId(); document.getElementById('spModal').classList.add('show'); try{history.pushState({nav:'modal'},'');}catch(e){} }
function b64url(buf){ return btoa(String.fromCharCode.apply(null,new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function randStr(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a,b=>('0'+b.toString(16)).slice(-2)).join('').slice(0,n); }
async function sha256(str){ return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); }
async function spTokenReq(params){ params.client_id=spClientId();
  const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(params)});
  if(!r.ok) throw new Error('token '+r.status); return await r.json(); }
function saveTok(t){ const prev=JSON.parse(localStorage.getItem('md_sptok')||'{}');
  const o={access_token:t.access_token, expires_at:Date.now()+((t.expires_in||3600)-60)*1000,
    refresh_token:t.refresh_token||prev.refresh_token}; localStorage.setItem('md_sptok',JSON.stringify(o)); }
async function getToken(){ const o=JSON.parse(localStorage.getItem('md_sptok')||'null');
  if(o&&o.access_token&&o.expires_at>Date.now()) return o.access_token;
  if(o&&o.refresh_token){ try{ const t=await spTokenReq({grant_type:'refresh_token',refresh_token:o.refresh_token}); saveTok(t); return t.access_token; }catch(e){} }
  return null; }
async function startSpotifyAuth(){
  const cid=spClientId(); if(!cid){ openSpSettings(); return; }
  const verifier=randStr(96), state=randStr(32);
  localStorage.setItem('md_pkce',verifier); localStorage.setItem('md_spstate',state); localStorage.setItem('md_plintent','1');
  const challenge=b64url(await sha256(verifier));
  const p=new URLSearchParams({client_id:cid,response_type:'code',redirect_uri:SP_REDIRECT,
    code_challenge_method:'S256',code_challenge:challenge,state:state,
    scope:'playlist-modify-public playlist-modify-private user-follow-read user-top-read'});
  location.href='https://accounts.spotify.com/authorize?'+p.toString();
}
async function handleAuthReturn(){
  const u=new URL(location.href); const code=u.searchParams.get('code'); const err=u.searchParams.get('error'); const state=u.searchParams.get('state');
  if(!code && !err) return;
  const verifier=localStorage.getItem('md_pkce'); const expectedState=localStorage.getItem('md_spstate'); history.replaceState({},'',SP_REDIRECT);
  if(!state||!expectedState||state!==expectedState){ localStorage.removeItem('md_pkce'); localStorage.removeItem('md_spstate'); toast('Resposta Spotify inválida',''); return; }
  if(err){ toast('Login Spotify cancelado',''); return; }
  if(!verifier) return;
  try{ const t=await spTokenReq({grant_type:'authorization_code',code:code,redirect_uri:SP_REDIRECT,code_verifier:verifier});
    saveTok(t); localStorage.removeItem('md_pkce'); localStorage.removeItem('md_spstate');
    if(localStorage.getItem('md_plintent')){ localStorage.removeItem('md_plintent'); await createPlaylistFlow(); }
    else if(localStorage.getItem('md_freshintent')){ localStorage.removeItem('md_freshintent'); openSection('fresh'); setTimeout(checkFreshSingles,400); }
  }catch(e){ toast('Falha no login do Spotify',''); }
}
async function createPlaylistFlow(){
  if(!D){ toast('Dados ainda a carregar…',''); return; }
  const tk=await getToken(); if(!tk){ startSpotifyAuth(); return; }
  const items = sec==='main' ? (D.main||[]) : [].concat(D.recent||[], D.alter||[]);
  if(!items.length){ toast('Sem lançamentos para adicionar',''); return; }
  toast('🎧 A criar playlist…','ok');
  const H={'Authorization':'Bearer '+tk};
  try{
    const me=await (await fetch('https://api.spotify.com/v1/me',{headers:H})).json();
    if(!me||!me.id){ localStorage.removeItem('md_sptok'); startSpotifyAuth(); return; }
    const dlabel=(D.range||D.generated||'').toString();
    const plr=await fetch('https://api.spotify.com/v1/me/playlists',{method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},H),
      body:JSON.stringify({name:'Now Playing — '+dlabel,description:'Novos lançamentos via Now Playing.',public:true})});
    const pl=await plr.json();
    if(!plr.ok || !pl.id){ console.warn('SPOTIFY create FAIL', plr.status, JSON.stringify(pl));
      if(plr.status===401){ localStorage.removeItem('md_sptok'); toast('Sessão Spotify expirou — toca outra vez',''); return; }
      if(plr.status===403){ toast('Spotify bloqueia criação de playlists no modo dev da app — usa o botão Tidal 🔱',''); return; }
      toast('Erro Spotify: '+((pl&&pl.error&&pl.error.message)||('HTTP '+plr.status)),''); return; }
    const uris=[]; let miss=0;
    for(const r of items){
      const q=encodeURIComponent((r.b+' '+(r.t||'').replace(/\(.*?\)/g,'')).trim());
      try{ const sr=await (await fetch('https://api.spotify.com/v1/search?type=track&limit=1&q='+q,{headers:H})).json();
        const it=sr.tracks&&sr.tracks.items&&sr.tracks.items[0];
        if(it) uris.push(it.uri); else miss++;
      }catch(e){ miss++; }
    }
    let added=0;
    for(let i=0;i<uris.length;i+=100){
      const chunk=uris.slice(i,i+100);
      const ar=await fetch('https://api.spotify.com/v1/playlists/'+pl.id+'/tracks',{method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},H),
        body:JSON.stringify({uris:chunk})});
      if(ar.ok) added+=chunk.length; else console.warn('SPOTIFY add FAIL', ar.status, await ar.text().catch(function(){return'';}));
    }
    const bn=document.getElementById('plBanner'); bn.style.display='flex';
    document.getElementById('plMsg').textContent='✅ Playlist criada · '+added+' faixas'+(miss?(' ('+miss+' não encontradas)'):'');
    document.getElementById('plOpen').href=(pl.external_urls&&pl.external_urls.spotify)||'https://open.spotify.com';
    toast('Playlist pronta! 🤘','ok');
  }catch(e){ toast('Erro ao criar a playlist',''); }
}

/* ---------- Tidal playlist (Authorization Code + PKCE, API v2 JSON:API) ---------- */
const TD_CLIENT='MhXRWPSHGcyzVoDT';
const TD_REDIRECT=location.origin+location.pathname;
const TD_AUTH='https://login.tidal.com/authorize';
const TD_TOKEN='https://auth.tidal.com/v1/oauth2/token';
const TD_API='https://openapi.tidal.com/v2';
const TD_CC='PT';
async function tdToken(params){ params.client_id=TD_CLIENT;
  const r=await fetch(TD_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const t=await r.text(); if(!r.ok) throw new Error('tdtoken '+r.status+' '+t.slice(0,150));
  return JSON.parse(t); }
function tdSaveTok(t){ const prev=JSON.parse(localStorage.getItem('md_tdtok')||'{}');
  localStorage.setItem('md_tdtok',JSON.stringify({access_token:t.access_token,
    expires_at:Date.now()+((t.expires_in||86400)-60)*1000, refresh_token:t.refresh_token||prev.refresh_token})); }
async function tdGetToken(){ const o=JSON.parse(localStorage.getItem('md_tdtok')||'null');
  if(o&&o.access_token&&o.expires_at>Date.now()) return o.access_token;
  if(o&&o.refresh_token){ try{ const t=await tdToken({grant_type:'refresh_token',refresh_token:o.refresh_token}); tdSaveTok(t); return t.access_token; }catch(e){} }
  return null; }
async function startTidalAuth(){
  const verifier=randStr(96), state=randStr(32);
  localStorage.setItem('md_tdpkce',verifier); localStorage.setItem('md_tdstate',state); localStorage.setItem('md_tdintent','1');
  const challenge=b64url(await sha256(verifier));
  const p=new URLSearchParams({client_id:TD_CLIENT,response_type:'code',redirect_uri:TD_REDIRECT,
    code_challenge_method:'S256',code_challenge:challenge,state:state,
    scope:'user.read playlists.write collection.read'});
  location.href=TD_AUTH+'?'+p.toString();
}
async function handleTidalReturn(){
  const u=new URL(location.href); const code=u.searchParams.get('code'); const err=u.searchParams.get('error'); const state=u.searchParams.get('state');
  const verifier=localStorage.getItem('md_tdpkce'); const expectedState=localStorage.getItem('md_tdstate'); history.replaceState({},'',TD_REDIRECT);
  if(!state||!expectedState||state!==expectedState){ localStorage.removeItem('md_tdpkce'); localStorage.removeItem('md_tdstate'); toast('Resposta Tidal inválida',''); return; }
  if(err){ toast('Login Tidal cancelado',''); return; }
  if(!code||!verifier) return;
  try{ const t=await tdToken({grant_type:'authorization_code',code:code,redirect_uri:TD_REDIRECT,code_verifier:verifier});
    tdSaveTok(t); localStorage.removeItem('md_tdpkce'); localStorage.removeItem('md_tdstate');
    if(localStorage.getItem('md_tdintent')){ localStorage.removeItem('md_tdintent'); await createTidalPlaylist(); }
  }catch(e){ console.warn('tidal token',e); toast('Falha no login do Tidal',''); }
}
async function tdApi(method,path,body){
  const tk=await tdGetToken(); if(!tk) throw new Error('no token');
  const h={'Authorization':'Bearer '+tk,'Accept':'application/vnd.api+json'};
  if(body) h['Content-Type']='application/vnd.api+json';
  const r=await fetch(TD_API+path,{method:method,headers:h,body:body?JSON.stringify(body):undefined});
  const txt=await r.text(); let j=null; try{ j=txt?JSON.parse(txt):null; }catch(e){}
  if(!r.ok){ const e=new Error('tidal '+r.status+' '+(txt||'').slice(0,160)); e.status=r.status; throw e; }
  return j;
}
async function createTidalPlaylist(){
  if(!D){ toast('Dados ainda a carregar…',''); return; }
  const tk=await tdGetToken(); if(!tk){ startTidalAuth(); return; }
  const items = sec==='main' ? (D.main||[]) : [].concat(D.recent||[], D.alter||[]);
  if(!items.length){ toast('Sem lançamentos para adicionar',''); return; }
  toast('◈ A criar playlist no Tidal…','ok');
  try{
    const dlabel=(D.range||D.generated||'').toString();
    const pl=await tdApi('POST','/playlists',{ data:{ attributes:{ name:'Now Playing — '+dlabel,
      description:'Novos lançamentos via Now Playing.', privacy:'PRIVATE' }, type:'playlists' } });
    const pid=pl&&pl.data&&pl.data.id; if(!pid) throw new Error('sem id de playlist');
    const ids=[]; let miss=0;
    for(const r of items){
      const q=encodeURIComponent((r.b+' '+(r.t||'').replace(/\(.*?\)/g,'')).trim());
      try{ const sr=await tdApi('GET','/searchResults/'+q+'?countryCode='+TD_CC+'&include=tracks');
        const ref=sr&&sr.data&&sr.data.relationships&&sr.data.relationships.tracks&&sr.data.relationships.tracks.data;
        if(ref&&ref.length){ ids.push(ref[0].id); } else miss++;
      }catch(e){ miss++; }
    }
    for(let i=0;i<ids.length;i+=20){
      const chunk=ids.slice(i,i+20).map(function(id){return {id:id,type:'tracks'};});
      await tdApi('POST','/playlists/'+pid+'/relationships/items?countryCode='+TD_CC,{ data:chunk });
    }
    const bn=document.getElementById('plBanner'); bn.style.display='flex';
    document.getElementById('plMsg').textContent='✅ Tidal: playlist criada · '+ids.length+' faixas'+(miss?(' ('+miss+' não encontradas)'):'');
    const a=document.getElementById('plOpen'); a.textContent='Abrir no Tidal'; a.href='https://tidal.com/playlist/'+pid;
    toast('Playlist Tidal pronta! 🤘','ok');
  }catch(e){ const m=(e&&e.message)||''; if(e&&e.status===401){ localStorage.removeItem('md_tdtok'); startTidalAuth(); return; }
    console.warn('tidal create',e); toast('Erro no Tidal: '+m.slice(0,80),''); }
}
function sig(d){return (d.generated||'')+'|'+((d.recent&&d.recent.length)||0)+'|'+((d.alter&&d.alter.length)||0)+'|'+
  ((d.main&&d.main.length)||0)+'|'+(d.future||[]).reduce((a,x)=>a+x.items.length,0)+'|'+((d.news&&d.news.length)||0)+'|'+
  ((d.buzz&&d.buzz.length)||0)+'|'+((d.dt&&d.dt.length)||0)+'|'+((d.st&&d.st.length)||0)+'|'+((d.fresh&&d.fresh.length)||0);}

function notifyFollowed(fresh){
  if(!fresh||readJSON('md_notifications',{followed:true}).followed===false) return; const keys=followKeys(); if(!keys.length) return;
  const rel=[].concat(fresh.recent||[],fresh.alter||[],fresh.main||[],(fresh.future||[]).reduce((a,d)=>a.concat(d.items),[]));
  const hits=rel.filter(r=>isFollowed(r.b)); if(!hits.length) return;
  const cur=(fresh.generated||'')+'|'+hits.map(h=>h.b+h.t).join(',');
  if(localStorage.getItem('md_follownotif')===cur) return; localStorage.setItem('md_follownotif',cur);
  const names=[...new Set(hits.map(h=>h.b))].slice(0,3).join(', ');
  toast('⭐ Novidade de '+names,'new');
  try{ if('Notification' in window && Notification.permission==='granted'){
    new Notification('Metal Daily — bandas que segues',{body:names+': '+hits.length+' lançamento(s) 🤘',icon:'icon-192.png'}); } }catch(e){}
}
async function loadData(reason){
  if(loading) return;
  if(histMode && reason!=='boot') return;
  loading=true;
  try{
    const res=await fetch('data.json?t='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error(res.status);
    const fresh=normalizeData(await res.json());
    const s=sig(fresh);
    const changed = lastSig && s!==lastSig;
    D=fresh; lastSig=s;
    buildChips(); paint(); applyCounts(); notifyFollowed(fresh);
    document.getElementById('hdate').innerHTML='Atualizado <u>'+nowHM()+'</u><br><span style="opacity:.7">🕑 ver histórico</span>';
    document.getElementById('fdate').textContent=D.range||D.generated||'';
    if(reason==='pull'){ toast(changed?'⚡ Novas releases!':'Já estás na versão mais recente', changed?'new':'ok'); }
    else if(changed){ toast('⚡ Novas releases disponíveis','new'); }
  }catch(err){
    if(!D){ document.getElementById('main').innerHTML=
      '<div class="empty">Sem ligação e sem dados em cache ainda.<br>Liga-te à internet e abre outra vez.</div>'; }
    if(reason==='pull') toast('Sem ligação — a mostrar o que tens','');
  }finally{ loading=false; }
}

const FOLDERS=[
  {s:'recent', ic:'⚡', t:'Lançamentos', sub:'Últimas duas semanas', col:'--death', group:'Agora'},
  {s:'fresh',  ic:'🎧', t:'Radar', sub:'Geral · O meu Spotify', col:'--spotify', group:'Agora'},
  {s:'alter',  ic:'🌐', t:'Alterportal', sub:'Posts da fonte externa', col:'--symph', group:'Agora'},
  {s:'main',   ic:'🎵', t:'Mainstream', sub:'Última sexta-feira', col:'--pop', group:'Agora'},
  {s:'future', ic:'📅', t:'Future', sub:'Próximos 30 dias', col:'--power', group:'Agora'},
  {s:'news',   ic:'📰', t:'Notícias', sub:'Confirmadas · Rumores', col:'--symph', group:'Informação'},
  {s:'buzz',   ic:'✨', t:'Buzz', sub:'Toda a música', col:'--indus', group:'Informação'},
  {s:'pt',     ic:'🇵🇹', t:'Portugal', sub:'Metal, rock e mais', col:'--core', group:'Em foco'},
  {s:'core',   ic:'⛓️', t:'CORE', sub:'Metalcore e família', col:'--rock', group:'Em foco'},
  {s:'dt',     ic:'🎹', t:'Dream Theater', sub:'Feed dedicado', col:'--prog', group:'Em foco'},
  {s:'st',     ic:'🎭', t:'Sleep Token', sub:'Feed dedicado', col:'--rnb', group:'Em foco'},
  {s:'follow', ic:'⭐', t:'A Seguir', sub:'App · Spotify', col:'--power', group:'A tua área'},
  {s:'watch',  ic:'👀', t:'A Vigiar', sub:'Promessas automáticas', col:'--folk', group:'A tua área'},
  {s:'rev',    ic:'📝', t:'Reviews', sub:'Críticas · Consenso', col:'--doom', group:'A tua área'},
  {s:'digest', ic:'🗞️', t:'Digest', sub:'Domingo à noite', col:'--symph', group:'A tua área'},
  {s:'stats',  ic:'📊', t:'Estatísticas', sub:'Geral · Spotify', col:'--indus', group:'A tua área'}
];
function allReleases(){ if(!D) return [];
  return [].concat(D.recent||[],D.alter||[],D.main||[],(D.future||[]).reduce((a,d)=>a.concat(d.items),[])); }
function allNews(){ if(!D) return [];
  return [].concat(D.news||[],D.buzz||[],D.dt||[],D.st||[]); }
async function loadArchive(){
  if(archiveLoaded||archiveLoading) return; archiveLoading=true;
  try{
    const indexResponse=await fetch('archive/index.json?t='+Date.now(),{cache:'no-store'});
    if(!indexResponse.ok) throw new Error(indexResponse.status);
    const index=await indexResponse.json();
    const months=(index.months||[]).slice(0,6);
    const pages=await Promise.all(months.map(month=>fetch('archive/'+month+'.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]).catch(()=>[])));
    archiveItems=[].concat.apply([],pages); archiveLoaded=true;
  }catch(e){ archiveItems=[]; archiveLoaded=true; }
  finally{ archiveLoading=false; if(sec==='search'&&query) render(); }
}
function renderSearch(){
  const current=[].concat(
    (D.recent||[]).map(x=>({...x,kind:'release'})),(D.main||[]).map(x=>({...x,kind:'release'})),
    (D.alter||[]).map(x=>({...x,kind:'release'})),allNews().map(x=>({...x,kind:'news'})),
    (D.pt||[]).map(x=>({...x,kind:'news'})),(D.core||[]).map(x=>({...x,kind:'news'})),
    (D.rev||[]).map(x=>({...x,kind:'review'}))
  );
  const seen=new Set(), results=[];
  current.concat(archiveItems).forEach(item=>{
    const key=item.url||((item.kind||'')+'|'+(item.b||item.title||'')+'|'+(item.t||''));
    const hay=JSON.stringify(item).toLowerCase();
    if(!seen.has(key)&&hay.includes(query)){seen.add(key);results.push(item);}
  });
  results.sort((a,b)=>(b.isoDate||b.timestamp||'').localeCompare(a.isoDate||a.timestamp||''));
  const releases=results.filter(x=>x.kind==='release').slice(0,60);
  const news=results.filter(x=>x.kind==='news').slice(0,60);
  const reviews=results.filter(x=>x.kind==='review').slice(0,30);
  let html='<div class="searchsummary"><strong>'+results.length+'</strong> resultados em conteúdos atuais e no arquivo de seis meses'+(!archiveLoaded?' · a carregar arquivo…':'')+'</div>';
  if(releases.length) html+='<div class="genre-h"><span class="dot" style="background:var(--death)"></span><span style="color:var(--death)">Lançamentos</span><span class="count">'+releases.length+'</span></div>'+releases.map(cardHTML).join('');
  if(news.length) html+='<div class="genre-h"><span class="dot" style="background:var(--symph)"></span><span style="color:var(--symph)">Notícias</span><span class="count">'+news.length+'</span></div>'+feedHTML(news,'var(--symph)');
  if(reviews.length) html+='<div class="genre-h"><span class="dot" style="background:var(--doom)"></span><span style="color:var(--doom)">Reviews</span><span class="count">'+reviews.length+'</span></div>'+reviews.map(reviewCard).join('');
  return results.length?html:'<div class="empty">Nada encontrado em seis meses de arquivo.</div>';
}
function followCount(){
  return allReleases().filter(r=>isFollowed(r.b)).length
    + allNews().filter(n=>followKeys().some(k=>(n.title||'').toLowerCase().includes(k))).length; }
function countOf(s){ if(!D) return 0;
  if(s==='future') return (D.future||[]).reduce((a,d)=>a+d.items.length,0);
  if(s==='follow') return followCount();
  if(s==='pt') return (D.pt||[]).length + allReleases().filter(isPT).length;
  if(s==='core') return (D.core||[]).length + allReleases().filter(isMC).length;
  if(s==='watch') return (D.watch||[]).length + Object.keys(store.watch).filter(k=>store.watch[k]).length;
  if(s==='rev') return (D.rev||[]).length;
  if(s==='digest') return allReleases().filter(r=>r.star).length;
  if(s==='stats') return new Set(allReleases().map(r=>r.g)).size;
  return (D[s]||[]).length; }
function renderHome(){
  const h=document.getElementById('home');
  if(!D){ h.innerHTML='<div class="empty">A carregar&hellip;</div>'; return; }
  const groups=[...new Set(FOLDERS.map(f=>f.group))];
  const health=D.sourceHealth||{};
  h.innerHTML='<section class="homehero"><span class="eyebrow">METAL DAILY · AO VIVO</span><h2>O ruído que interessa.</h2><p>Uma leitura mundial, pesada e sem repetições — com atenção especial à cena portuguesa.</p><div class="healthline"><span>● '+esc((health.newsFeeds||0)+(health.searchFeeds||0))+' feeds ativos</span><span>Atualizado '+esc(D.range||D.generated||'')+'</span></div></section>'+
    groups.map(group=>'<section class="foldergroup"><div class="hometitle">'+esc(group)+'</div><div class="foldergrid">'+
      FOLDERS.filter(f=>f.group===group).map(f=>'<button class="folder" data-s="'+f.s+'" style="--fc:var('+f.col+')">'+
        '<span class="fcount">'+countOf(f.s)+'</span><span class="fic">'+f.ic+'</span><span class="ft">'+f.t+'</span><span class="fsub">'+f.sub+'</span></button>').join('')+'</div></section>').join('');
  h.querySelectorAll('.folder').forEach(b=>b.onclick=()=>openSection(b.dataset.s));
}
function setChrome(){
  const home=route==='home';
  const rel=(sec==='recent'||sec==='alter'||sec==='main'||sec==='future');
  document.getElementById('home').style.display=home?'block':'none';
  document.getElementById('main').style.display=home?'none':'';
  document.getElementById('secbar').style.display=home?'none':'flex';
  document.querySelector('.search').style.display='block';
  document.querySelector('.bottombar').style.display=(!home&&rel)?'flex':'none';
  document.getElementById('chips').style.display=
    (!home&&(sec==='recent'||sec==='alter'||sec==='future'))?'flex':'none';
  document.getElementById('plBtnTd').style.display=
    (!home&&(sec==='recent'||sec==='alter'||sec==='main'))?'inline-flex':'none';
}
function openSection(s){ sec=s; route='section'; query=''; const q=document.getElementById('q'); if(q) q.value='';
  const f=FOLDERS.find(x=>x.s===s)||{}; document.getElementById('secTitle').textContent=f.t||s;
  try{ if(!(history.state&&history.state.nav==='section')) history.pushState({nav:'section'},''); }catch(e){}
  setChrome(); window.scrollTo(0,0); render(); }
function goHome(){ route='home'; setChrome(); renderHome(); window.scrollTo(0,0); }
function paint(){ setChrome(); route==='home'?renderHome():render(); }
function applyCounts(){
  document.querySelectorAll('.folder .fcount').forEach(el=>{
    const s=el.closest('.folder').dataset.s; el.textContent=countOf(s);
  });
}
function buildChips(){
  const chips=document.getElementById('chips'); if(chips.dataset.built) return;
  const allItems=[].concat(D.recent,D.alter,D.future.reduce((a,d)=>a.concat(d.items),[]));
  const presentG=ORDER.filter(g=>allItems.some(r=>r.g===g));
  chips.innerHTML='';
  presentG.forEach(g=>{
    const b=document.createElement('button');b.className='chip';b.dataset.g=g;
    b.innerHTML='<span class="sw" style="background:'+cv(g)+'"></span>'+GL[g];
    if(activeGenres.has(g)) b.classList.add('on');
    b.onclick=()=>{activeGenres.has(g)?activeGenres.delete(g):activeGenres.add(g);
      localStorage.setItem('md_genres',JSON.stringify([...activeGenres]));
      b.classList.toggle('on');render();};
    chips.appendChild(b);
  });
  chips.dataset.built='1';
}

function matchFilter(r){
  if(sec!=='main' && activeGenres.size && !activeGenres.has(r.g)) return false;
  if(view==='fav' && !store.fav[idOf(r)]) return false;
  if(view==='star' && !r.star) return false;
  if(view==='unheard' && store.heard[idOf(r)]) return false;
  if(query){const s=(r.b+' '+r.t+' '+(r.lbl||'')+' '+(r.d||'')).toLowerCase();
    if(!s.includes(query)) return false;}
  return true;
}
/* ---------- Capas de album (iTunes Search, lazy + cache) ---------- */
function coverQ(s){ return (s||'').replace(/\([^)]*\)|\[[^\]]*\]/g,'').replace(/["'<>]/g,' ').replace(/\s+/g,' ').trim(); }
function newsQ(t){ return coverQ(t).split(' ').slice(0,4).join(' '); }
function fbLetter(s){ const t=(s||'').trim(); return t?t[0].toUpperCase():'♪'; }
function coverHTML(q,g){ return '<div class="cover" data-cq="'+(q||'').replace(/"/g,'')+'" style="--gc:'+(g||'#333')+'"><span class="cover-fb">'+fbLetter(q)+'</span></div>'; }
const COVER_TTL=1000*60*60*24*30;
function covGet(q){ try{const o=JSON.parse(localStorage.getItem('cov_'+q)||'null'); if(o&&(Date.now()-o.t)<COVER_TTL) return o.u;}catch(e){} return undefined; }
function covSet(q,u){ try{localStorage.setItem('cov_'+q,JSON.stringify({u:u||'',t:Date.now()}));}catch(e){} }
let _cbN=0;
function itunes(term){ return new Promise(res=>{
  if(!term){ res(''); return; }
  const cb='__itcb'+(++_cbN); let done=false; const sc=document.createElement('script');
  function fin(v){ if(done)return; done=true; try{delete window[cb];}catch(e){window[cb]=undefined;} if(sc.parentNode)sc.parentNode.removeChild(sc); res(v); }
  window[cb]=function(d){ let u=''; try{const r=d&&d.results&&d.results[0]; u=r?(r.artworkUrl100||'').replace('100x100','600x600'):'';}catch(e){} fin(u); };
  sc.onerror=function(){ fin(''); };
  sc.src='https://itunes.apple.com/search?media=music&entity=album&limit=1&term='+encodeURIComponent(term)+'&callback='+cb;
  (document.body||document.documentElement).appendChild(sc);
  setTimeout(function(){ fin(''); },7000);
});}
async function loadCover(el){
  const q=el.getAttribute('data-cq'); if(!q){ return; } el.removeAttribute('data-cq');
  let u=covGet(q);
  if(u===undefined){ u=await itunes(q); covSet(q,u); }
  if(u){ const im=new Image(); im.onload=function(){ el.style.backgroundImage='url("'+u+'")'; el.classList.add('has-img'); }; im.src=u; }
}
let _covIO=null;
function observeCovers(){
  const els=document.querySelectorAll('.cover[data-cq]');
  if('IntersectionObserver' in window){
    if(!_covIO) _covIO=new IntersectionObserver(function(ents){ ents.forEach(function(e){ if(e.isIntersecting){ loadCover(e.target); _covIO.unobserve(e.target);} }); },{rootMargin:'250px'});
    els.forEach(function(el){ _covIO.observe(el); });
  } else { els.forEach(loadCover); }
}
function cardHTML(r){
  const id=idOf(r), fav=store.fav[id], heard=store.heard[id], foll=isFollowed(r.b);
  const star=r.star?' ★':'';
  const subParts=[]; if(r.lbl&&r.lbl!=='—')subParts.push(r.lbl); if(r.date)subParts.push(r.date);
  const subline=(r.sub?r.sub+' · ':'')+subParts.join(' · ');
  const format=r.fmt?'<span class="format">'+esc(r.fmt)+'</span>':'';
  const sources=(r.sources||[]).map(source=>'<a class="source-pill" href="'+safeUrl(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.name)+'</a>').join('');
  const open=(query||view!=='all');
  return '<div class="card'+(heard?' heard':'')+(open?' open':'')+'" style="border-left-color:'+cv(r.g)+'">'+
    '<div class="acts">'+
      '<button class="fl'+(foll?' on':'')+'" data-act="follow" data-band="'+encodeURIComponent(r.b)+'" title="Seguir banda">'+(foll?'★':'☆')+'</button>'+
      '<button class="sh" data-act="share" data-id="'+esc(id)+'">↗</button>'+
      '<button class="fav'+(fav?' on':'')+'" data-act="fav" data-id="'+esc(id)+'">'+(fav?'❤':'♡')+'</button>'+
      '<button class="hd'+(heard?' on':'')+'" data-act="heard" data-id="'+esc(id)+'">✓</button>'+
    '</div>'+
    '<div class="chead">'+
      coverHTML(coverQ(r.b+' '+r.t), cv(r.g))+
      '<div class="band">'+esc(r.b)+'<span style="color:var(--power)">'+star+'</span>'+format+'</div>'+
      '<div class="title">'+esc(r.t)+'</div>'+
      '<div class="cmetarow">'+
        '<span class="tag" style="color:'+cv(r.g)+'">'+esc(GL[r.g]||r.g)+'</span>'+
        '<span class="cmeta-min">'+esc(subline)+'</span>'+
        '<span class="chev">▾</span>'+
      '</div>'+
    '</div>'+
    '<div class="cbody">'+
      (r.d?'<div class="meta" style="margin-bottom:4px">'+esc(r.d)+'</div>':'')+
      (sources?'<div class="source-list"><span>Fontes</span>'+sources+'</div>':'')+
      '<div class="streams">'+
        '<a class="strm sp" href="'+spotifyUrl(r)+'" target="_blank" rel="noopener">'+SPOT_SVG+'Spotify</a>'+
        '<a class="strm yt" href="'+ytmUrl(r)+'" target="_blank" rel="noopener">'+YTM_SVG+'YT Music</a>'+
        '<a class="strm td" href="'+tidalUrl(r)+'" target="_blank" rel="noopener">'+TIDAL_SVG+'Tidal</a>'+
        '<a class="strm am" href="'+amUrl(r)+'" target="_blank" rel="noopener">'+AM_SVG+'Apple</a>'+
        '<a class="strm bc" href="'+bcUrl(r)+'" target="_blank" rel="noopener">'+BC_SVG+'Bandcamp</a>'+
        '<a class="strm qz" href="'+qobuzUrl(r)+'" target="_blank" rel="noopener">'+QOB_SVG+'Qobuz</a>'+
      '</div>'+
    '</div>'+
  '</div>';
}
function renderGrouped(list, order){
  order=order||ORDER;
  const byG={}; list.forEach(r=>{(byG[r.g]=byG[r.g]||[]).push(r)});
  let html='';
  order.forEach(g=>{ if(!byG[g])return;
    html+='<div class="genre-h"><span class="dot" style="background:'+cv(g)+'"></span>'+
      '<span style="color:'+cv(g)+'">'+GL[g]+'</span><span class="count">'+byG[g].length+'</span></div>';
    html+=byG[g].map(cardHTML).join('');
  });
  return html;
}
const NSRC={'Whiplash':'#4caf50','Blabbermouth':'#f29a3b','Loudwire':'#e23b3b','Metal Injection':'#a259d9','MetalSucks':'#ed6ea7','Metal Hammer':'#3bd4d4'};
function bioCard(b, accent){
  if(!b) return '';
  const mem=(b.members||[]).map(m=>'<span class="bmem">'+esc(m)+'</span>').join('');
  const tri=(b.trivia||[]).map(t=>'<li>'+esc(t)+'</li>').join('');
  return '<div class="card biocard" style="border-left-color:'+accent+'">'+
    coverHTML(b.name, accent)+
    '<div class="band" style="padding-right:0;font-size:1.18rem">'+esc(b.name)+'</div>'+
    (b.formed?'<div class="bsub" style="color:'+accent+'">'+esc(b.formed)+'</div>':'')+
    '<div class="meta" style="margin:7px 0 2px">'+esc(b.summary)+'</div>'+
    (mem?'<div class="blabel" style="color:'+accent+'">Formação</div><div class="bmems">'+mem+'</div>':'')+
    (tri?'<div class="blabel" style="color:'+accent+'">Sabias que?</div><ul class="btriv">'+tri+'</ul>':'')+
  '</div>';
}
const _MO={jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12};
function dkey(d){ d=(d||'').toLowerCase(); const mm=d.match(/([a-zç]{3})/); if(!mm||!_MO[mm[1]]) return -1; const dd=d.match(/(\d{1,2})/); return _MO[mm[1]]*100+(dd?parseInt(dd[1],10):0); }
function sortFeed(list){ return (list||[]).slice().sort((a,b)=>{
  const ad=a.timestamp||a.isoDate||'', bd=b.timestamp||b.isoDate||'';
  return ad&&bd?bd.localeCompare(ad):dkey(b.date)-dkey(a.date);
}); }
var freshLive=(function(){try{return JSON.parse(localStorage.getItem('md_fresh_live')||'null');}catch(e){return null;}})();
var freshMode=localStorage.getItem('md_radar_mode')||'general';
var freshLastMessage='';
function wireFresh(){
  document.querySelectorAll('[data-radar]').forEach(button=>button.onclick=()=>{
    freshMode=button.dataset.radar; localStorage.setItem('md_radar_mode',freshMode); render();
  });
  var b=document.getElementById('freshChk'); if(b) b.onclick=checkFreshSingles;
  var g=document.getElementById('generalChk'); if(g) g.onclick=checkGeneralFeed;
  var deep=document.getElementById('deepScan'); if(deep) deep.onclick=()=>window.open('https://github.com/'+GH_REPO+'/actions/workflows/daily-update.yml','_blank','noopener');
}
async function checkGeneralFeed(){
  var button=document.getElementById('generalChk'), msg=document.getElementById('generalMsg');
  if(button){button.disabled=true;button.textContent='A verificar…';}
  await loadData('pull');
  try{
    const response=await fetch('https://api.github.com/repos/'+GH_REPO+'/actions/workflows/daily-update.yml/runs?per_page=1',{cache:'no-store'});
    const body=await response.json(); const run=body&&body.workflow_runs&&body.workflow_runs[0];
    if(msg) msg.textContent=run?(run.status==='completed'?'Último varrimento concluído.':'Há um varrimento em curso.'):'Resultados atualizados.';
  }catch(e){ if(msg) msg.textContent='Resultados publicados verificados.'; }
  if(button){button.disabled=false;button.textContent='Atualizar resultados';}
}
function fsRelDate(s){ if(!s) return null; var p=(''+s).split('-'); var dt=new Date(+p[0],(+p[1]||1)-1,(+p[2]||1)); return isNaN(dt.getTime())?null:dt; }
function fsKey(al){ return (((al.artists&&al.artists[0]&&al.artists[0].name)||'')+'|'+(al.name||'')).toLowerCase(); }
function fsFmt(al){ var g=al.album_group||''; if(g==='appears_on') return 'Feat.'; if(g==='compilation'||al.album_type==='compilation') return 'Comp'; var t=al.album_type||al.type||'single'; if(t==='single') return (al.total_tracks&&al.total_tracks>3)?'EP':'Single'; return 'Album'; }
function fsShort(dt){ var M=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return dt.getDate()+' '+M[dt.getMonth()]; }
function fsAdd(found,al,bname,src){ var k=fsKey(al); if(found[k]) return; var dt=fsRelDate(al.release_date);
  found[k]={b:bname||((al.artists&&al.artists[0]&&al.artists[0].name)||''),t:al.name,fmt:fsFmt(al),src:src,date:dt?fsShort(dt):'',url:(al.external_urls&&al.external_urls.spotify)||'',_id:al.id,_t:dt?dt.getTime():0}; }
async function freshAuth(){ var cid=spClientId(); if(!cid){ openSpSettings(); return; }
  var verifier=randStr(96), state=randStr(32); localStorage.setItem('md_pkce',verifier); localStorage.setItem('md_spstate',state); localStorage.setItem('md_freshintent','1');
  var challenge=b64url(await sha256(verifier));
  var p=new URLSearchParams({client_id:cid,response_type:'code',redirect_uri:SP_REDIRECT,code_challenge_method:'S256',code_challenge:challenge,state:state,scope:'playlist-modify-public playlist-modify-private user-follow-read user-top-read'});
  location.href='https://accounts.spotify.com/authorize?'+p.toString(); }
async function checkFreshSingles(){
  var msg=document.getElementById('freshMsg'), btn=document.getElementById('freshChk');
  function setMsg(x){ if(msg) msg.innerHTML=x; }
  var tk=await getToken(); if(!tk){ setMsg('🔑 A abrir login do Spotify…'); freshAuth(); return; }
  if(btn){ btn.disabled=true; btn.textContent='⏳ A verificar…'; } setMsg('A consultar o Spotify…');
  var H={'Authorization':'Bearer '+tk};
  try{
    var meR=await fetch('https://api.spotify.com/v1/me',{headers:H});
    if(meR.status===401){ localStorage.removeItem('md_sptok'); freshAuth(); return; }
    var me=await meR.json(); var mkt=(me&&me.country)||'PT';
    var artists=[], after='', guard=0;
    while(guard++<25){
      var fr=await fetch('https://api.spotify.com/v1/me/following?type=artist&limit=50'+(after?'&after='+after:''),{headers:H});
      if(fr.status===401||fr.status===403){ localStorage.removeItem('md_sptok'); setMsg('🔑 Precisa de autorizar o acesso aos artistas seguidos…'); freshAuth(); return; }
      var fj=await fr.json(); var ar=(fj.artists&&fj.artists.items)||[]; artists=artists.concat(ar);
      after=(fj.artists&&fj.artists.cursors&&fj.artists.cursors.after)||''; if(!after||ar.length<50) break;
    }
    try{ localStorage.setItem('md_spotify_artists',JSON.stringify(artists.map(a=>({id:a.id,name:a.name,genres:a.genres||[]})))); }catch(e){}
    var cutoff=Date.now()-1000*60*60*24*7, found={}, cap=Math.min(artists.length,160), idx=0;
    setMsg('A verificar '+cap+' artistas seguidos…');
    async function worker(){ while(idx<cap){ var a=artists[idx++]; if(!a||!a.id) continue;
      try{ var rr=await fetch('https://api.spotify.com/v1/artists/'+a.id+'/albums?include_groups=album,single,compilation,appears_on&market='+mkt+'&limit=8',{headers:H});
        if(rr.status===429){ await new Promise(function(r){setTimeout(r,1500);}); idx--; continue; }
        var rj=await rr.json(); (rj.items||[]).forEach(function(al){ var d=fsRelDate(al.release_date); if(d&&d.getTime()>=cutoff) fsAdd(found,al,a.name,'Seguidos'); });
      }catch(e){} } }
    var wk=[]; for(var w=0;w<6;w++) wk.push(worker()); await Promise.all(wk);
    try{
      var topR=await fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50',{headers:H});
      var topJ=await topR.json(); var followedIds=new Set(artists.map(function(a){return a.id;}));
      var recommended=(topJ.items||[]).filter(function(a){return a&&a.id&&!followedIds.has(a.id);}).slice(0,20);
      for(var ri=0;ri<recommended.length;ri++){
        var ra=recommended[ri]; var rar=await fetch('https://api.spotify.com/v1/artists/'+ra.id+'/albums?include_groups=album,single,compilation&market='+mkt+'&limit=6',{headers:H});
        var raj=await rar.json(); (raj.items||[]).forEach(function(al){ var d=fsRelDate(al.release_date); if(d&&d.getTime()>=cutoff) fsAdd(found,al,ra.name,'Recomendação'); });
      }
    }catch(e){}
    var items=Object.keys(found).map(function(k){return found[k];}); items.sort(function(a,b){return (b._t||0)-(a._t||0);});
    var recs=items.filter(function(item){return item.src==='Recomendação';}).slice(0,10);
    items=items.filter(function(item){return item.src!=='Recomendação';}).concat(recs);
    var seen={}; try{ seen=JSON.parse(localStorage.getItem('md_fresh_seen')||'{}'); }catch(e){}
    var firstRun=!Object.keys(seen).length;
    var news=items.filter(function(it){ return !seen[it._id]; });
    items.forEach(function(it){ it.star=(!firstRun&&!seen[it._id])?1:0; });
    var nseen={}; items.forEach(function(it){ nseen[it._id]=1; }); localStorage.setItem('md_fresh_seen',JSON.stringify(nseen));
    freshLive=items.slice(0,80); try{ localStorage.setItem('md_fresh_live',JSON.stringify(freshLive)); }catch(e){}
    if(btn){ btn.disabled=false; btn.textContent='🔄 Verificar novos singles'; }
    if(firstRun){ freshLastMessage='✅ Guardei '+items.length+' lançamentos dos últimos 7 dias.'; }
    else if(news.length){ freshLastMessage='🎉 '+news.length+' novidade'+(news.length>1?'s':'')+' — marcadas com ★.'; }
    else { freshLastMessage='✅ Nada de novo desde a última verificação. Não alterei a lista.'; }
    setMsg(freshLastMessage);
    if(sec==='fresh') render();
  }catch(e){ if(btn){ btn.disabled=false; btn.textContent='🔄 Verificar novos singles'; } setMsg('⚠️ Erro a consultar o Spotify. Tenta novamente.'); }
}

function freshHTML(list){
  list=(list||[]);
  if(query) list=list.filter(function(n){return ((n.b+' '+n.t+' '+(n.src||'')).toLowerCase().includes(query));});
  var SP='var(--spotify)';
  var html='<div class="digcard spotifyintro" style="border-left-color:'+SP+'"><span class="eyebrow">A TUA CONTA</span><h3>🎧 O meu Spotify</h3><div class="dl">Liga a tua própria conta para verificar álbuns, EPs, singles, deluxe, reedições e discos ao vivo dos artistas que segues.</div><div class="dl">A pesquisa cobre os últimos 7 dias e acrescenta até 10 recomendações baseadas nos teus artistas mais ouvidos.</div><div class="privacy-note">O sino do Spotify não está disponível na API. Esta área não publica os teus dados: resultados e sessão ficam guardados apenas neste dispositivo.</div></div><div class="radar-actions"><button id="freshChk" class="icsbtn primary">Ligar e verificar Spotify</button><button class="icsbtn secondary" onclick="openSpSettings()">Definições</button><a class="icsbtn secondary" href="https://open.spotify.com/content-feed" target="_blank" rel="noopener">Abrir sino do Spotify ↗</a><span id="freshMsg" class="actionmsg">'+esc(freshLastMessage)+'</span></div>';
  if(!list.length) return html+'<div class="empty compact">Ainda não há resultados pessoais.<br>Liga o Spotify para começar.</div>';
  html+=list.map(function(r){
    var star=r.star?' <span style="color:var(--power)">★</span>':'';
    var fmt=(r.fmt||'Single'); var fc=fmt==='Album'?'var(--power)':(fmt==='EP'?'var(--symph)':SP);
    return '<div class="card" style="border-left-color:'+SP+'">'+
      coverHTML(r.b+' '+r.t, SP)+
      '<div class="band" style="padding-right:0">'+esc(r.b)+star+
        ' <span style="font-size:.56rem;font-weight:800;color:#0c0d10;background:'+fc+';padding:2px 7px;border-radius:999px;vertical-align:middle">'+esc(fmt.toUpperCase())+'</span>'+
      '</div>'+
      '<div class="title">'+esc(r.t)+'</div>'+
      '<div class="meta" style="margin-top:6px"><b style="color:'+SP+'">'+esc(r.src||'Spotify')+'</b>'+(r.date?' · '+esc(r.date):'')+'</div>'+
      '<div class="streams" style="margin-top:8px">'+
        '<a class="strm sp" href="'+spotifyUrl(r)+'" target="_blank" rel="noopener">'+SPOT_SVG+'Spotify</a>'+
        '<a class="strm yt" href="'+ytmUrl(r)+'" target="_blank" rel="noopener">'+YTM_SVG+'YT Music</a>'+
      '</div>'+
    '</div>'; }).join('');
  return html;
}

function radarHTML(){
  const tabs='<div class="segmented radarseg"><button data-radar="general" class="'+(freshMode==='general'?'on':'')+'">Feed geral</button><button data-radar="spotify" class="'+(freshMode==='spotify'?'on':'')+'">O meu Spotify</button></div>';
  if(freshMode==='spotify') return tabs+freshHTML(freshLive||D.fresh);
  const releases=(D.recent||[]).slice().sort((a,b)=>(b.isoDate||'').localeCompare(a.isoDate||''));
  return tabs+'<div class="digcard generalintro"><span class="eyebrow">MUNDO · PORTUGAL EM FOCO</span><h3>⚡ Feed geral</h3><div class="dl">Pesquisa consolidada em imprensa, pesquisas noticiosas, MusicBrainz e fontes independentes. Álbuns, EPs, singles, deluxe, reedições e discos ao vivo dos últimos 14 dias.</div><div class="dl">Itens repetidos são unidos num único cartão com todas as fontes.</div></div><div class="radar-actions"><button id="generalChk" class="icsbtn primary">Atualizar resultados</button><button id="deepScan" class="icsbtn secondary">Pesquisa completa agora ↗</button><span id="generalMsg" class="actionmsg"></span></div>'+renderGrouped(releases,ORDER);
}

function feedHTML(list, accent){
  list=(list||[]);
  if(query) list=list.filter(n=>((n.title+' '+(n.src||'')+' '+(n.d||'')).toLowerCase().includes(query)));
  list=sortFeed(list);
  if(!list.length) return '<div class="empty">Nada por aqui ainda.</div>';
  return list.map(n=>{ const col=accent; const star=n.star?' ★':'';
    const breaking=n.isBreaking?'<span class="status breaking">AGORA</span>':'';
    const rumour=n.status==='rumor'?'<span class="status rumor">RUMOR · '+esc((n.confidence||'low').toUpperCase())+'</span>':'';
    const sourceCount=n.sourceCount>1?' · '+esc(n.sourceCount)+' fontes':'';
    const original=n.titleOriginal?'<details class="original"><summary>Título original</summary>'+esc(n.titleOriginal)+'</details>':'';
    return '<div class="card" style="border-left-color:'+col+'">'+
      coverHTML(newsQ(n.title), col)+
      '<div class="statusrow">'+breaking+rumour+'</div>'+
      '<div class="band" style="padding-right:0">'+esc(n.title)+'<span style="color:var(--power)">'+star+'</span></div>'+
      '<div class="meta" style="margin-top:6px"><b style="color:'+col+'">'+esc(n.src)+'</b> · '+esc(n.date)+sourceCount+(n.d?'<br>'+esc(n.d):'')+'</div>'+original+
      '<a class="spot" style="background:var(--bg2);color:var(--symph);border:1px solid var(--line)" href="'+safeUrl(n.url)+'" target="_blank" rel="noopener noreferrer">Ler →</a>'+
    '</div>'; }).join('');
}
const newsModes={news:'official',buzz:'official',core:'official'};
function splitFeedHTML(list, accent){
  list=list||[];
  const mode=newsModes[sec]||'official';
  const official=list.filter(item=>item.status!=='rumor');
  const rumours=list.filter(item=>item.status==='rumor');
  const selected=mode==='rumor'?rumours:official;
  return '<div class="segmented newsseg"><button data-news="official" class="'+(mode==='official'?'on':'')+'">Confirmadas <span>'+official.length+'</span></button><button data-news="rumor" class="'+(mode==='rumor'?'on':'')+'">Rumores <span>'+rumours.length+'</span></button></div>'+
    (mode==='rumor'?'<div class="rumour-note">Informação não confirmada. A confiança resulta do histórico e do número de fontes independentes.</div>':'')+
    feedHTML(selected,accent);
}
function wireNewsTabs(){
  document.querySelectorAll('[data-news]').forEach(button=>button.onclick=()=>{
    newsModes[sec]=button.dataset.news; render();
  });
}
function render(){
  if(!D) return;
  const m=document.getElementById('main'); let html='', shown=0;
  document.getElementById('chips').style.display=(sec==='recent'||sec==='alter'||sec==='future')?'flex':'none';
  document.getElementById('plBtnTd').style.display=(sec==='recent'||sec==='alter'||sec==='main')?'inline-flex':'none';
  if(sec==='search'){ m.innerHTML=renderSearch(); wireCards(); observeCovers(); updateBadge(); return; }
  if(sec==='fresh'){ m.innerHTML=radarHTML(); wireCards(); observeCovers(); wireFresh(); updateBadge(); return; }
  if(sec==='follow'){ m.innerHTML=renderFollow(); wireCards(); observeCovers(); updateBadge(); return; }
  if(sec==='pt'){ m.innerHTML=renderPT(); wireCards(); observeCovers(); updateBadge(); return; }
  if(sec==='core'){ m.innerHTML=renderMC(); wireCards(); wireNewsTabs(); observeCovers(); updateBadge(); return; }
  if(sec==='watch'){ m.innerHTML=renderWatch(); wireCards(); observeCovers(); updateBadge(); return; }
  if(sec==='rev'){ m.innerHTML=renderReviews(); observeCovers(); updateBadge(); return; }
  if(sec==='digest'){ m.innerHTML=renderDigest(); observeCovers(); updateBadge(); return; }
  if(sec==='stats'){ m.innerHTML=renderStats(); updateBadge(); return; }
  if(sec==='news'){ m.innerHTML=splitFeedHTML(D.news,'var(--symph)'); wireNewsTabs(); observeCovers(); updateBadge(); return; }
  if(sec==='buzz'){ m.innerHTML=splitFeedHTML(D.buzz,'var(--pop)'); wireNewsTabs(); observeCovers(); updateBadge(); return; }
  if(sec==='dt'){ m.innerHTML=bioCard((D.bios||{}).dt,'var(--prog)')+feedHTML(D.dt,'var(--prog)'); observeCovers(); updateBadge(); return; }
  if(sec==='st'){ m.innerHTML=bioCard((D.bios||{}).st,'var(--indus)')+feedHTML(D.st,'var(--indus)'); observeCovers(); updateBadge(); return; }
  if(sec==='future'){
    html+='<button class="icsbtn" id="icsBtn">📅 Exportar para o calendário (.ics)</button>';
    D.future.forEach(day=>{
      const items=day.items.filter(matchFilter); if(!items.length)return; shown+=items.length;
      html+='<div class="tl-date"><span class="bub"></span><div><h3>'+esc(day.date)+'</h3>'+
        '<div class="lbl">'+esc(day.lbl)+'</div></div></div>';
      html+=items.map(cardHTML).join('');
    });
  } else {
    const src=(sec==='alter'?D.alter:(sec==='main'?(D.main||[]):D.recent));
    const list=src.filter(matchFilter);
    shown=list.length; html=renderGrouped(list, sec==='main'?MORDER:ORDER);
  }
  m.innerHTML = shown ? html :
    '<div class="empty">Nada encontrado.<br>'+(view!=='all'?'Experimenta o separador "Tudo".':'Ajusta a pesquisa ou os filtros.')+'</div>';
  wireCards();
  updateBadge();
}
const MONTHS={'jan':0,'fev':1,'mar':2,'abr':3,'mai':4,'jun':5,'jul':6,'ago':7,'set':8,'out':9,'nov':10,'dez':11};
function parseFutureDate(s){
  const m=(s||'').toLowerCase().match(/(\d{1,2})\s*([a-zç]{3})/); if(!m) return null;
  const mo=MONTHS[m[2].slice(0,3)]; if(mo===undefined) return null;
  const base=D&&D.generated?new Date(D.generated):new Date();
  let yr=base.getFullYear(); if(mo<base.getMonth()) yr++;
  return new Date(yr,mo,parseInt(m[1],10)); }
function icsDate(d){ return d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2); }
function exportICS(){
  if(!D||!D.future){ toast('Sem dados',''); return; }
  let ev='';
  D.future.forEach(day=>{ const dt=parseFutureDate(day.date); if(!dt) return;
    const start=icsDate(dt); const end=icsDate(new Date(dt.getTime()+86400000));
    day.items.forEach((r,i)=>{
      const uid=icsDate(dt)+'-'+i+'-'+(r.b||'').replace(/[^a-z0-9]/gi,'').slice(0,16)+'@nowplaying';
      const sum=(r.b+' — '+r.t).replace(/[,;\\]/g,' ');
      const desc=((r.lbl&&r.lbl!=='—'?r.lbl+' · ':'')+(GL[r.g]||r.g)+(r.d?' · '+r.d:'')).replace(/[,;\\]/g,' ').replace(/\n/g,' ');
      ev+='BEGIN:VEVENT\r\nUID:'+uid+'\r\nDTSTART;VALUE=DATE:'+start+'\r\nDTEND;VALUE=DATE:'+end+
        '\r\nSUMMARY:🤘 '+sum+'\r\nDESCRIPTION:'+desc+'\r\nEND:VEVENT\r\n';
    });
  });
  if(!ev){ toast('Sem datas para exportar',''); return; }
  const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Now Playing//Metal Daily//PT\r\nCALSCALE:GREGORIAN\r\n'+ev+'END:VCALENDAR\r\n';
  const blob=new Blob([ics],{type:'text/calendar'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='lancamentos-metal.ics';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('Calendário exportado 📅','ok');
}
function wireCards(){
  const m=document.getElementById('main');
  const ics=document.getElementById('icsBtn'); if(ics) ics.onclick=exportICS;
  const bq=document.getElementById('bandQ'); if(bq && !bq._wired){ bq._wired=1; let _bt; bq.addEventListener('input',function(e){ clearTimeout(_bt); const v=e.target.value.trim(); _bt=setTimeout(function(){ searchBands(v); },300); }); }
  m.querySelectorAll('.bchip').forEach(c=>c.onclick=()=>openBand(decodeURIComponent(c.dataset.name)));
  m.querySelectorAll('.card .chead').forEach(h=>h.onclick=()=>h.closest('.card').classList.toggle('open'));
  observeCovers();
  m.querySelectorAll('.acts button').forEach(b=>b.onclick=e=>{
    e.preventDefault();const k=b.dataset.act,id=b.dataset.id;
    if(k==='share'){
      const card=b.closest('.card');
      const band=card.querySelector('.band').childNodes[0].nodeValue.trim();
      const title=card.querySelector('.title').textContent.trim();
      const url='https://open.spotify.com/search/'+encodeURIComponent(band+' '+title);
      const data={title:band+' — '+title,text:'Novo lançamento: '+band+' — '+title+' 🤘',url:url};
      if(navigator.share){navigator.share(data).catch(()=>{});}
      else if(navigator.clipboard){navigator.clipboard.writeText(data.text+' '+url);toast('Link copiado','ok');}
      return;
    }
    if(k==='follow'){
      const band=decodeURIComponent(b.dataset.band); const bk=bandKey(band);
      const o=store.follow; const now=isFollowed(band);
      o[bk]=now?0:1; toast(now?('Removeste '+band):('Guardaste '+band+' ⭐'), now?'':'ok');
      store.set('follow',o); applyCounts(); render(); return;
    }
    const o=store[k];if(o[id])delete o[id];else o[id]=1;store.set(k,o);render();
  });
}
let _jpN=0;
function jsonp(url){ return new Promise(res=>{
  const cb='__jp'+(++_jpN); let done=false; const sc=document.createElement('script');
  function fin(v){ if(done)return; done=true; try{delete window[cb];}catch(e){window[cb]=undefined;} if(sc.parentNode)sc.parentNode.removeChild(sc); res(v); }
  window[cb]=function(d){ fin(d); };
  sc.onerror=function(){ fin(null); };
  sc.src=url+(url.indexOf('?')<0?'?':'&')+'callback='+cb;
  (document.body||document.documentElement).appendChild(sc);
  setTimeout(function(){ fin(null); },8000);
});}
function toggleFollowName(nm){ const bk=bandKey(nm); const o=store.follow; const now=isFollowed(nm); o[bk]=now?0:1; store.set('follow',o); applyCounts(); return !now; }
async function searchBands(term){
  const inp=document.getElementById('bandQ'); const target=(inp&&inp.dataset.target)||'follow';
  const box=document.getElementById('bandRes'); if(!box) return;
  if(!term||term.length<2){ box.innerHTML=''; return; }
  box.innerHTML='<div class="bres-load">A procurar…</div>';
  const d=await jsonp('https://itunes.apple.com/search?media=music&entity=musicArtist&limit=8&term='+encodeURIComponent(term));
  const arr=(d&&d.results)||[];
  if(!arr.length){ box.innerHTML='<div class="bres-load">Nada encontrado. Tenta outro nome.</div>'; return; }
  const onTxt=target==='watch'?'✓ A vigiar':'✓ Guardada', addTxt=target==='watch'?'＋ Vigiar':'＋ Guardar';
  box.innerHTML=arr.map(a=>{ const nm=String(a.artistName||''); const on=target==='watch'?isWatched(nm):isFollowed(nm);
    return '<div class="bres" data-name="'+encodeURIComponent(nm)+'" data-aid="'+(a.artistId||'')+'">'+
      '<div class="bres-i"><div class="bres-n">'+esc(nm)+'</div><div class="bres-g">'+esc(a.primaryGenreName)+'</div></div>'+
      '<button class="bres-add'+(on?' on':'')+'" data-name="'+encodeURIComponent(nm)+'">'+(on?onTxt:addTxt)+'</button>'+
    '</div>'; }).join('');
  box.querySelectorAll('.bres-add').forEach(b=>b.onclick=ev=>{ ev.stopPropagation();
    const nm=decodeURIComponent(b.dataset.name); const added=toggleList(target,nm);
    b.classList.toggle('on',added); b.textContent=added?onTxt:addTxt;
    toast(added?(nm+' adicionada ⭐'):('Removeste '+nm), added?'ok':''); });
  box.querySelectorAll('.bres').forEach(r=>r.onclick=()=>openBand(decodeURIComponent(r.dataset.name), r.dataset.aid));
}
function bandBio(name){ return new Promise(async res=>{
  for(const lang of ['pt','en']){
    const d=await jsonp('https://'+lang+'.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&format=json&titles='+encodeURIComponent(name));
    try{ const pg=d&&d.query&&d.query.pages; if(pg){ const k=Object.keys(pg)[0]; const ex=pg[k]&&pg[k].extract;
      if(ex&&ex.length>40){ res(ex.length>650?ex.slice(0,650)+'…':ex); return; } } }catch(e){}
  }
  res('');
});}
async function openBand(name, aid){
  const modal=document.getElementById('bandModal'), body=document.getElementById('bandBody');
  modal.classList.add('show'); try{history.pushState({nav:'modal'},'');}catch(e){}
  const on=isFollowed(name), onW=isWatched(name);
  body.innerHTML='<div class="bd-head"><div class="bd-name">'+esc(name)+'</div></div>'+
    '<div class="bd-btns"><button id="bdFollow" class="bd-foll'+(on?' on':'')+'">'+(on?'★ Guardada':'☆ Guardar')+'</button>'+
    '<button id="bdWatch" class="bd-foll'+(onW?' on':'')+'">'+(onW?'👀 A vigiar':'👁 Vigiar')+'</button></div>'+
    '<div id="bdBio" class="bd-bio">A carregar bio…</div>'+
    '<a class="bd-sp" href="https://open.spotify.com/search/'+encodeURIComponent(name)+'" target="_blank" rel="noopener">Abrir no Spotify</a>'+
    '<div class="bd-disc-h">Discografia</div><div id="bdDisc" class="bd-disc">A carregar…</div>';
  document.getElementById('bdFollow').onclick=function(){ const added=toggleList('follow',name);
    this.classList.toggle('on',added); this.textContent=added?'★ Guardada':'☆ Guardar';
    toast(added?('Guardaste '+name+' ⭐'):('Removeste '+name), added?'ok':''); };
  document.getElementById('bdWatch').onclick=function(){ const added=toggleList('watch',name);
    this.classList.toggle('on',added); this.textContent=added?'👀 A vigiar':'👁 Vigiar';
    toast(added?(name+' em vigia 👀'):('Saiu da vigia: '+name), added?'ok':''); };
  bandBio(name).then(t=>{ const el=document.getElementById('bdBio'); if(el) el.textContent=t||'Sem biografia disponível.'; });
  let id=aid;
  if(!id){ const s=await jsonp('https://itunes.apple.com/search?media=music&entity=musicArtist&limit=1&term='+encodeURIComponent(name)); id=s&&s.results&&s.results[0]&&s.results[0].artistId; }
  let albums=[];
  if(id){ const d=await jsonp('https://itunes.apple.com/lookup?id='+id+'&entity=album&limit=80'); albums=((d&&d.results)||[]).filter(x=>x.wrapperType==='collection'); }
  const seen={}; albums=albums.filter(a=>{ const n=(a.collectionName||'').toLowerCase(); if(seen[n])return false; seen[n]=1; return true; });
  albums.sort((a,b)=>(b.releaseDate||'').localeCompare(a.releaseDate||''));
  const disc=document.getElementById('bdDisc'); if(!disc) return;
  disc.innerHTML = albums.length ? albums.map(a=>'<div class="bd-alb"><span class="bd-yr">'+esc((a.releaseDate||'').slice(0,4)||'—')+'</span><span class="bd-al">'+esc(a.collectionName)+'</span></div>').join('') : 'Sem discografia encontrada.';
}
function renderFollow(){
  const keys=followKeys();
  const spotifyArtists=readJSON('md_spotify_artists',[]);
  const spotifyKeys=spotifyArtists.map(a=>bandKey(a.name)).filter(Boolean);
  const allKeys=[...new Set(keys.concat(spotifyKeys))];
  const search='<div class="bandsearch"><input id="bandQ" data-target="follow" type="search" placeholder="🔎 Procurar banda para guardar…" autocomplete="off" autocapitalize="off" spellcheck="false"><div id="bandRes"></div></div>';
  if(!allKeys.length) return search+'<div class="empty">Ainda não tens bandas guardadas.<br>Adiciona uma banda ou liga o Spotify no Radar.</div>';
  const rel=allReleases().filter(r=>allKeys.includes(bandKey(r.b)));
  const nws=allNews().filter(n=>allKeys.some(k=>(n.title||'').toLowerCase().includes(k)));
  const chips=keys.map(k=>{ const disp=k.replace(/\b\w/g,c=>c.toUpperCase()); return '<button class="bchip" data-name="'+encodeURIComponent(k)+'">'+esc(disp)+'</button>'; }).join('');
  const spChips=spotifyArtists.map(a=>'<button class="bchip spotifychip" data-name="'+encodeURIComponent(a.name)+'">'+esc(a.name)+'</button>').join('');
  let html=search+'<div class="digcard" style="border-left-color:var(--power)"><span class="eyebrow">GUARDADAS NA APP</span><h3>⭐ As tuas bandas ('+keys.length+')</h3><div class="dl">Escolhidas manualmente neste dispositivo.</div><div class="bchips">'+(chips||'<span class="mutedline">Ainda sem bandas manuais.</span>')+'</div></div>'+
    '<div class="digcard" style="border-left-color:var(--spotify)"><span class="eyebrow">SEGUIDAS NO SPOTIFY</span><h3>🎧 Spotify ('+spotifyArtists.length+')</h3><div class="dl">Importadas da conta ligada. Os dois grupos mantêm-se separados e os resultados não se repetem.</div><div class="bchips">'+(spChips||'<span class="mutedline">Liga o Spotify no Radar para preencher esta área.</span>')+'</div></div>';
  if(rel.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--power)"></span><span style="color:var(--power)">Lançamentos</span><span class="count">'+rel.length+'</span></div>'+rel.map(cardHTML).join(''); }
  if(nws.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--symph)"></span><span style="color:var(--symph)">Notícias</span><span class="count">'+nws.length+'</span></div>'+feedHTML(nws,'var(--symph)'); }
  if(!rel.length && !nws.length) html+='<div class="empty">Sem novidades das tuas bandas nesta edição.<br>Voltamos a avisar quando houver. 🤘</div>';
  return html;
}
function renderPT(){
  const rel=allReleases().filter(isPT); const nws=allNews().filter(isPT); const pt=(D.pt||[]);
  if(!rel.length && !nws.length && !pt.length) return '<div class="empty">🇵🇹 Sem novidades nacionais nesta edição.<br>Fontes: Metal Imperium e Caminhos Metálicos.</div>';
  let html='';
  if(pt.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--core)"></span><span style="color:var(--core)">Cena Nacional</span><span class="count">'+pt.length+'</span></div>'+feedHTML(pt,'var(--core)'); }
  if(rel.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--core)"></span><span style="color:var(--core)">Lançamentos PT</span><span class="count">'+rel.length+'</span></div>'+rel.map(cardHTML).join(''); }
  if(nws.length){ html+='<div class="genre-h"><span class="dot" style="background:var(--symph)"></span><span style="color:var(--symph)">Mais Notícias PT</span><span class="count">'+nws.length+'</span></div>'+feedHTML(nws,'var(--symph)'); }
  return html;
}
function renderDigest(){
  const rel=[].concat(D.recent||[],D.alter||[]); const fut=(D.future||[]).reduce((a,d)=>a.concat(d.items),[]);
  const stars=allReleases().filter(r=>r.star);
  const gcount={}; rel.forEach(r=>gcount[r.g]=(gcount[r.g]||0)+1);
  const topG=Object.keys(gcount).sort((a,b)=>gcount[b]-gcount[a]).slice(0,3);
  const topNews=(D.news||[]).filter(n=>n.star).slice(0,4);
  let h='<div class="digcard"><h3>🗞️ Resumo · '+(D.range||D.generated||'')+'</h3>'+
    '<div class="dl"><b>'+rel.length+'</b> lançamentos de metal/rock e <b>'+(D.main||[]).length+'</b> mainstream nesta edição.</div>'+
    '<div class="dl"><b>'+(D.news||[]).length+'</b> notícias e <b>'+(D.buzz||[]).length+'</b> de música geral.</div>'+
    '<div class="dl"><b>'+fut.length+'</b> lançamentos já anunciados na timeline.</div>'+
    (topG.length?'<div class="dl">Subgéneros mais ativos: <b>'+topG.map(g=>GL[g]).join('</b>, <b>')+'</b>.</div>':'')+
    '</div>';
  if(stars.length){ h+='<div class="genre-h"><span class="dot" style="background:var(--power)"></span><span style="color:var(--power)">★ Destaques da semana</span><span class="count">'+stars.length+'</span></div>'+stars.map(cardHTML).join(''); }
  if(topNews.length){ h+='<div class="genre-h"><span class="dot" style="background:var(--symph)"></span><span style="color:var(--symph)">Manchetes</span></div>'+feedHTML(topNews,'var(--symph)'); }
  return h;
}
function renderStats(){
  const rel=allReleases(); const metalRel=[].concat(D.recent||[],D.alter||[],(D.future||[]).reduce((a,d)=>a.concat(d.items),[]));
  const gcount={}; metalRel.forEach(r=>gcount[r.g]=(gcount[r.g]||0)+1);
  const mcount={}; (D.main||[]).forEach(r=>mcount[r.g]=(mcount[r.g]||0)+1);
  const stars=rel.filter(r=>r.star).length; const foll=Object.keys(store.follow).length;
  let h='<div class="statwrap">';
  h+='<div class="stattiles">'+
    '<div class="sttile"><div class="big" style="color:var(--death)">'+metalRel.length+'</div><div class="lab">Metal/Rock</div></div>'+
    '<div class="sttile"><div class="big" style="color:var(--pop)">'+(D.main||[]).length+'</div><div class="lab">Mainstream</div></div>'+
    '<div class="sttile"><div class="big" style="color:var(--power)">'+stars+'</div><div class="lab">Destaques</div></div>'+
    '<div class="sttile"><div class="big" style="color:var(--core)">'+foll+'</div><div class="lab">A seguir</div></div>'+
    '</div>';
  const order=ORDER.filter(g=>gcount[g]).sort((a,b)=>gcount[b]-gcount[a]);
  const max=Math.max.apply(null,order.map(g=>gcount[g]).concat([1]));
  h+='<div class="statbox"><h3>Metal / Rock por subgénero</h3>';
  order.forEach(g=>{ const w=Math.round(gcount[g]/max*100);
    h+='<div class="statrow"><span class="sl"><span class="dot" style="background:'+cv(g)+'"></span>'+GL[g]+'</span>'+
      '<span class="sbar"><i style="width:'+w+'%;background:'+cv(g)+'"></i></span><span class="sv">'+gcount[g]+'</span></div>'; });
  h+='</div>';
  const morder=MORDER.filter(g=>mcount[g]).sort((a,b)=>mcount[b]-mcount[a]);
  if(morder.length){ const mmax=Math.max.apply(null,morder.map(g=>mcount[g]).concat([1]));
    h+='<div class="statbox"><h3>Mainstream por género</h3>';
    morder.forEach(g=>{ const w=Math.round(mcount[g]/mmax*100);
      h+='<div class="statrow"><span class="sl"><span class="dot" style="background:'+cv(g)+'"></span>'+GL[g]+'</span>'+
        '<span class="sbar"><i style="width:'+w+'%;background:'+cv(g)+'"></i></span><span class="sv">'+mcount[g]+'</span></div>'; });
    h+='</div>'; }
  const spotifyArtists=readJSON('md_spotify_artists',[]), personal=freshLive||[];
  h+='<div class="statbox personalstats"><h3>O meu Spotify</h3>'+
    (spotifyArtists.length?'<div class="stattiles"><div class="sttile"><div class="big" style="color:var(--spotify)">'+spotifyArtists.length+'</div><div class="lab">Artistas seguidos</div></div><div class="sttile"><div class="big" style="color:var(--spotify)">'+personal.length+'</div><div class="lab">Lançamentos · 7 dias</div></div><div class="sttile"><div class="big" style="color:var(--power)">'+personal.filter(x=>x.src==='Recomendação').length+'</div><div class="lab">Recomendações</div></div></div>':'<div class="privacy-note">Liga a tua conta na pasta Radar para veres aqui estatísticas pessoais. Estes dados ficam apenas neste dispositivo.</div>')+'</div>';
  h+='</div>';
  return h;
}
function updateBadge(){
  const n=Object.keys(store.fav).length;const bd=document.getElementById('favbadge');
  bd.style.display=n?'flex':'none';bd.textContent=n;
  const hh=Object.keys(store.heard).length;
  document.getElementById('favnote').textContent=(n||hh)?('❤ '+n+' favorito(s) · 🎧 '+hh+' ouvido(s) neste telemóvel'):'';
}

document.getElementById('backBtn').addEventListener('click',()=>{ if(route!=='home'){ history.back(); } else { goHome(); } });
document.querySelector('.brand h1').addEventListener('click',()=>{ if(route!=='home') history.back(); });
function closeOpenModals(){ let c=false; ['histModal','spModal','bandModal','notifModal'].forEach(id=>{ const el=document.getElementById(id); if(el&&el.classList.contains('show')){ el.classList.remove('show'); c=true; } }); return c; }
window.addEventListener('popstate',function(){ if(closeOpenModals()) return; if(route!=='home'){ goHome(); } });
document.querySelectorAll('.bottombar button').forEach(b=>b.onclick=()=>{
  view=b.dataset.view;document.querySelectorAll('.bottombar button').forEach(x=>x.classList.toggle('on',x===b));
  render();
});
let qt;document.getElementById('q').addEventListener('input',e=>{
  clearTimeout(qt);qt=setTimeout(()=>{
    query=e.target.value.trim().toLowerCase();
    if(query&&route==='home'){
      sec='search'; route='section'; document.getElementById('secTitle').textContent='Pesquisa global'; setChrome();
      try{history.pushState({nav:'section'},'');}catch(err){}
    }
    if(sec==='search'&&query){render();loadArchive();}
    else if(sec==='search'&&!query){goHome();}
    else render();
  },160);
});
document.getElementById('hdate').addEventListener('click',openHistory);
document.getElementById('histBack').addEventListener('click',()=>loadSnapshot(''));
document.getElementById('histModal').addEventListener('click',e=>{ if(e.target.id==='histModal') history.back(); });
document.getElementById('plBtnTd').addEventListener('click',createTidalPlaylist);
document.getElementById('spCfg').addEventListener('click',openSpSettings);
document.getElementById('notifBtn').addEventListener('click',function(){
  const saved=readJSON('md_notifications',{breaking:true,followed:true});
  document.querySelectorAll('#notifModal input[type="checkbox"]').forEach(input=>input.checked=!!saved[input.value]);
  document.getElementById('notifModal').classList.add('show');
  try{history.pushState({nav:'modal'},'');}catch(e){}
});
document.getElementById('notifClose').addEventListener('click',()=>history.back());
document.getElementById('notifModal').addEventListener('click',e=>{if(e.target.id==='notifModal')history.back();});
document.getElementById('notifSave').addEventListener('click',function(){
  const preferences={}; document.querySelectorAll('#notifModal input[type="checkbox"]').forEach(input=>preferences[input.value]=input.checked);
  localStorage.setItem('md_notifications',JSON.stringify(preferences));
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  OneSignalDeferred.push(async function(OneSignal){
    try{ await OneSignal.Notifications.requestPermission();
      const tags={}; Object.keys(preferences).forEach(key=>tags['notify_'+key]=preferences[key]?'1':'0');
      if(OneSignal.User&&OneSignal.User.addTags) await OneSignal.User.addTags(tags);
      document.getElementById('notifModal').classList.remove('show');
      toast(OneSignal.Notifications.permission?'Preferências guardadas 🔔':'Preferências guardadas; falta permitir notificações', OneSignal.Notifications.permission?'ok':'');
    }catch(e){ toast('Não foi possível ativar as notificações',''); }
  });
});
document.getElementById('spModal').addEventListener('click',e=>{ if(e.target.id==='spModal') history.back(); });
document.getElementById('spClose').addEventListener('click',()=>history.back());
document.getElementById('bandClose').addEventListener('click',()=>history.back());
document.getElementById('bandModal').addEventListener('click',e=>{ if(e.target.id==='bandModal') history.back(); });
document.getElementById('spSave').addEventListener('click',()=>{
  const v=document.getElementById('spInput').value.trim();
  if(!v){ toast('Cola o Client ID primeiro',''); return; }
  localStorage.setItem('md_spclient',v); document.getElementById('spModal').classList.remove('show');
  toast('Client ID guardado — a ligar…','ok'); startSpotifyAuth();
});

document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') loadData('resume'); });
window.addEventListener('pageshow',e=>{ if(e.persisted) loadData('resume'); });
window.addEventListener('focus',()=>loadData('resume'));

(function(){
  const ptr=document.getElementById('ptr'), txt=document.getElementById('ptrtxt');
  let startY=0, pulling=false, dist=0; const TH=70;
  window.addEventListener('touchstart',e=>{
    if(window.scrollY<=0 && !loading){ startY=e.touches[0].clientY; pulling=true; dist=0; }
  },{passive:true});
  window.addEventListener('touchmove',e=>{
    if(!pulling) return;
    dist=e.touches[0].clientY-startY;
    if(dist>0){ const h=Math.min(dist*0.5,80); ptr.style.height=h+'px';
      txt.textContent = h>=TH*0.5 ? 'Larga para atualizar' : 'Puxar para atualizar'; }
  },{passive:true});
  window.addEventListener('touchend',async()=>{
    if(!pulling) return; pulling=false;
    if(parseFloat(ptr.style.height||'0')>=TH*0.5){
      ptr.classList.add('loading'); ptr.style.height='44px'; txt.textContent='A atualizar…';
      await loadData('pull');
      ptr.classList.remove('loading');
    }
    ptr.style.height='0px';
  });
})();

(async function(){ setChrome(); renderHome(); await loadData('boot'); loadBands();
  var _u=new URL(location.href);
  if(_u.searchParams.get('code') && localStorage.getItem('md_tdpkce')){ await handleTidalReturn(); }
  else { await handleAuthReturn(); }
})();
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
/* features v2: follow, star, PT, digest, stats, ics */
