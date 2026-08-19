(function(){
  "use strict";

  // ============================================================
  // TOASTS
  // ============================================================
  const toastsEl = document.getElementById('toasts');
  function toast(msg, type){
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    toastsEl.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s ease'; setTimeout(()=>el.remove(), 300); }, 4200);
  }

  // ============================================================
  // GITHUB CONFIG (stored locally in this browser only)
  // ============================================================
  const GH_KEY = 'tourhorizon_gh_config';
  function getConfig(){
    try{ return JSON.parse(localStorage.getItem(GH_KEY) || 'null'); }catch(e){ return null; }
  }
  function setConfig(cfg){ localStorage.setItem(GH_KEY, JSON.stringify(cfg)); }
  function clearConfig(){ localStorage.removeItem(GH_KEY); }

  function refreshGhStatus(){
    const cfg = getConfig();
    const dot = document.getElementById('ghDot');
    const txt = document.getElementById('ghStatusTxt');
    if(cfg && cfg.token){
      dot.classList.add('on');
      txt.textContent = cfg.ownerRepo;
    } else {
      dot.classList.remove('on');
      txt.textContent = 'GitHub non connecté';
    }
  }
  refreshGhStatus();

  // Settings modal
  const overlaySettings = document.getElementById('overlaySettings');
  const formSettings = document.getElementById('formSettings');
  const gErr = document.getElementById('gErr');
  const gOk = document.getElementById('gOk');

  document.getElementById('openSettings').addEventListener('click', ()=>{
    const cfg = getConfig();
    if(cfg){
      document.getElementById('gOwnerRepo').value = cfg.ownerRepo || '';
      document.getElementById('gBranch').value = cfg.branch || 'main';
      document.getElementById('gToken').value = cfg.token || '';
    }
    gErr.style.display = 'none'; gOk.style.display = 'none';
    overlaySettings.classList.add('open');
  });
  overlaySettings.addEventListener('click', (e)=>{ if(e.target === overlaySettings) overlaySettings.classList.remove('open'); });
  document.getElementById('gDisconnect').addEventListener('click', ()=>{
    clearConfig();
    formSettings.reset();
    refreshGhStatus();
    toast('Déconnecté de GitHub.');
    overlaySettings.classList.remove('open');
  });

  formSettings.addEventListener('submit', async (e)=>{
    e.preventDefault();
    gErr.style.display = 'none'; gOk.style.display = 'none';
    const ownerRepo = document.getElementById('gOwnerRepo').value.trim().replace(/^\/|\/$/g,'');
    const branch = document.getElementById('gBranch').value.trim() || 'main';
    const token = document.getElementById('gToken').value.trim();
    if(!ownerRepo.includes('/')){
      gErr.textContent = 'Format attendu : proprietaire/depot';
      gErr.style.display = 'block';
      return;
    }
    const btn = document.getElementById('gSave');
    btn.disabled = true; btn.textContent = 'Vérification…';
    try{
      const res = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
        headers: { 'Authorization': 'token ' + token, 'Accept':'application/vnd.github+json' }
      });
      if(!res.ok){ throw new Error(res.status === 404 ? 'Dépôt introuvable ou jeton sans accès.' : 'Échec de connexion (' + res.status + ').'); }
      setConfig({ ownerRepo, branch, token });
      refreshGhStatus();
      gOk.textContent = 'Connecté avec succès.';
      gOk.style.display = 'block';
      toast('Connecté à ' + ownerRepo, 'ok');
      setTimeout(()=> overlaySettings.classList.remove('open'), 700);
      loadWorks();
    }catch(err){
      gErr.textContent = err.message;
      gErr.style.display = 'block';
    }finally{
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });

  // ============================================================
  // GITHUB CONTENTS API HELPERS
  // ============================================================
  function b64EncodeUtf8(str){
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUtf8(b64){
    return decodeURIComponent(escape(atob(b64.replace(/\n/g,''))));
  }

  async function ghGetFile(path){
    const cfg = getConfig();
    const res = await fetch(`https://api.github.com/repos/${cfg.ownerRepo}/contents/${path}?ref=${cfg.branch}`, {
      headers: { 'Authorization': 'token ' + cfg.token, 'Accept':'application/vnd.github+json' }
    });
    if(res.status === 404) return null;
    if(!res.ok) throw new Error('Lecture GitHub échouée (' + res.status + ')');
    return res.json();
  }

  async function ghPutFile(path, base64Content, message, sha){
    const cfg = getConfig();
    const body = { message, content: base64Content, branch: cfg.branch };
    if(sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${cfg.ownerRepo}/contents/${path}`, {
      method:'PUT',
      headers: { 'Authorization': 'token ' + cfg.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const t = await res.text();
      throw new Error('Écriture GitHub échouée (' + res.status + ') ' + t.slice(0,150));
    }
    return res.json();
  }

  async function ghDeleteFile(path, sha, message){
    const cfg = getConfig();
    const res = await fetch(`https://api.github.com/repos/${cfg.ownerRepo}/contents/${path}`, {
      method:'DELETE',
      headers: { 'Authorization': 'token ' + cfg.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
      body: JSON.stringify({ message, sha, branch: cfg.branch })
    });
    if(!res.ok) throw new Error('Suppression GitHub échouée (' + res.status + ')');
  }

  function slugify(text){
    return text.toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'') || 'travail';
  }

  // ============================================================
  // WORKS DATA
  // ============================================================
  let works = [];
  let worksSha = null; // sha of works.json in the repo, if connected

  const grid = document.getElementById('grid');
  const count = document.getElementById('count');

  async function loadWorks(){
    // Public read: fetch the committed works.json straight from the site itself.
    try{
      const res = await fetch('works.json', { cache: 'no-store' });
      if(res.ok){
        works = await res.json();
      } else {
        works = [];
      }
    }catch(e){
      works = [];
    }
    renderGrid();
  }

  function renderGrid(){
    grid.innerHTML = '';
    count.textContent = works.length + (works.length <= 1 ? ' travail publié' : ' travaux publiés');

    if(works.length === 0){
      grid.innerHTML = `
        <div class="empty">
          <div class="brand-mark"></div>
          <h3>Aucun travail pour l'instant</h3>
          <p>Ajoutez votre première image 360° pour commencer votre portfolio immersif.</p>
          <button class="btn btn-solid" id="emptyAdd">+ Ajouter un travail</button>
        </div>`;
      document.getElementById('emptyAdd').addEventListener('click', openModal);
      return;
    }

    works.forEach(w => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-porthole" data-id="${w.id}">
          <div class="card-img"><img src="${w.image}" alt="${w.title}" loading="lazy"></div>
          <div class="card-play">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="16" stroke="#e4c878" stroke-width="1.3"/>
              <path d="M14 11.5L23 17L14 22.5V11.5Z" fill="#e4c878"/>
            </svg>
          </div>
          <div class="card-ring"></div>
          <button class="card-del" data-del="${w.id}" title="Supprimer">✕</button>
        </div>
        <div class="card-title">${w.title}</div>
        <div class="card-meta">${w.tag}${w.place ? ' · ' + w.place : ''}</div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.card-porthole').forEach(el=>{
      el.addEventListener('click', (e)=>{
        if(e.target.closest('.card-del')) return;
        openViewer(el.dataset.id);
      });
    });
    grid.querySelectorAll('[data-del]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.stopPropagation();
        deleteWork(el.dataset.del);
      });
    });
  }

  async function deleteWork(id){
    const cfg = getConfig();
    if(!cfg){
      toast('Connectez GitHub (⚙) pour gérer vos travaux publiés.', 'err');
      return;
    }
    const work = works.find(w => String(w.id) === String(id));
    if(!work) return;
    if(!confirm(`Supprimer « ${work.title} » du dépôt GitHub ?`)) return;
    try{
      const updated = works.filter(w => String(w.id) !== String(id));
      const current = await ghGetFile('works.json');
      await ghPutFile('works.json', b64EncodeUtf8(JSON.stringify(updated, null, 2)), `Suppression : ${work.title}`, current ? current.sha : undefined);
      try{
        const imgFile = await ghGetFile(work.image);
        if(imgFile) await ghDeleteFile(work.image, imgFile.sha, `Suppression de l'image : ${work.title}`);
      }catch(e){ /* image already missing, ignore */ }
      works = updated;
      renderGrid();
      toast('Travail supprimé de GitHub.', 'ok');
    }catch(err){
      toast(err.message, 'err');
    }
  }

  loadWorks();

  // ============================================================
  // ADD-WORK MODAL
  // ============================================================
  const overlay = document.getElementById('overlay');
  const form = document.getElementById('form');
  const fFile = document.getElementById('fFile');
  const fTitle = document.getElementById('fTitle');
  const dropTxt = document.getElementById('dropTxt');
  const drop = document.getElementById('drop');
  const submitAdd = document.getElementById('submitAdd');
  const fileErr = document.getElementById('fileErr');
  let pendingImage = null;
  let pendingFile = null;

  function openModal(){
    if(!getConfig()){
      toast('Connectez votre dépôt GitHub (⚙) avant de publier.', 'err');
    }
    overlay.classList.add('open');
  }
  function closeModal(){
    overlay.classList.remove('open');
    form.reset();
    pendingImage = null; pendingFile = null;
    dropTxt.innerHTML = '<strong>Cliquez</strong> ou déposez une image ici';
    fileErr.style.display = 'none';
    checkValid();
  }
  document.getElementById('openAdd').addEventListener('click', openModal);
  document.getElementById('openAddHero').addEventListener('click', openModal);
  document.getElementById('cancelAdd').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });

  function checkValid(){
    submitAdd.disabled = !(fTitle.value.trim() && pendingImage);
  }
  fTitle.addEventListener('input', checkValid);

  fFile.addEventListener('change', ()=>{
    const file = fFile.files[0];
    if(!file) return;
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = (e)=>{
      pendingImage = e.target.result;
      dropTxt.innerHTML = `<div class="drop-preview"><img src="${pendingImage}"><span>${file.name}</span></div>`;
      checkValid();
    };
    reader.readAsDataURL(file);
  });
  ['dragenter','dragover'].forEach(evt=>{
    drop.addEventListener(evt, (e)=>{ e.preventDefault(); drop.classList.add('drag'); });
  });
  ['dragleave','drop'].forEach(evt=>{
    drop.addEventListener(evt, (e)=>{ e.preventDefault(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', (e)=>{
    const file = e.dataTransfer.files[0];
    if(file){ fFile.files = e.dataTransfer.files; fFile.dispatchEvent(new Event('change')); }
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!pendingImage || !pendingFile) return;
    const cfg = getConfig();
    if(!cfg){
      toast('Connectez GitHub (⚙) avant de publier.', 'err');
      return;
    }
    submitAdd.disabled = true;
    submitAdd.textContent = 'Publication…';
    fileErr.style.display = 'none';

    try{
      const title = fTitle.value.trim();
      const place = document.getElementById('fPlace').value.trim();
      const tag = document.getElementById('fTag').value;
      const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
      const filename = `${slugify(title)}-${Date.now()}.${ext}`;
      const imagePath = `images/${filename}`;
      const base64Data = pendingImage.split(',')[1];

      // 1. upload image
      await ghPutFile(imagePath, base64Data, `Ajout de l'image : ${title}`);

      // 2. update works.json
      const current = await ghGetFile('works.json');
      const list = current ? JSON.parse(b64DecodeUtf8(current.content)) : [];
      const newWork = { id: Date.now(), title, place, tag, image: imagePath };
      list.push(newWork);
      await ghPutFile('works.json', b64EncodeUtf8(JSON.stringify(list, null, 2)), `Publication : ${title}`, current ? current.sha : undefined);

      // 3. reflect locally right away (using the local preview until Pages rebuilds)
      works.push({ ...newWork, image: pendingImage });
      renderGrid();
      toast('Travail publié sur GitHub. La page se mettra à jour sur GitHub Pages sous 1 minute.', 'ok');
      closeModal();
    }catch(err){
      fileErr.textContent = err.message;
      fileErr.style.display = 'block';
    }finally{
      submitAdd.disabled = false;
      submitAdd.textContent = 'Publier';
    }
  });

  // ============================================================
  // 360 VIEWER
  // ============================================================
  const viewer = document.getElementById('viewer');
  const canvas = document.getElementById('canvas');
  const viewerLoading = document.getElementById('viewerLoading');
  const vTitle = document.getElementById('vTitle');
  const vTag = document.getElementById('vTag');
  const vDeg = document.getElementById('vDeg');
  const vHint = document.getElementById('vHint');

  let renderer, scene, camera, mesh, animId;
  let lon = 180, lat = 0, targetLon = 180, targetLat = 0;
  let isDragging = false, hasInteracted = false;
  let startX = 0, startY = 0, startLon = 0, startLat = 0;
  let fov = 75;

  function initThree(){
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(fov, window.innerWidth/window.innerHeight, 1, 1100);
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    onResize();
    window.addEventListener('resize', onResize);
  }

  function onResize(){
    if(!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }

  function loadPanorama(url){
    viewerLoading.style.display = 'flex';
    const loader = new THREE.TextureLoader();
    loader.load(url, (texture)=>{
      if(THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      viewerLoading.style.display = 'none';
    }, undefined, ()=>{
      viewerLoading.style.display = 'none';
      toast("Impossible de charger cette image.", 'err');
    });
  }

  function animate(){
    animId = requestAnimationFrame(animate);
    if(!isDragging && !hasInteracted){
      targetLon += 0.03;
    }
    lon += (targetLon - lon) * 0.1;
    lat += (targetLat - lat) * 0.1;
    lat = Math.max(-85, Math.min(85, lat));

    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.position.set(0,0,0);
    const lookX = 500 * Math.sin(phi) * Math.cos(theta);
    const lookY = 500 * Math.cos(phi);
    const lookZ = 500 * Math.sin(phi) * Math.sin(theta);
    camera.lookAt(lookX, lookY, lookZ);

    const heading = Math.round(((lon % 360) + 360) % 360);
    vDeg.textContent = String(heading).padStart(3,'0') + '°';

    renderer.render(scene, camera);
  }

  function pointerDown(e){
    isDragging = true;
    hasInteracted = true;
    vHint.style.opacity = '0';
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX; startY = p.clientY;
    startLon = targetLon; startLat = targetLat;
  }
  function pointerMove(e){
    if(!isDragging) return;
    const p = e.touches ? e.touches[0] : e;
    targetLon = startLon - (p.clientX - startX) * 0.18;
    targetLat = startLat + (p.clientY - startY) * 0.18;
  }
  function pointerUp(){ isDragging = false; }

  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('wheel', (e)=>{
    e.preventDefault();
    fov = Math.max(30, Math.min(100, fov + e.deltaY * 0.05));
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, { passive:false });

  function openViewer(id){
    const w = works.find(x => String(x.id) === String(id));
    if(!w) return;
    vTitle.textContent = w.title;
    vTag.textContent = w.tag + (w.place ? ' — ' + w.place : '');
    vHint.style.opacity = '1';
    hasInteracted = false;
    lon = targetLon = 180; lat = targetLat = 0;
    fov = 75;

    viewer.classList.add('open');
    document.body.style.overflow = 'hidden';

    if(!renderer) initThree();
    else { camera.fov = fov; camera.updateProjectionMatrix(); onResize(); }
    loadPanorama(w.image);
    if(!animId) animate();
  }

  function closeViewer(){
    viewer.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('closeViewer').addEventListener('click', closeViewer);
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && viewer.classList.contains('open')) closeViewer();
  });

})();
