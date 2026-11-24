import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFacade } from './facade.js?v=35';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const D = window.UKS_DATA, SEQ = window.UKS_SEQ, $ = s => document.querySelector(s);
const ST = D.stations, N = ST.length, RAD = Math.PI / 180;
/* salle octogonale : mur écran + comptoir à 0°, six murs de rayons, et l'entrée à 180° (sans rayon), en face de l'écran.
   ANG = les 7 pans qui portent une « station » (écran puis les 6 rayons), ALLANG = les 8 pans (mêmes cotes que blender/build_boutique8.py) */
const ANG = [0, 45, 90, 135, 225, 270, 315], ALLANG = [0, 45, 90, 135, 180, 225, 270, 315], OPEN_W = 2.2, OPEN_H = 2.8;
const root = $('#uks'), px = $('#px');
/* dimensions en mètres */
const R = 6.535813, HH = 4.43, WW = 2000 * (4.43 / 990);
const PANEL_W = 3.4, PANEL_H = 4.2, PANEL_Z = -R + .5, FRONT = PANEL_Z + .07;
const ROD_Y = 2.30,      /* hauteur de la tringle : 2.72 à l'origine, 2.15 au repère rouge, puis remontée « un peu » à 2.30 (24/11/2026) */
       ROD_Z = FRONT + .2, RAIL = .013, RAIL_HALF = 1.6, GH = 1.2, SC = GH / 1431, GAP_O = .15, GAP_Z = .3, TURN = .62;
const small = () => innerWidth < 760;
const LOW = small() || matchMedia('(pointer:coarse)').matches;      /* téléphone / tablette : rendu allégé */

/* ---------- rendu : uniquement quand quelque chose bouge ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
root.prepend(renderer.domElement); renderer.domElement.className = 'uks-gl';
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b1c);      /* ciel de nuit, visible seulement depuis la rue */
const camera = new THREE.PerspectiveCamera(40, 1, .1, 320);
{ const head = new THREE.DirectionalLight(0xffffff, 1.5); head.position.set(.5, 1.3, 1); camera.add(head); camera.add(head.target); head.target.position.set(0, 0, -4); scene.add(camera); }
let wakeUntil = 0, quality = 1;
const wake = (ms = 900) => { wakeUntil = Math.max(wakeUntil, performance.now() + ms); };
['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(e => addEventListener(e, () => wake(), { passive: true }));

/* ---------- chargement : l'essentiel d'abord, le reste quand on s'en approche ---------- */
const mgr = new THREE.LoadingManager(); let booted = false;
mgr.onProgress = (u, l, t) => { wake(); if (!booted) $('#load b').style.width = Math.round(l / t * 100) + '%'; };
mgr.onLoad = () => { wake(1500); if (booted) return; booted = true; $('#load').classList.add('done'); setTimeout(preloadNext, 1800); };
/* images décodées hors du fil d'affichage, puis envoyées à la carte graphique une par une, les grosses seulement quand la caméra est posée :
   c'est ce qui évite les à-coups pendant un zoom */
const bmpOpts = o => ({ imageOrientation: o, premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
const useBmp = typeof createImageBitmap === 'function';
const ldFlip = useBmp ? new THREE.ImageBitmapLoader(mgr).setOptions(bmpOpts('flipY')) : null, ldRaw = useBmp ? new THREE.ImageBitmapLoader(mgr).setOptions(bmpOpts('none')) : null;
const ldImg = new THREE.ImageLoader(mgr), cache = {}, uploads = [];
function tex(src, cb, fresh, raw){
  if (!fresh && cache[src]){ if (cb){ cache[src].userData.ready ? cb(cache[src]) : cache[src].userData.cbs.push(cb); } return cache[src]; }
  const t = new THREE.Texture(); t.userData.cbs = cb ? [cb] : []; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = LOW ? 2 : 8;
  const done = img => { t.image = img; if (useBmp) t.flipY = false; else if (raw) t.flipY = false;
    t.userData.big = img.width * img.height > 1.3e6; uploads.push(t); if (!booted) flushUploads(true); wake(); };
  (useBmp ? (raw ? ldRaw : ldFlip) : ldImg).load(src, done);
  if (!fresh) cache[src] = t; return t;
}
function flushUploads(all, moving){
  for (let n = 0; uploads.length && (all || n < 1); n++){
    const i = moving ? uploads.findIndex(t => !t.userData.big) : 0; if (i < 0) return;
    const t = uploads.splice(i, 1)[0]; t.needsUpdate = true; renderer.initTexture(t); t.userData.ready = true;
    t.userData.cbs.forEach(f => f(t)); t.userData.cbs = []; wake();
  }
}
function canvasTex(w, h, draw, rep){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = LOW ? 2 : 8;
  if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

/* ---------- boutique modélisée dans Blender : matière photographiée (répétée) × lumière calculée (lightmap) ---------- */
/* environnement de reflets : sans lui un métal reste un aplat noir */
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
const mMetal = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: .38, metalness: 1, envMapIntensity: 1.1 });
/* tringle : acier noir thermolaqué. La matière vient de trois cartes dessinées une fois : grain de la peinture,
   micro-rayures et traces d'usure laissées par les cintres, et un relief fin qui accroche la lumière */
const railMaps = (() => {
  const mk = draw => { const t = canvasTex(256, 1024, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; };
  const noise = (g, w, h, base, amp) => { const im = g.createImageData(w, h), d = im.data; for (let i = 0; i < d.length; i += 4){ const v = base + (Math.random() - .5) * amp; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(im, 0, 0); };
  const marks = (g, w, h, n, col) => { g.strokeStyle = col; for (let i = 0; i < n; i++){ g.lineWidth = .5 + Math.random(); const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 46; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 5, y + l); g.stroke(); } };
  const map = mk((g, w, h) => { noise(g, w, h, 30, 12); marks(g, w, h, 220, 'rgba(120,122,126,.16)'); marks(g, w, h, 40, 'rgba(190,192,196,.14)'); });
  const rough = mk((g, w, h) => { noise(g, w, h, 150, 60); marks(g, w, h, 260, 'rgba(60,60,60,.45)'); });      /* rayures = plus brillant */
  const bump = mk((g, w, h) => { noise(g, w, h, 128, 90); });
  rough.colorSpace = bump.colorSpace = THREE.NoColorSpace;
  return { map, rough, bump };
})();
const mRail = new THREE.MeshStandardMaterial({ map: railMaps.map, roughnessMap: railMaps.rough, bumpMap: railMaps.bump, bumpScale: .6, roughness: .62, metalness: .45, envMapIntensity: 1.9 });        /* tringle : acier brossé foncé */
const mSteel = new THREE.MeshStandardMaterial({ color: 0xb4b7bb, roughness: .3, metalness: 1, envMapIntensity: 1.2 });
const mWood = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: .7 });
const photoTex = (f, span) => { const t = tex('store-assets/' + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / span, 1 / span); return t; };
const TX = { beton: photoTex('tx_beton.webp', 2.6), sol: photoTex('tx_sol.webp', 3.2), enduit: photoTex('tx_enduit.webp', 2.4), metal: photoTex('tx_metal.webp', 1.5) };   /* Poly Haven, CC0 */
const gridTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3c41'; g.lineWidth = 3; const st = w / 6;
  for (let p = 0; p <= w; p += st){ g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); } }, [2.4, 2.4]);
const lin = v => Math.pow(v / 255, 2.2);
const ALB = {                      /* [texture, teinte] : la teinte ramène la matière à l'albédo utilisé dans Blender */
  wall: [TX.beton, .16 / lin(160)], pillar: [TX.beton, .32 / lin(160)], panel: [TX.enduit, .82 / lin(232)],
  grid: [TX.beton, .03 / lin(160)], floor: [TX.sol, .2 / lin(128)], slab: [TX.beton, .045 / lin(160)], blackmetal: [TX.metal, .05 / lin(110)]      /* plafond : béton sombre, sans grille */
};
const CAPS_STYLE = +(new URLSearchParams(location.search).get('caps') || 2);      /* casquettes : 1 = tablettes inclinées (version gardée de côté), 2 = box individuels */
const BAKED = (CAPS_STYLE === 1 ? 'store-assets/caps-v1/' : 'store-assets/');     /* chaque version a son modèle et sa lumière calculée */
const BAKE = '?b=9';              /* à augmenter à chaque recalcul de la lumière dans Blender (modèle + lightmaps) */
const EXPO = 1.25;                 /* exposition générale de la lumière calculée */
const lmTex = n => { const t = tex(BAKED + 'lm_' + n + (LOW ? '_1k' : '') + '.webp' + BAKE, null, false, true); t.channel = 2; return t; };
const LMAP = { shell: lmTex('shell'), motifs: lmTex('motifs'), caps: lmTex('caps') };
let mirror = null, floorMat = null;
/* ---------- entrée : la boutique vue de la rue, on y entre en faisant défiler ---------- */
const facade = buildFacade(THREE, scene, R, { renderer, mgr, GLTFLoader, SVGLoader, RoundedBoxGeometry, wake, openW: OPEN_W, openH: OPEN_H, lmax: 2, ver: 10 });
const veil = $('#veil'), hero = $('#hero'); let heroO = -1, heroZ = 20;
const SHOT = location.search.indexOf('shot') >= 0;      /* mode capture (?shot=1) : 3D de base, sans rendu projeté ni reflets dessinés, pour servir de référence à une nouvelle image */
if (SHOT) facade.hideForShot();
let intro = 1, introT = 1;                             /* 1 = dans la rue, 0 = dans la boutique */
const clamp01 = v => Math.max(0, Math.min(1, v));
const setIntro = v => { introT = clamp01(v); root.classList.toggle('out', introT > .02); wake(1600); };
const pOut = new THREE.Vector3(), pIn = new THREE.Vector3(), lOut = new THREE.Vector3(), lIn = new THREE.Vector3();
new GLTFLoader(mgr).load(BAKED + 'boutique.glb' + BAKE, gl => {
  gl.scene.traverse(o => {
    if (!o.isMesh) return;
    /* un groupe à un seul matériau s'exporte comme un maillage seul : son nom est alors celui du groupe */
    const grp = LMAP[o.name] ? o.name : o.parent && LMAP[o.parent.name] ? o.parent.name : 'shell', n = o.material.name;
    if (n === 'neon' || n === 'screen') o.visible = false;                         /* tubes refaits plus bas, avec leur verre et leurs culots */
    else if (n === 'led') o.material = new THREE.MeshBasicMaterial({ color: 0xf7f9ff });
    else if (n === 'lightpanel') o.material = new THREE.MeshBasicMaterial({ color: 0xf2f3f5, side: THREE.DoubleSide });
    else {
      o.material = new THREE.MeshBasicMaterial({ map: ALB[n][0], color: new THREE.Color().setScalar(ALB[n][1]), lightMap: LMAP[grp], lightMapIntensity: 2 * Math.PI * EXPO * (grp === 'caps' && CAPS_STYLE === 2 ? 1.6 : 1) });      /* box : LED plus fortes, sinon les niches noires se lisent mal */
      if (n === 'floor'){ floorMat = o.material; setMirror(!LOW); }
    }
  });
  scene.add(gl.scene);
  wake(1500);
});
/* sol poli : reflet discret sous le béton, coupé sur téléphone ou si l'affichage rame */
function setMirror(on){
  if (on && !mirror){ mirror = new Reflector((() => { const s = new THREE.Shape(); facade.foot.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); return new THREE.ShapeGeometry(s); })(), { textureWidth: 512, textureHeight: 512, color: 0x8a8a8a }); mirror.rotation.x = -Math.PI / 2; mirror.position.y = -.004; scene.add(mirror); }
  if (mirror) mirror.visible = on;
  if (floorMat){ floorMat.transparent = on; floorMat.opacity = on ? .76 : 1; floorMat.needsUpdate = true; }
}
scene.add(new THREE.AmbientLight(0xffffff, .35));
{ const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(.3, 1, .6); scene.add(key); }      /* reflet franc sur le dessus des tubes */
scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, .35));

/* ---------- pièces de vêtements ---------- */
const hits = [];                                   /* maillages cliquables */
const shadowMat = () => new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .26, depthWrite: false });
const garmentMat = () => new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .08, side: THREE.DoubleSide });
function hangerGeo(g){
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.4, .022, .016), mWood); bar.position.y = -.075; g.add(bar);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.022, .004, 6, 14, Math.PI * 1.35), mSteel); hook.position.y = -.02; hook.rotation.z = -.3; g.add(hook);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .04, 6), mSteel); stem.position.y = -.058; g.add(stem);
}
function setMap(it, t){ it.mesh.material.map = t; it.sh.material.map = t; it.mesh.material.needsUpdate = true; it.sh.material.needsUpdate = true; it.grp.visible = true; it.fr = -1; wake(); }
function makeItem(p, parent, decor){
  const it = { p, o: 0, e: 0, x: 0, fr: -1, st: -1, grp: new THREE.Group() };
  it.grp.position.set(0, ROD_Y + .018, ROD_Z + .02); it.grp.visible = false;      /* le crochet passe par-dessus le tube */ parent.add(it.grp);
  if (p.k){                                        /* photos sur cintre + planche de rotation vidéo */
    const q = SEQ[p.k], rows = Math.ceil(q.frames / q.cols), w = q.W * SC, h = q.H * SC;
    it.q = q; it.rows = rows;
    const geo = new THREE.PlaneGeometry(w, h);
    it.mesh = new THREE.Mesh(geo, garmentMat());
    it.mesh.position.set((q.W / 2 - q.hx) * SC, -(q.H / 2 - q.y0) * SC + .005, 0); it.grp.add(it.mesh);
    it.sh = new THREE.Mesh(geo, shadowMat()); it.sh.position.copy(it.mesh.position).add(new THREE.Vector3(.035, -.045, -.17)); it.grp.add(it.sh);
    const wl = q.widths[q.widths.length - 1]; it.wr = q.widths.map(v => v / wl); it.fw = w * .72; it.h = q.gh * SC;
    it.load = () => { if (it.tS) return; it.tS = tex('stills-web/rest-' + p.k + '.webp', t => setMap(it, t)); };          /* léger : vue de profil */
    if (q.views){                                    /* 3 vraies vues : mouvement calculé en continu (largeur interpolée + fondu), sans planche d'images */
      it.v3 = true; it.mB = new THREE.Mesh(geo, garmentMat()); it.mB.position.copy(it.mesh.position); it.mB.position.z += .002; it.mB.visible = false; it.grp.add(it.mB);
    }
    it.full = () => { if (it.tF) return; it.load();                                                                        /* à l'approche : face nette + rotation */
      if (it.v3){ it.tF = tex('stills-web/face-' + p.k + '.webp', () => { it.fr = -1; wake(); }); it.t3 = tex('stills-web/q34-' + p.k + '.webp', () => { it.fr = -1; wake(); }); return; }
      it.tF = tex('stills-web/face-' + p.k + '.webp', () => { it.fr = -1; wake(); });
      /* planche de rotation : une seule image en mémoire par pièce, même si plusieurs cintres la portent (chacun garde son propre cadrage) */
      const base = tex('stills-web/mot-' + p.k + '.webp', t => { const c = t.clone(); c.repeat.set(1 / q.cols, 1 / rows); c.userData = { ready: true }; c.needsUpdate = true; it.tQ = c; it.fr = -1; wake(); });
      base.generateMipmaps = false; base.minFilter = THREE.LinearFilter; };
  } else {                                         /* photo à plat détourée sur un vrai cintre : pivote en 3D */
    const f = p.flat, gh = GH * f.gk, w = f.w / f.h * gh;
    it.piv = new THREE.Group(); it.grp.add(it.piv); hangerGeo(it.piv);
    const geo = new THREE.PlaneGeometry(w, gh);
    it.mesh = new THREE.Mesh(geo, garmentMat()); it.mesh.position.set((.5 - f.cx) * w, -.07 - gh / 2, 0); it.piv.add(it.mesh);
    it.sh = new THREE.Mesh(geo, shadowMat()); it.sh.position.set(it.mesh.position.x + .035, it.mesh.position.y - .045, -.17); it.grp.add(it.sh);
    it.fw = w; it.h = gh + .07; it.rest = decor ? 0 : 1.36;
    it.piv.rotation.y = it.rest; it.sh.scale.x = Math.max(.1, Math.cos(it.rest));
    it.load = () => { if (it.tS) return; it.tS = tex(decor ? f.src.replace('flat-', 'decor-') : f.src, t => setMap(it, t)); if (p.m3d && !decor) load3D(it, p.m3d, gh); };
    it.full = it.load;
  }
  if (!decor){
    it.hit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
    it.hit.position.set(0, -it.h / 2, .05); it.hit.scale.set(GAP_O, it.h + .1, 1); it.grp.add(it.hit); it.hit.userData.it = it; hits.push(it.hit);
  }
  return it;
}
/* ---------- pièces en vraie 3D (essai) ----------
   Forme légère tirée de la silhouette des photos boutique (p3d/make3d.py), vraies photos en texture, tissu et patchs
   éclairés en direct : le relief accroche la lumière quand la pièce tourne. La photo à plat sert d'attente pendant le chargement. */
const P3V = '?p=2', P3D = 'store-assets/p3d/', raw3 = (f, rep) => { const t = tex(P3D + f); t.colorSpace = THREE.NoColorSpace; if (rep){ t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(rep, rep); } return t; };
let satin = null;
function load3D(it, name, gh){
  satin = satin || { n: raw3('satin_nrm.webp?s=2', 9) };          /* grain réel du satin (Poly Haven), recadré sans réduction pour garder le détail */
  fetch(P3D + name + '.json' + P3V).then(r => r.json()).then(info => new GLTFLoader(mgr).load(P3D + name + '.glb' + P3V, gl => {
    const G = gl.scene, k = gh / info.height; G.scale.setScalar(k); G.position.y = -.035;
    G.traverse(o => { if (!o.isMesh) return;
      o.material = new THREE.MeshStandardMaterial({ map: tex(P3D + name + '_' + o.name + '.webp' + P3V), alphaTest: .5, roughness: .78, metalness: 0,
        normalMap: satin.n, normalScale: new THREE.Vector2(1.6, 1.6), envMapIntensity: .22 }); });
    info.patches.forEach(pt => {                     /* patchs silicone : couleur + relief, posés sur le tissu */
      const o = pt.type === 'oval', m = new THREE.Mesh(new THREE.PlaneGeometry(pt.w, pt.w * (o ? 470 / 1024 : 1)), new THREE.MeshStandardMaterial({
        map: tex(P3D + (o ? 'patch_oval' : 'patch_u') + '_col.webp'), normalMap: raw3((o ? 'patch_oval' : 'patch_u') + '_nrm.webp'), normalScale: new THREE.Vector2(1.5, 1.5),
        alphaTest: .5, roughness: .3, metalness: 0, envMapIntensity: 1.1, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(pt.x, pt.y, pt.z + .004); G.add(m);
    });
    it.piv.add(G); it.m3 = G; it.mesh.visible = false; it.sh.visible = false; wake(1500);
  }));
}
function labelTex(text){
  return canvasTex(1024, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#111'; g.font = '600 54px Helvetica Neue,Helvetica,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.toUpperCase().split('').join('  '), w / 2, h / 2); });
}
/* halo doux des néons (remplace l'effet de lueur plein écran) */
const haloTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(235,240,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); const m = g.createLinearGradient(0, 0, 0, h); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.12, 'rgba(0,0,0,0)'); m.addColorStop(.88, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, w, h); });
const mHalo = new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55 });

const mGalva = new THREE.MeshStandardMaterial({ color: 0x8f9296, roughness: .62, metalness: .7, envMapIntensity: 1 });
const mHolder = new THREE.MeshStandardMaterial({ color: 0xe4e4e2, roughness: .5 });
const mTube = new THREE.MeshBasicMaterial({ map: canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h);
  [[0, '#6f6a62'], [.025, '#b9b4aa'], [.07, '#f1f2f4'], [.5, '#f8faff'], [.93, '#f1f2f4'], [.975, '#b9b4aa'], [1, '#6f6a62']].forEach(([p, c]) => gr.addColorStop(p, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) });

/* panneaux grillagés derrière les néons : vrai treillis soudé en fils d'acier, posé devant un fond de béton sombre.
   Chaque fil est découpé en tronçons dont la teinte dépend de la distance au tube : c'est le néon qui les éclaire */
function wireMesh(ks){
  const pitch = LOW ? .08 : .05, th = .0038, zw = -R + .176, list = [], col = new THREE.Color();
  const glow = (dx, y) => { let best = 9; for (const c of [1.25, 2.95]){ const dy = Math.max(0, Math.abs(y - c) - .6); best = Math.min(best, Math.hypot(dx, dy)); } return .1 + .95 / (1 + Math.pow(best / .13, 2)); };
  ANG.forEach((a, k) => ks.includes(k) && [-1, 1].forEach(sd => {
    const cx = sd * 1.895, tx = sd * 1.98;
    for (let x = -.345; x <= .3451; x += pitch) for (let y = 0; y < HH; y += .22) list.push([k, cx + x, y + .11, th, .22, glow(cx + x - tx, y + .11)]);      /* fils verticaux */
    for (let y = pitch / 2; y < HH; y += pitch) for (let x = -.345; x < .344; x += .115) list.push([k, cx + x + .0575, y, .115, th, glow(cx + x + .0575 - tx, y)]);   /* fils horizontaux */
  }));
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  list.forEach(([k, x, y, w, h, v], i) => {
    const a = -ANG[k] * RAD; p.set(x, y, zw).applyAxisAngle(Y, a); q.setFromAxisAngle(Y, a); sc.set(w, h, th); m.compose(p, q, sc); mesh.setMatrixAt(i, m);
    const j = v * (.9 + Math.random() * .2); mesh.setColorAt(i, col.setRGB(j * .62, j * .64, j * .68, THREE.SRGBColorSpace));
  });
  scene.add(mesh); return mesh;
}
wireMesh(ANG.map((a, k) => k));

/* ---------- les stations : même décor central pour chaque catégorie ---------- */
const logoTex = tex('store-assets/logo.png');
const CAPW = { z0: .45, rows: 6, pitch: .4, bays: [-1, 0, 1], per: 4, tilt: 28 * RAD };
const CAPB = { z0: .95, z1: 2.85, cols: 4, nb: 3, cw: .58, dv: .03, ch: .5, lo: .08, hi: .33, tall: { 2: [.6, .6, .5] }, tallAt: 3 };                                  /* version box */      /* mêmes cotes que le meuble dans build_boutique.py */
const stations = ST.map((s, k) => {
  const g = new THREE.Group(); g.rotation.y = -ANG[k] * RAD; scene.add(g);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  /* néons : réglette galvanisée, douilles, culots alu, tube de verre plus sombre vers ses extrémités, halo */
  [-1, 1].forEach(sd => [1.25, 2.95].forEach(y => {
    const x = sd * 1.98;
    add(new THREE.BoxGeometry(.046, 1.34, .022), mGalva, x, y, -R + .193);
    add(new THREE.CylinderGeometry(.0145, .0145, 1.2, 18, 1, true), mTube, x, y, -R + .226);
    [-1, 1].forEach(e => {
      add(new THREE.CylinderGeometry(.0162, .0162, .026, 18), mSteel, x, y + e * .612, -R + .226);
      add(new THREE.BoxGeometry(.032, .034, .04), mHolder, x, y + e * .642, -R + .214);
    });
    add(new THREE.PlaneGeometry(.4, 1.6), mHalo, x, y, -R + .182);
  }));
  /* logo + nom du rayon sur le panneau */
  if (s.type !== 'screen') add(new THREE.PlaneGeometry(.95, .95 * 279 / 939), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }), 0, 3.38, FRONT + .005);
  if (s.type !== 'screen') add(new THREE.PlaneGeometry(1.9, 1.9 / 8), new THREE.MeshBasicMaterial({ map: labelTex(s.label), transparent: true, opacity: .75 }), 0, 3.13, FRONT + .005);
  const stn = { k, s, g, hover: -1, m: 0, items: [], loaded: false, fullLoaded: false };
  if (s.type === 'rack'){
    /* tringle : vrai tube d'acier, embouts, et deux supports à platine fixés au panneau */
    add(new THREE.CylinderGeometry(RAIL, RAIL, 3.24, 24), mRail, 0, ROD_Y, ROD_Z).rotation.z = Math.PI / 2;
    [-1.62, 1.62].forEach(x => add(new THREE.SphereGeometry(RAIL * 1.02, 16, 12), mRail, x, ROD_Y, ROD_Z));
    [-1.45, 1.45].forEach(x => {
      add(new THREE.CylinderGeometry(.009, .009, ROD_Z - FRONT, 12), mRail, x, ROD_Y, (ROD_Z + FRONT) / 2).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(.036, .036, .007, 24), mRail, x, ROD_Y, FRONT + .0035).rotation.x = Math.PI / 2;
      [[-.022, 0], [.022, 0]].forEach(([dx, dy]) => add(new THREE.CylinderGeometry(.0045, .0045, .004, 10), mSteel, x + dx, ROD_Y + dy, FRONT + .009).rotation.x = Math.PI / 2);     /* vis de la platine */
      add(new THREE.CylinderGeometry(.018, .018, .026, 16), mRail, x, ROD_Y, ROD_Z).rotation.z = Math.PI / 2;
    });
    /* remplissage : un portant peu fourni répète ses pièces à l'affichage (plusieurs cintres de la même pièce côte à côte,
       comme en boutique). Aucun produit n'est dupliqué : chaque cintre renvoie au même produit (it.pi). */
    const shown = [], want = Math.max(s.items.length, s.fill || 0);
    s.items.forEach((p, pi) => { const nb = Math.floor(want / s.items.length) + (pi < want % s.items.length ? 1 : 0); for (let c = 0; c < nb; c++) shown.push(pi); });
    stn.items = shown.map((pi, i) => { const it = makeItem(s.items[pi], g); it.i = i; it.pi = pi; it.stn = stn; return it; });
  } else if (s.type === 'shelf'){
    /* accessoires : mur de casquettes. Le meuble (métal noir, tablettes inclinées, rubans de LED) vient du modèle Blender ;
       ici on pose les casquettes en rangées serrées, plusieurs exemplaires de chaque, comme en boutique.
       Chaque case (une tablette d'une travée) porte 4 fois le même produit ; rien n'est dupliqué dans Shopify. */
    const capItem = (pi, m) => { const p = s.items[pi], f = p.flat, it = { p, i: stn.items.length, pi, stn, mesh: m, e: 0, y0: m.position.y, z0: m.position.z, shelf: true };
      m.visible = false; m.userData.it = it; hits.push(m);
      it.load = () => { if (it.t) return; it.t = tex(f.src + '?c=2', t => { m.material.map = t; m.material.needsUpdate = true; m.visible = true; wake(); }); };
      it.full = it.load; stn.items.push(it); };
    if (CAPS_STYLE === 1){
      const W = CAPW, tilt = W.tilt;
      for (let r = 0; r < W.rows; r++) W.bays.forEach((b, bi) => {
        const ci = r * W.bays.length + bi, pi = (ci + Math.floor(r / 2)) % s.items.length, p = s.items[pi], f = p.flat;
        let w = .255, h = w * f.h / f.w; if (h > .32){ h = .32; w = h * f.w / f.h; }          /* pièce haute (cagoule) : limitée par l'écart entre tablettes */
        const by = W.z0 + .09 + r * W.pitch - .02, bz = FRONT + .2;                             /* le bas de la casquette repose derrière le rebord de la tablette */
        for (let c = 0; c < W.per; c++){
          const x = b + (c - (W.per - 1) / 2) * .232, m = add(new THREE.PlaneGeometry(w, h), garmentMat(), x, by + Math.cos(tilt) * h / 2, bz - Math.sin(tilt) * h / 2 + c * .004);
            m.rotation.x = -tilt; m.renderOrder = c; capItem(pi, m);
        }
      });
    } else {
      /* version « box » : une casquette par niche, colonnes décalées une sur deux, deux niches voisines portent la même pièce */
      const B = CAPB, step = B.cw + B.dv, tilt = 12 * RAD;
      /* ordre d'affichage : la pièce haute (cagoule) est placée sur les deux niches agrandies du meuble (B.tall) */
      const order = s.items.map((p, k) => k), tallK = s.items.findIndex(p => p.flat.h / p.flat.w > 1.4);
      if (tallK >= 0){ order.splice(order.indexOf(tallK), 1); order.splice(Math.min(B.tallAt, order.length), 0, tallK); }
      for (let i = 0; i < B.cols; i++){
        const x = (i - (B.cols - 1) / 2) * step, odd = i % 2, hs = B.tall[i] || Array(B.nb).fill(B.ch);
        let zb = B.z0 + (odd ? B.hi : B.lo);
        hs.forEach((ch, j) => {
          const pi = order[Math.floor((i * B.nb + j) / 2) % order.length], f = s.items[pi].flat;     /* deux niches voisines portent la même pièce */
          let h = ch - .1, w = h * f.w / f.h; if (w > B.cw - .12){ w = B.cw - .12; h = w * f.h / f.w; }
          const by = zb + .012, m = add(new THREE.PlaneGeometry(w, h), garmentMat(), x, by + Math.cos(tilt) * h / 2, FRONT + .16 - Math.sin(tilt) * h / 2);
          m.rotation.x = -tilt; capItem(pi, m); zb += ch;
        });
      }
    }
  }
  if (s.type === 'screen'){
    /* grand écran 16:9 au-dessus du comptoir : diaporama des visuels (promos…), fondu enchaîné toutes les 5 s */
    const SL = (D.slides || []).map(x => x.img), mk = o => new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff }, o));
    const A = add(new THREE.PlaneGeometry(3.0, 1.6875), mk({}), 0, 2.9, -R + .615), B = add(new THREE.PlaneGeometry(3.0, 1.6875), mk({ transparent: true, opacity: 0 }), 0, 2.9, -R + .617);      /* télé accrochée au panneau blanc (mêmes cotes que build_boutique8.py) */
    B.visible = false; const tx = SL.map(() => null), get = i => tx[i] || (tx[i] = tex(SL[i], () => wake()));
    const sl = stn.slider = { i: 0, t0: 0, n: SL.length,
      go(d){ if (sl.n < 2 || sl.t0) return; const nx = (sl.i + d + sl.n) % sl.n, tn = get(nx); if (!tn.userData.ready) return;      /* visuel suivant pas encore chargé : on attend, pas d'écran noir */
        sl.i = nx; B.material.map = tn; B.material.needsUpdate = true; B.material.opacity = 0; B.visible = true; sl.t0 = performance.now(); wake(1400); },
      tick(now){ if (!sl.t0) return; const t = Math.min(1, (now - sl.t0) / 900); B.material.opacity = t * t * (3 - 2 * t); wake(200);
        if (t >= 1){ A.material.map = B.material.map; A.material.needsUpdate = true; B.visible = false; sl.t0 = 0; get((sl.i + 1) % sl.n); } } };
    if (sl.n){ A.material.map = get(0); if (sl.n > 1) get(1); setInterval(() => { if (!document.hidden) sl.go(1); }, 5000); }
  }
  stn.load = () => { if (stn.loaded) return; stn.loaded = true; stn.items.forEach(it => it.load()); };
  stn.full = () => { if (stn.fullLoaded) return; stn.fullLoaded = true; stn.load(); stn.items.forEach(it => it.full()); };
  return stn;
});
stations[0].load(); stations[1].load();
/* ---------- lumière du décor sur les vêtements (essai : portant des shorts) ----------
   Blender calcule la lumière reçue sur le plan où pendent les vêtements (mode « probe » de build_boutique.py → lm_rack.webp).
   Chaque photo de vêtement est multipliée par cette lumière, à l'endroit exact où elle se trouve : plus claire sous le plafond lumineux,
   plus sombre vers le bas, et ça suit la pièce quand elle glisse sur la tringle. Même traitement pour toutes les pièces. */
const LIT = new Set([4]), LM_W = 3.4, LM_H = 4.2;
tex('store-assets/lm_rack.webp', t => {
  stations.forEach(st => { if (!LIT.has(st.k) || st.s.type !== 'rack') return;
    st.items.forEach(it => { const c = t.clone(); c.userData = {}; c.needsUpdate = true; it.lm = c;
      it.mesh.material.lightMap = c; it.mesh.material.lightMapIntensity = 2 * Math.PI; it.mesh.material.needsUpdate = true; }); });
  wake(1500);
});
function preloadNext(){                               /* une fois l'écran affiché : le reste en tâche de fond, rayon par rayon */
  const s = stations.find(x => !x.loaded) || stations.find(x => !x.fullLoaded); if (!s) return;
  s.loaded ? s.full() : s.load(); setTimeout(preloadNext, LOW ? 2500 : 1200);
}
/* aluminium brossé de la résille : stries fines dans le sens de la lame, taches d'oxydation, brillance inégale */
const aluMaps = (() => {
  const mk = draw => { const t = canvasTex(512, 64, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const streaks = (g, w, h, base, amp, n) => { g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++){ const v = base + (Math.random() - .5) * amp | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 220, 1); }
    for (let i = 0; i < 26; i++){ const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r); const d = base - amp * .5 | 0; gr.addColorStop(0, `rgba(${d},${d},${d},.35)`); gr.addColorStop(1, `rgba(${d},${d},${d},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } };
  const map = mk((g, w, h) => streaks(g, w, h, 196, 60, 900)), rough = mk((g, w, h) => streaks(g, w, h, 150, 110, 900));
  rough.colorSpace = THREE.NoColorSpace; return { map, rough };
})();
/* plafond : résille métallique à maille fine, posée par travées. Chaque travée est alignée sur son mur et s'arrête
   sur un profilé porteur : la grille suit donc les cinq pans de la salle au lieu de les couper en biais */
(function(){
  const pitch = LOW ? .14 : .085, hgt = .035, th = .0045, W1 = 1210 * (4.43 / 990);
  const list = [];                                             /* [mur, x, z, longueur, sens, épaisseur, hauteur] dans le repère du mur */
  const bar = (k, x, z, len, alongX, t = th, h = hgt) => { if (len > .02) list.push([k, x, z, len, alongX, t, h]); };
  ALLANG.forEach((a, k) => {
    const hw = W1 / 2;
    for (let z = -R + pitch / 2; z < 0; z += pitch){ const e = hw * (-z / R); bar(k, 0, z, 2 * e, true); }             /* lames parallèles au mur */
    for (let x = -hw + pitch / 2; x < hw; x += pitch){ const z1 = -R * Math.abs(x) / hw; bar(k, x, (-R + z1) / 2, z1 + R, false); }   /* lames vers le centre */
    for (let z = -R + .6; z < -.3; z += .6){ const e = hw * (-z / R); bar(k, 0, z, 2 * e, true, .022, .05); }           /* porteurs tous les 60 cm */
    bar(k, 0, -R + .012, 2 * hw, true, .03, .06);                                                                       /* cornière de rive le long du mur */
    const L = Math.hypot(hw, R); list.push([k, -hw / 2, -R / 2, L, 'seam', .035, .07, Math.atan2(hw, R)]);              /* profilé sur la jonction avec la travée voisine */
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: aluMaps.map, roughnessMap: aluMaps.rough, roughness: .7, metalness: .75, envMapIntensity: 1.25 }), list.length);
  const tint = new THREE.Color();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  list.forEach((b, i) => {
    const [k, x, z, len, dir, t, h, tilt] = b, a = -ALLANG[k] * RAD;
    p.set(x, HH, z).applyAxisAngle(Y, a);
    if (dir === 'seam'){ q.setFromAxisAngle(Y, a + tilt); sc.set(t, h, len); }
    else { q.setFromAxisAngle(Y, a); dir ? sc.set(len, h, t) : sc.set(t, h, len); }
    m.compose(p, q, sc); mesh.setMatrixAt(i, m);
    const v = (t > .01 ? .5 : .78) * (.86 + Math.random() * .28); mesh.setColorAt(i, tint.setRGB(v, v, v * 1.03));      /* porteurs plus sombres, lames inégales */
  });
  scene.add(mesh);
  /* vide technique éclairé au-dessus de la résille : c'est ce contre-jour qui la fait lire comme du métal ajouré */
  const glow = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(232,236,244,1)'); gr.addColorStop(.45, 'rgba(170,175,184,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const mGlow = new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, opacity: .7 });
  stations.forEach(st => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.2), mGlow); pl.rotation.x = Math.PI / 2; pl.position.set(0, HH + .3, -R + 1.9); st.g.add(pl); });
})();


/* ---------- caméra ---------- */
let vw = 1, vh = 1, view = 'store', zoomK = 0;       /* 'store' | 0..N-1 | 'zoom' */
const cam = { th: 0, d: 9, y: 2, pan: 0 }, tg = { th: 0, d: 9, y: 2, pan: 0 }, mouse = { x: 0, y: 0, sx: 0, sy: 0, on: false };
const zoomed = s => view === 'zoom' && zoomK === s.k;
const dAng = (th, k) => Math.abs((((th - ANG[k]) % 360) + 540) % 360 - 180);
const facing = k => dAng(tg.th, k) < 30;
const live = s => zoomed(s) || view === s.k || (view === 'store' && facing(s.k));
const k0 = () => wallOf(tg.th) === 0;
const near = a => a + 360 * Math.round((tg.th - a) / 360);
const wallOf = th => { let b = 0; for (let k = 1; k < N; k++) if (dAng(th, k) < dAng(th, b)) b = k; return b; };
let capY = 1.9;                                      /* hauteur visée en zoom sur le mur de casquettes (suit la souris) */
let zl = 0;                                          /* niveau de zoom continu : 0 = salle, 1 = devant le mur, 2 = devant le portant */
const mix = (a, b, t) => a + (b - a) * t;
function aim(){
  const tv = Math.tan(camera.fov * RAD / 2), th = tv * camera.aspect, k = view === 'store' ? wallOf(tg.th) : view === 'zoom' ? zoomK : view;
  /* recul limité : au-delà, la caméra se retrouve collée aux portants des murs situés derrière elle */
  const dS = Math.min(R + 1.7, Math.max(R + 1, 2.9 / th));
  const dW = Math.min(dS - 1.2, Math.max(3.2, Math.max(2.35 / th, 1.75 / tv)));
  const shelf = stations[k].s.type !== 'rack', scr = stations[k].s.type === 'screen';
  const dZ = scr ? Math.max(4.2, 2.2 / th, 1.4 / tv) : shelf ? .7 + (vw < vh * .8 ? 1.0 : .8) / tv : (R + ROD_Z) + (vw < vh * .8 ? 1.55 : 1.24) / tv;
  tg.d = zl <= 1 ? mix(dS, dW, zl) : mix(dW, dZ, zl - 1);
  tg.y = zl <= 1 ? mix(2.0, 2.05, zl) : mix(2.05, scr ? 2.85 : shelf ? capY : ROD_Y - .64, zl - 1);
  if (view !== 'store') tg.th = near(ANG[k]);
  if (view !== 'zoom') tg.pan = 0;
}
function setView(v, keep){
  wake(2500);
  view = v; if (!keep) zl = v === 'store' ? 0 : v === 'zoom' ? 2 : 1;
  aim();
  const cur = v === 'zoom' ? String(zoomK) : String(v);
  document.querySelectorAll('#nav [data-view]').forEach(b => b.setAttribute('aria-current', b.dataset.view === cur));
  $('#hint').style.opacity = v === 'store' ? 1 : 0;
  document.querySelector('.uks-top').style.opacity = v === 'zoom' ? 0 : 1;
  stations.forEach(s => { if (!(zoomed(s) || v === s.k)) s.hover = -1; });
  $('#info').classList.remove('on'); $('#infoBtn').setAttribute('aria-expanded', 'false');
}
function resize(){
  vw = root.clientWidth; vh = root.clientHeight;
  if (!vw || !vh) return;                             /* page ouverte dans un onglet masqué : pas de taille, on attend */
  camera.aspect = vw / vh; camera.fov = vw < vh * .8 ? 58 : 40; camera.updateProjectionMatrix();
  /* plafond de pixels : les écrans très denses n'affichent pas plus net, seulement plus lentement */
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2, Math.sqrt((LOW ? 1.5e6 : 5.6e6) / (vw * vh))) * quality);
  renderer.setSize(vw, vh); aim(); wake();
}
function panRange(){
  const s = stations[zoomK]; if (!s || !s.items.length) return 0;
  if (s.s.type !== 'rack') return Math.max(0, 1.55 - (tg.d - .7) * Math.tan(camera.fov * RAD / 2) * camera.aspect * .8);
  const half = (tg.d - R - ROD_Z) * Math.tan(camera.fov * RAD / 2) * camera.aspect, ext = Math.min(RAIL_HALF + .15, (s.items.length - 1) / 2 * GAP_Z + .55);
  return Math.max(0, ext - half * .75);
}
const clampPan = x => { const r = panRange(); return Math.max(-r, Math.min(r, x)); };

/* ---------- animation des portants ---------- */
function layout(s, dt){
  if (s.s.type !== 'rack'){
    s.items.forEach(it => { it.e += ((s.hover === it.i && live(s) ? 1 : 0) - it.e) * (1 - Math.exp(-dt * 10)); it.mesh.scale.setScalar(1 + it.e * .1); it.mesh.position.y = it.y0 + it.e * .03; it.mesh.position.z = it.z0 + it.e * .05; });
    return;
  }
  const n = s.items.length, on = live(s);
  s.m += ((zoomed(s) ? 1 : 0) - s.m) * (1 - Math.exp(-dt * 3.4));
  const gap = GAP_O + (GAP_Z - GAP_O) * s.m;
  s.items.forEach(it => {
    const want = s.hover === it.i && on ? 1 : 0;
    it.o = want > it.o ? Math.min(1, it.o + dt / TURN) : Math.max(0, it.o - dt / TURN);
    if (want && window.UKS && window.UKS.fz != null) it.o = window.UKS.fz;      /* test : fige la rotation à un point donné */
    it.e = it.o * it.o * (3 - 2 * it.o);
  });
  s.items.forEach((it, i) => {
    let x = (i - (n - 1) / 2) * gap;
    s.items.forEach((o, j) => { if (j !== i) x += (i > j ? 1 : -1) * o.e * (o.fw * .5 - gap * .35); });
    it.x = x; it.grp.position.z = ROD_Z + .02 + it.e * .03;
    let wNow;
    if (it.v3){
      const V = it.q.views, T = [it.tS, it.t3, it.tF], ok = t => t && t.userData.ready;
      const full = ok(it.t3) && ok(it.tF), u = Math.min(1.9999, it.e * 2), i = full ? Math.floor(u) : 0, t = full ? u - i : 0, sm = t * t * (3 - 2 * t);
      const wv = full ? V[i] + (V[i + 1] - V[i]) * sm : V[0], A = it.mesh, B = it.mB;
      if (T[i] && A.material.map !== T[i]){ A.material.map = T[i]; A.material.needsUpdate = true; it.sh.material.map = T[i]; it.sh.material.needsUpdate = true; }
      A.scale.x = wv / V[i]; it.sh.scale.x = A.scale.x;
      if (full && sm > .002){ if (B.material.map !== T[i + 1]){ B.material.map = T[i + 1]; B.material.needsUpdate = true; } B.visible = true; B.scale.x = wv / V[i + 1]; B.material.opacity = Math.min(1, sm * 1.6); }
      else B.visible = false;
      A.material.opacity = full && sm > .625 ? Math.max(0, 1 - (sm - .625) / .3) : 1; A.visible = A.material.opacity > .01;      /* la vue du dessous s'efface une fois recouverte : pas de silhouette fantôme */
      wNow = it.fw * wv / V[2]; if (it.o > 0 && it.o < 1) wake();
    } else if (it.q){
      const fr = Math.round(it.e * (it.q.frames - 1)), st = it.e <= .001 ? 0 : it.e >= .999 ? 2 : 1;
      if (fr !== it.fr || st !== it.st){
        it.fr = fr; it.st = st;
        const okQ = it.tQ && it.tQ.userData.ready, okF = it.tF && it.tF.userData.ready;       /* tant que la rotation n'est pas chargée : bascule simple profil → face */
        const t = st === 0 ? it.tS : st === 2 ? (okF ? it.tF : okQ ? it.tQ : it.tS) : okQ ? it.tQ : (it.e > .5 && okF ? it.tF : it.tS);
        if (t && t === it.tQ) it.tQ.offset.set((fr % it.q.cols) / it.q.cols, 1 - (Math.floor(fr / it.q.cols) + 1) / it.rows);
        if (t && it.mesh.material.map !== t){ it.mesh.material.map = t; it.sh.material.map = t; }
      }
      wNow = it.fw * it.wr[fr];
    } else {
      const a = it.rest * (1 - it.e); it.piv.rotation.y = a;
      const c = Math.max(.1, Math.cos(a)); it.sh.scale.x = c; wNow = it.fw * c;
    }
    it.w = wNow; it.hit.scale.x = Math.max(gap, wNow);
  });
  s.items.forEach(it => { if (!it.lm) return;                      /* recale la lumière du décor sur la position actuelle de la pièce */
    const g = it.mesh.geometry.parameters, pw = it.q ? g.width : Math.max(.02, it.w), cx = it.grp.position.x + (it.q ? it.mesh.position.x : 0), cy = it.grp.position.y + it.mesh.position.y;
    it.lm.repeat.set(pw / LM_W, g.height / LM_H); it.lm.offset.set((cx - pw / 2) / LM_W + .5, (cy - g.height / 2) / LM_H); });
  /* les cintres restent sur la tringle : si la rangée déborde (portant plein, pièce ouverte près d'un bord),
     on la resserre puis on la recale, à chaque image de l'animation. Marge mini .24 m = on ne passe pas les supports. */
  let x0 = Infinity, x1 = -Infinity, hMax = .24;
  s.items.forEach(it => { it.h2 = Math.max(it.w / 2, .24); hMax = Math.max(hMax, it.h2); x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); });
  const mid = (x0 + x1) / 2, k = x1 > x0 ? Math.min(1, (2 * RAIL_HALF - 2 * hMax) / (x1 - x0)) : 1;
  let lo = Infinity, hi = -Infinity;
  s.items.forEach(it => { it.x = mid + (it.x - mid) * k; lo = Math.min(lo, it.x - it.h2); hi = Math.max(hi, it.x + it.h2); });
  const shift = lo < -RAIL_HALF ? -RAIL_HALF - lo : hi > RAIL_HALF ? RAIL_HALF - hi : 0;
  s.items.forEach(it => { it.x += shift; it.grp.position.x = it.x; });
}

/* ---------- boucle ---------- */
const clock = new THREE.Clock(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), V = new THREE.Vector3();
let spin = 0, shown = null, slow = 0, frames = 0, lower = false;
function pick(){ ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(hits, false)[0]; return h ? h.object.userData.it : null; }
function frame(){
  const dtRaw = clock.getDelta(), dt = Math.min(.05, dtRaw), k = 1 - Math.exp(-dt * 4.2), now = performance.now();
  if (!drag.on && Math.abs(spin) > .01 && view === 'store'){ tg.th += spin * dt; spin *= Math.exp(-dt * 3); }
  if (root.clientWidth !== vw || root.clientHeight !== vh) resize();
  if (!Number.isFinite(tg.d + tg.y) || !Number.isFinite(cam.d + cam.y)){ resize(); if (Number.isFinite(tg.d + tg.y)){ cam.d = tg.d; cam.y = tg.y; } else { requestAnimationFrame(frame); return; } }      /* cotes invalides (onglet sans taille au chargement) : on recalcule */
  cam.th += (tg.th - cam.th) * (drag.on ? 1 - Math.exp(-dt * 14) : k);
  cam.d += (tg.d - cam.d) * k; cam.y += (tg.y - cam.y) * k; cam.pan += (tg.pan - cam.pan) * (1 - Math.exp(-dt * 5));
  mouse.sx += (mouse.x - mouse.sx) * .06; mouse.sy += (mouse.y - mouse.sy) * .06;
  const par = view === 'zoom' ? .15 : 1, a = (cam.th + mouse.sx * 2.5 * par) * RAD, s = Math.sin(cam.th * RAD), c = Math.cos(cam.th * RAD), r = R - cam.d;
  camera.position.set(s * r + c * cam.pan, cam.y, -c * r + s * cam.pan);
  camera.lookAt(camera.position.x + Math.sin(a) * 10, cam.y - mouse.sy * .25 * par, camera.position.z - Math.cos(a) * 10);
  if (Math.abs(introT - intro) > .0004){ intro += (introT - intro) * (1 - Math.exp(-dt * 3.4)); wake(); } else intro = introT;
  if (intro > .0005){                                /* trajet rue → boutique : même caméra, simplement reculée à travers la porte vitrée */
    const tv = Math.tan(camera.fov * RAD / 2), e = intro * intro * (3 - 2 * intro), zO = facade.viewZ(tv, camera.aspect);
    pIn.copy(camera.position); lIn.set(Math.sin(a) * 10, -mouse.sy * .25 * par, -Math.cos(a) * 10);
    const mf = 1;                /* tant que l'image d'ouverture est affichée, la caméra ne suit pas la souris : elle reste calée sur l'image */
    pOut.set(mouse.sx * .8 * mf, 1.72, zO); lOut.set(-pOut.x * .6, 2.85 - 1.72 - mouse.sy * .6 * mf, -(zO - facade.ZF));
    heroZ = zO;
    camera.position.lerpVectors(pIn, pOut, e); lIn.lerp(lOut, e); camera.lookAt(camera.position.x + lIn.x, camera.position.y + lIn.y, camera.position.z + lIn.z);
  }
  facade.setProj(camera.aspect >= 1.05 && camera.fov < 50 && !SHOT);      /* rendu réaliste projeté sur le décor (écrans paysage). L'image fixe en ouverture et son fondu ont été retirés. */
  facade.update(intro, camera.position.z); if (stations[0].slider) stations[0].slider.tick(now); root.classList.toggle('far', intro > .55);
  if (window.UKS && window.UKS.dbg){ const g = window.UKS.dbg; camera.position.set(...g.p); camera.lookAt(...g.l); wake(); }      /* point de vue de contrôle */
  /* survol */
  if (mouse.on && intro < .02 && !drag.on && !px.classList.contains('on') && !(window.UKS && window.UKS.lock)){      /* lock : survol piloté par un test */
    const it = pick();
    stations.forEach(st => { if (it && it.stn === st) st.hover = it.i; else if (!zoomed(st) || st.s.type !== 'rack') st.hover = -1; });
    root.style.cursor = it ? 'pointer' : '';
  }
  stations.forEach(st => { if (!st.loaded && dAng(cam.th, st.k) < 78) st.load(); if (!st.fullLoaded && live(st)) st.full(); layout(st, dt); });
  /* nom du vêtement ouvert, sous le cintre */
  let lab = null;
  stations.forEach(st => { if (st.s.type === 'rack' && live(st) && st.hover >= 0 && st.items[st.hover].e > .55) lab = st.items[st.hover]; });
  const el = $('#lbl');
  if (lab){
    if (shown !== lab){ shown = lab; el.textContent = lab.p.name + (lab.p.av ? '' : ' — épuisé'); }
    lab.grp.getWorldPosition(V); V.y -= lab.h + .07; V.project(camera);
    el.style.transform = 'translate(-50%,0) translate(' + ((V.x + 1) / 2 * vw).toFixed(1) + 'px,' + ((1 - V.y) / 2 * vh).toFixed(1) + 'px)';
    el.style.opacity = Math.min(1, (lab.e - .55) * 3);
  } else el.style.opacity = 0;
  /* on ne redessine que si la caméra, un vêtement ou la souris bouge encore */
  const moving = drag.on || Math.abs(tg.th - cam.th) > .05 || Math.abs(tg.d - cam.d) > .01 || Math.abs(tg.pan - cam.pan) > .01;
  if (uploads.length){ flushUploads(false, moving); wake(300); }
  let busy = now < wakeUntil || drag.on || intro !== introT || Math.abs(spin) > .01 || Math.abs(tg.th - cam.th) > .01 || Math.abs(tg.d - cam.d) > .002 || Math.abs(tg.y - cam.y) > .002 || Math.abs(tg.pan - cam.pan) > .002
    || Math.abs(mouse.x - mouse.sx) > .002 || Math.abs(mouse.y - mouse.sy) > .002;
  if (!busy) stations.forEach(st => { if (Math.abs((zoomed(st) ? 1 : 0) - st.m) > .002) busy = true; st.items.forEach(it => { if (it.shelf ? it.e > .003 && it.e < .997 : it.o > 0 && it.o < 1) busy = true; }); });
  if (busy){
    const t0 = performance.now(); renderer.render(scene, camera);
    /* si l'affichage rame : on coupe d'abord le reflet du sol, puis on baisse la définition */
    slow = slow * .95 + (dtRaw > .034 ? 1 : 0) * .05; frames++;
    if (frames > 90 && slow > .5) lower = true;
    if (lower && !moving){ lower = false; frames = 0; slow = 0; if (mirror && mirror.visible) setMirror(false); else if (quality > (LOW ? .6 : .85)){ quality *= .8; resize(); } }
  }
  requestAnimationFrame(frame);
}

/* ---------- interactions ---------- */
const drag = { on: false, moved: false, x0: 0, th0: 0, pan0: 0, lx: 0, lt: 0 };
const uiTarget = e => e.target.closest('.uks-nav,.uks-arrow,.uks-px,.uks-cart,.uks-info');
const setNdc = e => { ndc.set(e.clientX / vw * 2 - 1, -(e.clientY / vh * 2 - 1)); };
root.addEventListener('pointerdown', e => {
  drag.moved = false; if (uiTarget(e) || px.classList.contains('on')) return;
  if (introT > .02){ idrag = { y: e.clientY, t: introT, moved: false }; return; }
  drag.on = true; drag.axis = e.pointerType === 'mouse' ? 'x' : ''; drag.y0 = drag.ly = e.clientY; drag.x0 = drag.lx = e.clientX; drag.th0 = tg.th; drag.pan0 = tg.pan; drag.lt = performance.now(); spin = 0; setNdc(e);
});
let idrag = null;
root.addEventListener('pointermove', e => {
  if (idrag){ const dy = idrag.y - e.clientY; if (Math.abs(dy) > 7) idrag.moved = true; if (idrag.moved) setIntro(idrag.t - dy / vh * 1.5); }
  if (e.pointerType === 'mouse'){ mouse.on = !uiTarget(e); mouse.x = e.clientX / vw * 2 - 1; mouse.y = e.clientY / vh * 2 - 1; setNdc(e); if (view === 'zoom' && !drag.on){ tg.pan = mouse.x * panRange(); if (stations[zoomK].s.type !== 'rack'){ capY = (CAPS_STYLE === 1 ? 1.72 - mouse.y * .85 : 1.9 - mouse.y * .5); aim(); } } }
  if (!drag.on) return;
  const dx = e.clientX - drag.x0, dyT = e.clientY - drag.y0;
  if (!drag.axis && Math.max(Math.abs(dx), Math.abs(dyT)) > 9) drag.axis = Math.abs(dyT) > Math.abs(dx) ? 'y' : 'x';
  if (!drag.axis) return;
  if (drag.axis === 'y'){ drag.moved = true; advance((drag.ly - e.clientY) * 2.4); drag.ly = e.clientY; return; }      /* doigt vers le haut = avancer, comme la molette vers le bas */
  if (!drag.moved && Math.abs(dx) > 7){ drag.moved = true; root.classList.add('dragging'); if (view !== 'zoom' && view !== 'store') setView('store'); }
  if (!drag.moved) return;
  if (view === 'zoom') tg.pan = clampPan(drag.pan0 - dx / vw * 2 * (tg.d - R - ROD_Z) * Math.tan(camera.fov * RAD / 2) * camera.aspect);
  else { const g = small() ? .3 : .14; tg.th = drag.th0 - dx * g; const now = performance.now(); spin = Math.max(-160, Math.min(160, -(e.clientX - drag.lx) * g / Math.max(.016, (now - drag.lt) / 1000) * .5)); drag.lx = e.clientX; drag.lt = now; }
});
root.addEventListener('pointerleave', () => { mouse.on = false; });
function endDrag(e){
  if (idrag){ const m = idrag.moved; idrag = null; if (e && e.type === 'pointerup') setIntro(!m || introT < .6 ? 0 : 1); return; }      /* un simple clic (ou toucher) fait entrer */
  const was = drag.on, moved = drag.moved; drag.on = false; root.classList.remove('dragging');
  if (!was || moved || !e || e.type !== 'pointerup') return;
  setNdc(e); const it = pick(); if (it) act(it);
}
root.addEventListener('pointerup', endDrag); root.addEventListener('pointercancel', endDrag);
function act(it){
  const s = it.stn;
  if (it.shelf){ openPx(s.s.items, it.pi, s.s.label); return; }
  if (!zoomed(s)){ zoomK = s.k; setView('zoom'); s.hover = it.i; tg.pan = clampPan((it.i - (s.items.length - 1) / 2) * GAP_Z); return; }
  if (s.hover !== it.i || it.o < .5){ s.hover = it.i; return; }
  openPx(s.s.items, it.pi, s.s.label);
}
let zSnap = 0;
function advance(dy){                                /* défilement vertical (molette, ou doigt qui glisse verticalement) : la caméra avance vers le rayon en face, ou entre / ressort */
  dy = Math.max(-120, Math.min(120, dy));
    const k = view === 'store' ? wallOf(tg.th) : view === 'zoom' ? zoomK : view, rack = stations[k].s.type === 'rack';
    if (introT > 0 || (dy < 0 && view === 'store' && zl <= 0 && dAng(tg.th, 0) < 30)){      /* dehors : la molette fait avancer vers la porte (et ressortir en reculant) */
      if (introT === 0){ tg.th = near(0); }
      setIntro(introT - dy * .0011); clearTimeout(zSnap);
      zSnap = setTimeout(() => { if (introT > 0 && introT < .45) setIntro(0); }, 420);
      return;
    }
    zl = Math.max(0, Math.min(2, zl + dy * .002));
    const v = zl < .04 ? 'store' : zl >= 1.5 ? 'zoom' : k;
    if (v === 'zoom') zoomK = k;
    if (v !== view) setView(v, true); else aim();
    clearTimeout(zSnap);
    zSnap = setTimeout(() => { if (zl > 1 && zl < 2){ zl = dy > 0 ? 2 : 1; const w = zl === 2 ? 'zoom' : k; if (w === 'zoom') zoomK = k; if (w !== view) setView(w, true); else aim(); } }, 260);
}
root.addEventListener('wheel', e => {
  if (px.classList.contains('on')) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
  if (!d){ advance(e.deltaY * (e.deltaMode ? 30 : 1)); return; }
  if (view === 'zoom') tg.pan = clampPan(tg.pan + d * .004);
  else { if (view !== 'store') setView('store'); tg.th += d * .08; }
}, { passive: true });
const turn = dir => setView((wallOf(tg.th) + dir + N) % N);
$('#prev').addEventListener('click', () => turn(-1)); $('#next').addEventListener('click', () => turn(1));
const nav = $('#nav');
nav.innerHTML = '<button data-view="store" aria-current="true">Store</button>' + ST.map((s, k) => s.type === 'screen' ? '' : '<button data-view="' + k + '">' + s.label + '</button>').join('') +
  '<span class="sep"></span><button class="info" id="infoBtn" aria-label="Aide" aria-expanded="false">i</button>';
nav.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'infoBtn'){ const on = $('#info').classList.toggle('on'); b.setAttribute('aria-expanded', on); return; }
  setView(b.dataset.view === 'store' ? 'store' : +b.dataset.view);
});
document.addEventListener('keydown', e => {
  if (introT > .02){ if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === ' ') setIntro(0); return; }
  if (px.classList.contains('on')){ if (e.key === 'Escape') closePx(); if (e.key === 'ArrowRight') nextPx(); return; }
  if (e.key === 'Escape') setView(view === 'zoom' ? zoomK : 'store');
  if (view === 'zoom'){
    const s = stations[zoomK]; mouse.on = false;
    if (e.key === 'ArrowLeft') s.hover = Math.max(0, s.hover - 1);
    if (e.key === 'ArrowRight') s.hover = Math.min(s.items.length - 1, s.hover + 1);
    if (e.key === 'Enter' && s.hover >= 0) openPx(s.s.items, s.items[s.hover].pi, s.s.label);
    if (s.hover >= 0 && /Arrow/.test(e.key)) tg.pan = clampPan((s.hover - (s.items.length - 1) / 2) * GAP_Z);
  } else { if (e.key === 'ArrowLeft') turn(-1); if (e.key === 'ArrowRight') turn(1); if (e.key === 'Enter' && view !== 'store' && stations[view].s.type === 'rack'){ zoomK = view; setView('zoom'); stations[view === 'zoom' ? zoomK : zoomK].hover = 0; } }
});

/* ---------- fiche produit ---------- */
let cur = null, chosen = null, count = 0;
function openPx(list, i, cat){
  cur = { list, i, cat }; chosen = null;
  const p = list[i], im = $('#pxImg');
  im.src = p.k ? 'store-assets/' + p.k + '-face.webp' : p.flat.src; im.alt = p.name;
  $('#pxCat').textContent = cat; $('#pxName').textContent = p.name; $('#pxPrice').textContent = p.price;
  $('#pxSub').textContent = p.av ? 'En stock' : 'Épuisé';
  $('#pxLink').href = p.url; $('#pxLink').textContent = 'Voir la fiche complète →';
  $('#pxNext').style.display = list.length > 1 ? '' : 'none';
  const sz = $('#pxSizes'); sz.innerHTML = ''; $('#pxSizeWrap').style.display = p.sizes.length ? '' : 'none';
  p.sizes.forEach(s => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s.t; b.disabled = !s.av; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { chosen = s.t; sz.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); upd(); });
    sz.appendChild(b);
  });
  upd(); px.classList.add('on'); root.classList.add('px-on'); root.style.cursor = ''; wake();
}
function upd(){
  const p = cur.list[cur.i], a = $('#pxAdd'); a.classList.remove('ok');
  if (!p.av){ a.disabled = true; a.textContent = 'Épuisé'; }
  else if (p.sizes.length && !chosen){ a.disabled = true; a.textContent = 'Choisis une taille'; }
  else { a.disabled = false; a.textContent = 'Ajouter au panier'; }
}
const nextPx = () => openPx(cur.list, (cur.i + 1) % cur.list.length, cur.cat);
const closePx = () => { px.classList.remove('on'); root.classList.remove('px-on'); };
$('#close').addEventListener('click', closePx); $('#pxNext').addEventListener('click', nextPx);
$('#pxAdd').addEventListener('click', function(){
  if (this.classList.contains('ok')) return;
  /* maquette : sur le thème, ajout réel au panier Shopify */
  this.classList.add('ok'); this.textContent = 'Ajouté au panier ✓';
  $('#pxLink').href = 'https://unkutofficial.com/cart'; $('#pxLink').textContent = 'Voir le panier →';
  const im = $('#pxImg'), a = im.getBoundingClientRect(), b = $('#cart').getBoundingClientRect(), f = im.cloneNode();
  f.className = 'uks-fly'; f.style.cssText = 'left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px';
  document.body.appendChild(f); f.getBoundingClientRect();
  f.style.transform = 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(.08)'; f.style.opacity = '.2';
  setTimeout(() => { f.remove(); count++; const c = $('#cartN'); c.textContent = count; c.classList.add('on'); }, 800);
});

addEventListener('resize', resize); resize(); cam.d = tg.d; cam.y = tg.y; setView('store');
requestAnimationFrame(frame);
window.UKS = { jump: v => { intro = introT = v; root.classList.toggle('out', v > .02); wake(); }, setIntro, get intro(){ return intro; }, facade, renderer, scene, camera, THREE, uploads, setView, cam, tg, stations, step: (k, dt) => layout(stations[k], dt), zoom: k => { zoomK = k; setView('zoom'); }, hover: (k, i) => { mouse.on = false; stations[k].hover = i; } };
