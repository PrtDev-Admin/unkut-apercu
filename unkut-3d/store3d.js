import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const D = window.UKS_DATA, SEQ = window.UKS_SEQ, $ = s => document.querySelector(s);
const ST = D.stations, N = ST.length, RAD = Math.PI / 180;
/* salle à 5 pans : un grand mur (photo entière) et quatre murs de la largeur du décor central */
const ANG = [0.00, 80.43, 146.81, 213.19, 279.57], STEP = 66;
const root = $('#uks'), px = $('#px');
/* dimensions en mètres */
const R = 4.138, HH = 4.43, PXM = 4.43 / 990,          /* PXM : mètres par pixel de la photo de référence */
      WW = 2000 * (4.43 / 990);
const PANEL_W = 3.4, PANEL_H = 4.2, PANEL_Z = -R + .5, FRONT = PANEL_Z + .07;
const ROD_Y = 2.72, ROD_Z = FRONT + .2, GH = 1.08, SC = GH / 1431, GAP_O = .15, GAP_Z = .3, TURN = .62;
const small = () => innerWidth < 760;

/* ---------- rendu ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
renderer.toneMapping = THREE.NoToneMapping;
root.prepend(renderer.domElement); renderer.domElement.className = 'uks-gl';
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x060607); 
const camera = new THREE.PerspectiveCamera(40, 1, .1, 60);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .1, .4, 1.0); composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- textures procédurales ---------- */
function canvasTex(w, h, draw, rep){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function concrete(rep){
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++){
      const v = 120 + Math.random() * 80 | 0, r = 6 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v},${v},${.03 + Math.random() * .05})`;
      g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r, r * (.3 + Math.random()), Math.random() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 9000; i++){ const v = Math.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},.05)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  }, rep);
}
const gridTex = (rep, line, bg) => canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); if (bg){ g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.strokeStyle = line; g.lineWidth = 7; g.strokeRect(0, 0, w, h);
}, rep);
const loader = new THREE.TextureLoader();
function tex(src){ const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

/* ---------- boutique modélisée dans Blender : matière nette (répétée) × lumière calculée (lightmap) ---------- */
const mMetal = new THREE.MeshStandardMaterial({ color: 0x151516, roughness: .4, metalness: .85 });
const mSteel = new THREE.MeshStandardMaterial({ color: 0x9a9da1, roughness: .35, metalness: .9 });
const mWood = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: .7 });
function beton(base, o = {}){
  const t = canvasTex(1024, 1024, (g, w, h) => {
    const v = (d, a) => { const c = Math.max(0, Math.min(255, base + d)) | 0; return `rgba(${c},${c},${c + 1},${a})`; };
    g.fillStyle = v(0, 1); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++){ const r = 60 + Math.random() * 260, x = Math.random() * w, y = Math.random() * h, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, v((Math.random() - .5) * (o.var || 18), .2)); gr.addColorStop(1, v(0, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    const im = g.getImageData(0, 0, w, h), d = im.data;                       /* grain fin */
    for (let i = 0; i < d.length; i += 4){ const n = (Math.random() - .5) * (o.grain || 4); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
    if (o.joints){ g.strokeStyle = v(-34, .5); g.lineWidth = 2; for (let y = 0; y <= h; y += h / o.joints){ g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = v(-46, .7); for (let y = h / o.joints / 2; y < h; y += h / o.joints) for (const x of [w * .25, w * .75]){ g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } }
    if (o.grid){ g.strokeStyle = v(46, 1); g.lineWidth = 3; const st = w / o.grid; for (let p = 0; p <= w; p += st){ g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); } }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep || .4, o.rep || .4); return t;
}
const photoTex = (f, span) => { const t = tex('store-assets/' + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / span, 1 / span); return t; };
const TX = { beton: photoTex('tx_beton.jpg', 2.6), sol: photoTex('tx_sol.jpg', 3.2), enduit: photoTex('tx_enduit.jpg', 2.4) };   /* matières photographiées (Poly Haven, CC0) */
const lin = v => Math.pow(v / 255, 2.2);
const ALB = {                      /* [texture, teinte] : la teinte ramène la matière à l'albédo utilisé dans Blender */
  wall: [TX.beton, .16 / lin(160)], pillar: [TX.beton, .32 / lin(160)], panel: [TX.enduit, .82 / lin(232)],
  grid: [beton(46, { rep: 1.4, grid: 12, var: 6 }), 1], floor: [TX.sol, .2 / lin(128)], slab: [beton(38, { rep: .5, var: 6 }), 1]
};
const EXPO = 1.25;                 /* exposition générale de la lumière calculée */
const lmTex = n => { const t = tex('store-assets/lm_' + n + '.png'); t.flipY = false; t.channel = 2; return t; };
const LMAP = { shell: lmTex('shell'), motifs: lmTex('motifs') };
new GLTFLoader().load('store-assets/boutique.glb', gl => {
  gl.scene.traverse(o => {
    if (!o.isMesh) return;
    const grp = o.parent && LMAP[o.parent.name] ? o.parent.name : o.name.split('_')[0], n = o.material.name;
    if (n === 'neon') o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.8) });
    else if (n === 'lightpanel') o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.55), side: THREE.DoubleSide });
    else {
      o.material = new THREE.MeshBasicMaterial({ map: ALB[n][0], color: new THREE.Color().setScalar(ALB[n][1]), lightMap: LMAP[grp] || LMAP.shell, lightMapIntensity: 2 * Math.PI * EXPO });
      if (n === 'floor'){ o.material.transparent = true; o.material.opacity = .74; }
    }
  });
  scene.add(gl.scene);
});
/* sol poli : reflet discret sous le béton ; plafond grillagé */
const mirror = new Reflector(new THREE.CircleGeometry(11, 48), { textureWidth: 1024, textureHeight: 1024, color: 0x8a8a8a });
mirror.rotation.x = -Math.PI / 2; mirror.position.y = -.004; scene.add(mirror);
const ceil = new THREE.Mesh(new THREE.CircleGeometry(11, 48), new THREE.MeshBasicMaterial({ map: gridTex([110, 110], '#34363a'), transparent: true, alphaTest: .4, side: THREE.DoubleSide }));
ceil.rotation.x = Math.PI / 2; ceil.position.y = HH; scene.add(ceil);
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, .8));

/* ---------- pièces de vêtements ---------- */
const hits = [];                                   /* maillages cliquables */
const shadowMat = map => new THREE.MeshBasicMaterial({ map, color: 0x000000, transparent: true, opacity: .26, depthWrite: false });
const garmentMat = map => new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .08, side: THREE.DoubleSide });
function hangerGeo(g){
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.4, .022, .016), mWood); bar.position.y = -.075; g.add(bar);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.022, .004, 6, 14, Math.PI * 1.35), mSteel); hook.position.y = -.02; hook.rotation.z = -.3; g.add(hook);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .04, 6), mSteel); stem.position.y = -.058; g.add(stem);
}
function makeItem(p, parent, decor){
  const it = { p, o: 0, e: 0, x: 0, fr: -1, st: -1, grp: new THREE.Group() };
  it.grp.position.set(0, ROD_Y - .012, ROD_Z); parent.add(it.grp);
  if (p.k){                                        /* photos sur cintre + planche de rotation vidéo */
    const q = SEQ[p.k], rows = Math.ceil(q.frames / q.cols), w = q.W * SC, h = q.H * SC;
    it.q = q; it.rows = rows;
    it.tS = tex('stills/ukr-still-' + p.k + '-profil.webp'); it.tF = tex('stills/ukr-still-' + p.k + '-face.webp');
    it.tQ = tex('stills/ukr-mot-' + p.k + '.webp'); it.tQ.repeat.set(1 / q.cols, 1 / rows);
    const geo = new THREE.PlaneGeometry(w, h);
    it.mesh = new THREE.Mesh(geo, garmentMat(decor ? it.tF : it.tS));
    it.mesh.position.set((q.W / 2 - q.hx) * SC, -(q.H / 2 - q.y0) * SC + .005, 0); it.grp.add(it.mesh);
    it.sh = new THREE.Mesh(geo, shadowMat(decor ? it.tF : it.tS)); it.sh.position.copy(it.mesh.position).add(new THREE.Vector3(.035, -.045, -.17)); it.grp.add(it.sh);
    const wl = q.widths[q.widths.length - 1]; it.wr = q.widths.map(v => v / wl); it.fw = w * .72; it.h = q.gh * SC;
  } else {                                         /* photo à plat détourée sur un vrai cintre : pivote en 3D */
    const f = p.flat, gh = GH * f.gk, w = f.w / f.h * gh, t = tex(f.src);
    it.piv = new THREE.Group(); it.grp.add(it.piv); hangerGeo(it.piv);
    const geo = new THREE.PlaneGeometry(w, gh);
    it.mesh = new THREE.Mesh(geo, garmentMat(t)); it.mesh.position.set((.5 - f.cx) * w, -.07 - gh / 2, 0); it.piv.add(it.mesh);
    it.sh = new THREE.Mesh(geo, shadowMat(t)); it.sh.position.set(it.mesh.position.x + .035, it.mesh.position.y - .045, -.17); it.grp.add(it.sh);
    it.fw = w; it.h = gh + .07; it.rest = decor ? 0 : 1.36;
    it.piv.rotation.y = it.rest; it.sh.scale.x = Math.max(.1, Math.cos(it.rest));
  }
  if (!decor){
    it.hit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
    it.hit.position.set(0, -it.h / 2, .05); it.hit.scale.set(GAP_O, it.h + .1, 1); it.grp.add(it.hit); it.hit.userData.it = it; hits.push(it.hit);
  }
  return it;
}
function labelTex(text){
  return canvasTex(1024, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#111'; g.font = '600 54px Helvetica Neue,Helvetica,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const s = text.toUpperCase().split('').join('  '); g.fillText(s, w / 2, h / 2); });
}

/* ---------- les stations : même décor central pour chaque catégorie ---------- */
const logoTex = tex('store-assets/logo.png');
const stations = ST.map((s, k) => {
  const g = new THREE.Group(); g.rotation.y = -ANG[k] * RAD; scene.add(g);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  /* logo + nom du rayon sur le panneau */
  const lg = add(new THREE.PlaneGeometry(.95, .95 * 279 / 939), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }), 0, 3.38, FRONT + .005);
  add(new THREE.PlaneGeometry(1.9, 1.9 / 8), new THREE.MeshBasicMaterial({ map: labelTex(s.label), transparent: true, opacity: .75 }), 0, 3.13, FRONT + .005);
  const stn = { k, s, g, hover: -1, m: 0, items: [], lg };
  if (s.type === 'rack'){
    const rod = add(new THREE.CylinderGeometry(.011, .011, 3.2, 12), mMetal, 0, ROD_Y, ROD_Z); rod.rotation.z = Math.PI / 2;
    [-1.48, 1.48].forEach(x => { add(new THREE.CylinderGeometry(.009, .009, ROD_Z - FRONT, 8), mMetal, x, ROD_Y, (ROD_Z + FRONT) / 2).rotation.x = Math.PI / 2; });
    stn.items = s.items.map((p, i) => { const it = makeItem(p, g); it.i = i; it.stn = stn; return it; });
  } else {                                         /* accessoires : tablettes sur le panneau */
    const cols = 3, cw = .95, rh = .78;
    stn.items = s.items.map((p, i) => {
      const c = i % cols, r = Math.floor(i / cols), x = (c - (cols - 1) / 2) * cw, y = 2.25 - r * rh, f = p.flat, w = .44, h = w * f.h / f.w, t = tex(f.src);
      add(new THREE.BoxGeometry(.62, .022, .2), new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: .6 }), x, y - .012, FRONT + .1);
      const m = add(new THREE.PlaneGeometry(w, h), garmentMat(t), x, y + h / 2, FRONT + .12);
      add(new THREE.PlaneGeometry(w, h), shadowMat(t), x + .03, y + h / 2 - .02, FRONT + .004);
      const it = { p, i, stn, mesh: m, e: 0, y0: y + h / 2, shelf: true }; m.userData.it = it; hits.push(m); return it;
    });
  }
  return stn;
});
/* premier mur : portants sur pied dans les renfoncements, la boutique continue derrière */
(function(){
  const g = stations[0].g, pool = ST[2].items.concat(ST[1].items);
  [-1, 1].forEach(sd => {
    const rk = new THREE.Group(); rk.position.set(sd * 3.62, 0, -R - 1.7); rk.rotation.y = -sd * 1.05; g.add(rk);
    const tube = (len, x, y, z, rz, rx) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, len, 8), mSteel); m.position.set(x, y, z); if (rz) m.rotation.z = rz; if (rx) m.rotation.x = rx; rk.add(m); };
    tube(2.2, 0, 1.78, 0, Math.PI / 2); tube(1.78, -1.1, .89, 0); tube(1.78, 1.1, .89, 0); tube(.5, -1.1, .02, 0, 0, Math.PI / 2); tube(.5, 1.1, .02, 0, 0, Math.PI / 2);
    for (let i = 0; i < 7; i++){
      const it = makeItem(pool[(i * 2 + (sd > 0 ? 1 : 0)) % pool.length], rk, true);
      it.grp.position.set(-.9 + i * .3, 1.768, .001 * i); it.grp.scale.setScalar(.9); it.sh.visible = false; it.mesh.material.color.setScalar(.62);
      it.grp.rotation.y = sd * .75;
    }
  });
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
let zl = 0;                                          /* niveau de zoom continu : 0 = salle, 1 = devant le mur, 2 = devant le portant */
const mix = (a, b, t) => a + (b - a) * t;
function aim(){
  const tv = Math.tan(camera.fov * RAD / 2), th = tv * camera.aspect, k = view === 'store' ? wallOf(tg.th) : view === 'zoom' ? zoomK : view;
  const dS = Math.min(2 * R - .9, Math.max(R + 1, (k === 0 ? WW / 2 : 2.9) / th));
  const dW = Math.min(dS - 1.2, Math.max(3.2, Math.max(2.35 / th, 1.75 / tv)));
  const dZ = (R + ROD_Z) + (vw < vh * .8 ? 1.4 : 1.12) / tv;
  tg.d = zl <= 1 ? mix(dS, dW, zl) : mix(dW, dZ, zl - 1);
  tg.y = zl <= 1 ? mix(2.0, 2.05, zl) : mix(2.05, ROD_Y - .58, zl - 1);
  if (view !== 'store') tg.th = near(ANG[k]);
  if (view !== 'zoom') tg.pan = 0;
}
function setView(v, keep){
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
  camera.aspect = vw / vh; camera.fov = vw < vh * .8 ? 58 : 40; camera.updateProjectionMatrix();
  renderer.setSize(vw, vh); composer.setSize(vw, vh); aim();
}
function panRange(){
  const s = stations[zoomK]; if (!s || !s.items.length || s.s.type !== 'rack') return 0;
  const half = (tg.d - R - ROD_Z) * Math.tan(camera.fov * RAD / 2) * camera.aspect, ext = (s.items.length - 1) / 2 * GAP_Z + .55;
  return Math.max(0, ext - half * .75);
}
const clampPan = x => { const r = panRange(); return Math.max(-r, Math.min(r, x)); };

/* ---------- animation des portants ---------- */
function layout(s, dt){
  if (s.s.type !== 'rack'){
    s.items.forEach(it => { it.e += ((s.hover === it.i && live(s) ? 1 : 0) - it.e) * (1 - Math.exp(-dt * 10)); it.mesh.scale.setScalar(1 + it.e * .12); it.mesh.position.y = it.y0 + it.e * .02; });
    return;
  }
  const n = s.items.length, on = live(s);
  s.m += ((zoomed(s) ? 1 : 0) - s.m) * (1 - Math.exp(-dt * 3.4));
  const gap = GAP_O + (GAP_Z - GAP_O) * s.m;
  s.items.forEach(it => {
    const want = s.hover === it.i && on ? 1 : 0;
    it.o = want > it.o ? Math.min(1, it.o + dt / TURN) : Math.max(0, it.o - dt / TURN);
    it.e = it.o * it.o * (3 - 2 * it.o);
  });
  s.items.forEach((it, i) => {
    let x = (i - (n - 1) / 2) * gap;
    s.items.forEach((o, j) => { if (j !== i) x += (i > j ? 1 : -1) * o.e * (o.fw * .5 - gap * .35); });
    it.x = x; it.grp.position.x = x; it.grp.position.z = ROD_Z + it.e * .03;
    let wNow;
    if (it.q){
      const fr = Math.round(it.e * (it.q.frames - 1)), st = it.e <= .001 ? 0 : it.e >= .999 ? 2 : 1;
      if (fr !== it.fr || st !== it.st){
        it.fr = fr; it.st = st;
        const t = st === 0 ? it.tS : st === 2 ? it.tF : it.tQ;
        if (st === 1) it.tQ.offset.set((fr % it.q.cols) / it.q.cols, 1 - (Math.floor(fr / it.q.cols) + 1) / it.rows);
        it.mesh.material.map = t; it.sh.material.map = t;
      }
      wNow = it.fw * it.wr[fr];
    } else {
      const a = it.rest * (1 - it.e); it.piv.rotation.y = a;
      const c = Math.max(.1, Math.cos(a)); it.sh.scale.x = c; wNow = it.fw * c;
    }
    it.hit.scale.x = Math.max(gap, wNow);
  });
}

/* ---------- boucle ---------- */
const clock = new THREE.Clock(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), V = new THREE.Vector3();
let spin = 0, shown = null;
function pick(){ ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(hits, false)[0]; return h ? h.object.userData.it : null; }
function frame(){
  const dt = Math.min(.05, clock.getDelta()), k = 1 - Math.exp(-dt * 3.4);
  if (!drag.on && Math.abs(spin) > .01 && view === 'store'){ tg.th += spin * dt; spin *= Math.exp(-dt * 3); }
  cam.th += (tg.th - cam.th) * (drag.on ? 1 - Math.exp(-dt * 14) : k);
  cam.d += (tg.d - cam.d) * k; cam.y += (tg.y - cam.y) * k; cam.pan += (tg.pan - cam.pan) * (1 - Math.exp(-dt * 5));
  mouse.sx += (mouse.x - mouse.sx) * .06; mouse.sy += (mouse.y - mouse.sy) * .06;
  const par = view === 'zoom' ? .15 : 1, a = (cam.th + mouse.sx * 2.5 * par) * RAD, s = Math.sin(cam.th * RAD), c = Math.cos(cam.th * RAD), r = R - cam.d;
  camera.position.set(s * r + c * cam.pan, cam.y, -c * r + s * cam.pan);
  camera.lookAt(camera.position.x + Math.sin(a) * 10, cam.y - mouse.sy * .25 * par, camera.position.z - Math.cos(a) * 10);
  /* survol */
  if (mouse.on && !drag.on && !px.classList.contains('on')){
    const it = pick();
    stations.forEach(st => { if (it && it.stn === st) st.hover = it.i; else if (!zoomed(st) || st.s.type !== 'rack') st.hover = -1; });
    root.style.cursor = it ? 'pointer' : '';
  }
  stations.forEach(st => layout(st, dt));
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
  composer.render();
  requestAnimationFrame(frame);
}

/* ---------- interactions ---------- */
const drag = { on: false, moved: false, x0: 0, th0: 0, pan0: 0, lx: 0, lt: 0 };
const uiTarget = e => e.target.closest('.uks-nav,.uks-arrow,.uks-px,.uks-cart,.uks-info');
const setNdc = e => { ndc.set(e.clientX / vw * 2 - 1, -(e.clientY / vh * 2 - 1)); };
root.addEventListener('pointerdown', e => {
  drag.moved = false; if (uiTarget(e) || px.classList.contains('on')) return;
  drag.on = true; drag.x0 = drag.lx = e.clientX; drag.th0 = tg.th; drag.pan0 = tg.pan; drag.lt = performance.now(); spin = 0; setNdc(e);
});
root.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse'){ mouse.on = !uiTarget(e); mouse.x = e.clientX / vw * 2 - 1; mouse.y = e.clientY / vh * 2 - 1; setNdc(e); if (view === 'zoom' && !drag.on) tg.pan = mouse.x * panRange(); }
  if (!drag.on) return;
  const dx = e.clientX - drag.x0;
  if (!drag.moved && Math.abs(dx) > 7){ drag.moved = true; root.classList.add('dragging'); if (view !== 'zoom' && view !== 'store') setView('store'); }
  if (!drag.moved) return;
  if (view === 'zoom') tg.pan = clampPan(drag.pan0 - dx / vw * 2 * (tg.d - R - ROD_Z) * Math.tan(camera.fov * RAD / 2) * camera.aspect);
  else { const g = small() ? .3 : .14; tg.th = drag.th0 - dx * g; const now = performance.now(); spin = -(e.clientX - drag.lx) * g / Math.max(.008, (now - drag.lt) / 1000) * .5; drag.lx = e.clientX; drag.lt = now; }
});
root.addEventListener('pointerleave', () => { mouse.on = false; });
function endDrag(e){
  const was = drag.on, moved = drag.moved; drag.on = false; root.classList.remove('dragging');
  if (!was || moved || !e || e.type !== 'pointerup') return;
  setNdc(e); const it = pick(); if (it) act(it);
}
root.addEventListener('pointerup', endDrag); root.addEventListener('pointercancel', endDrag);
function act(it){
  const s = it.stn;
  if (it.shelf){ openPx(s.s.items, it.i, s.s.label); return; }
  if (!zoomed(s)){ zoomK = s.k; setView('zoom'); s.hover = it.i; tg.pan = clampPan((it.i - (s.items.length - 1) / 2) * GAP_Z); return; }
  if (s.hover !== it.i || it.o < .5){ s.hover = it.i; return; }
  openPx(s.s.items, it.i, s.s.label);
}
let zSnap = 0;
root.addEventListener('wheel', e => {
  if (px.classList.contains('on')) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
  if (!d){                                           /* défilement : la caméra avance progressivement vers le rayon en face */
    const k = view === 'store' ? wallOf(tg.th) : view === 'zoom' ? zoomK : view, rack = stations[k].s.type === 'rack';
    const dy = Math.max(-120, Math.min(120, e.deltaY * (e.deltaMode ? 30 : 1)));
    zl = Math.max(0, Math.min(rack ? 2 : 1, zl + dy * .002));
    const v = zl < .04 ? 'store' : zl >= 1.5 && rack ? 'zoom' : k;
    if (v === 'zoom') zoomK = k;
    if (v !== view) setView(v, true); else aim();
    clearTimeout(zSnap);
    zSnap = setTimeout(() => { if (zl > 1 && zl < 2){ zl = dy > 0 ? 2 : 1; const w = zl === 2 ? 'zoom' : k; if (w === 'zoom') zoomK = k; if (w !== view) setView(w, true); else aim(); } }, 260);
    return;
  }
  if (view === 'zoom') tg.pan = clampPan(tg.pan + d * .004);
  else { if (view !== 'store') setView('store'); tg.th += d * .08; }
}, { passive: true });
const turn = dir => setView((wallOf(tg.th) + dir + N) % N);
$('#prev').addEventListener('click', () => turn(-1)); $('#next').addEventListener('click', () => turn(1));
const nav = $('#nav');
nav.innerHTML = '<button data-view="store" aria-current="true">Store</button>' + ST.map((s, k) => '<button data-view="' + k + '">' + s.label + '</button>').join('') +
  '<span class="sep"></span><button class="info" id="infoBtn" aria-label="Aide" aria-expanded="false">i</button>';
nav.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'infoBtn'){ const on = $('#info').classList.toggle('on'); b.setAttribute('aria-expanded', on); return; }
  setView(b.dataset.view === 'store' ? 'store' : +b.dataset.view);
});
document.addEventListener('keydown', e => {
  if (px.classList.contains('on')){ if (e.key === 'Escape') closePx(); if (e.key === 'ArrowRight') nextPx(); return; }
  if (e.key === 'Escape') setView(view === 'zoom' ? zoomK : 'store');
  if (view === 'zoom'){
    const s = stations[zoomK]; mouse.on = false;
    if (e.key === 'ArrowLeft') s.hover = Math.max(0, s.hover - 1);
    if (e.key === 'ArrowRight') s.hover = Math.min(s.items.length - 1, s.hover + 1);
    if (e.key === 'Enter' && s.hover >= 0) openPx(s.s.items, s.hover, s.s.label);
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
  upd(); px.classList.add('on'); root.classList.add('px-on'); root.style.cursor = '';
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
window.UKS = { setView, cam, tg, stations, zoom: k => { zoomK = k; setView('zoom'); }, hover: (k, i) => { mouse.on = false; stations[k].hover = i; } };
