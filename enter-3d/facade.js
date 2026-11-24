/* Extérieur de la boutique, modélisé en 3D temps réel (aucune vidéo).
   Plan : la salle est un octogone — mur écran + comptoir (0°), 6 murs de rayons, et l'entrée (180°) en face de l'écran.
   Le bâtiment suit ce contour, 1 m plus large : pans coupés, comme la boutique d'angle de la vidéo de référence.
   Depuis la rue on voit la vraie boutique à travers la porte ; les deux vitrines voisines donnent sur le dos (plein) des murs de rayons.
   Toutes les matières sont des photos Poly Haven (CC0) avec relief et rugosité. */
export function buildFacade(THREE, scene, R, opt){
  const { renderer, mgr, openW, openH } = opt, RAD = Math.PI / 180, G = new THREE.Group(); G.name = 'facade'; scene.add(G);
  const AN = Math.min(16, renderer.capabilities.getMaxAnisotropy()), loader = new THREE.TextureLoader(mgr), EXT = 'store-assets/ext/';
  const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = AN; if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const img = (src, rx, ry, srgb) => { const t = loader.load(src); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = AN; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  /* matière photo complète : couleur + relief + rugosité (rx, ry = nombre de répétitions) */
  const pbr = (name, rx, ry, o) => new THREE.MeshStandardMaterial(Object.assign({ map: img(EXT + name + '_diff.webp', rx, ry, true), normalMap: img(EXT + name + '_nor.webp', rx, ry),
    roughnessMap: img(EXT + name + '_rough.webp', rx, ry), envMapIntensity: .12 }, o));
  const basic = o => new THREE.MeshBasicMaterial(o), std = o => new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: .35 }, o));
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7919);
  const add = (geo, mat, x = 0, y = 0, z = 0, ry = 0, par = G) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; par.add(m); return m; };
  const flat = (geo, mat, x, y, z) => { const m = add(geo, mat, x, y, z); m.rotation.x = -Math.PI / 2; return m; };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const box = (w, h, d, mat, x, y, z, ry, par) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, par);

  /* --- cotes : le bâtiment est un octogone qui suit les 8 pans de la salle, 1 m plus large --- */
  const T8 = Math.tan(22.5 * RAD), C8 = Math.cos(22.5 * RAD), RE = R + 1.0, ZF = RE, FWd = 2 * RE * T8, HW = RE / C8 + .9;
  const H1 = 4.44, H2 = 5.35, H3 = 9.1, H4 = 10.1, OW = openW / 2;
  const foot = Array.from({ length: 8 }, (_, i) => { const a = (22.5 + 45 * i) * RAD, r = R / C8; return [Math.sin(a) * r, -Math.cos(a) * r]; });      /* emprise de la salle : miroir du sol */
  /* pan d'angle a (0° = mur écran, 180° = entrée) : point à la distance r du centre, décalé de u le long du pan */
  const fp = (a, r, u = 0) => { const ry = Math.PI - a * RAD; return [Math.sin(a * RAD) * r + Math.cos(ry) * u, -Math.cos(a * RAD) * r - Math.sin(ry) * u, ry]; };
  const onF = (geo, mat, a, r, y, u = 0, par) => { const [x, z, ry] = fp(a, r, u); return add(geo, mat, x, y, z, ry, par); };
  const prism = (r, y0, y1, mat) => add(new THREE.CylinderGeometry(r / C8, r / C8, y1 - y0, 8, 1, true, 22.5 * RAD), mat, 0, (y0 + y1) / 2, 0);      /* ceinture octogonale */
  const ring8 = (r0, r1, y, mat) => { const m = add(new THREE.RingGeometry(r0 / C8, r1 / C8, 8, 1, 22.5 * RAD), mat, 0, y, 0); m.rotation.x = -Math.PI / 2; return m; };

  /* matières */
  const clad = (w, h) => pbr('panel_noir', w / 9, h / 9, {      /* w, h = taille de la surface en mètres : même échelle de panneau partout */ color: 0x3c3c3e, metalness: .35, envMapIntensity: .35 });      /* bardage noir */
  const blackM = basic({ color: 0x050506 }), led = basic({ color: 0xf6f8ff }), steel = std({ color: 0x0d0d0e, roughness: .35, metalness: .8 });
  const glowV = ctex(8, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(225,235,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const glowM = basic({ map: glowV, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const spot = ctex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });

  const SW = ZF + 3.7, YR = -.15, decal = m => { m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -8; return m; };
  const lamps = [[-15.5, SW + .6], [15.5, SW + .6]];

  /* --- le décor bâti : modélisé et éclairé dans Blender (blender/build_exterior.py), comme l'intérieur de la boutique.
         Chaque matière = une photo (Poly Haven) multipliée par la lumière calculée : ombres, halos des vitrines et des lampadaires, rebonds. --- */
  const LMAX = opt.lmax || 2, EXPO = 1.35, LMI = Math.PI * LMAX * EXPO, V = '?e=' + (opt.ver || 1);
  const lm = n => { const t = loader.load('store-assets/lm_ext_' + n + '.webp' + V); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.anisotropy = 4; return t; };
  const LM = { ground: lm('ground'), shop: lm('shop'), city: lm('city') };
  const photo = (name, tile) => { const t = loader.load(EXT + name + '_diff.webp'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = AN; return t; };
  const pleats = ctex(512, 8, (g, w, h) => { for (let x = 0; x < w; x++){ const v = 150 + Math.sin(x * .42) * 34 + Math.sin(x * 1.31 + 1) * 16 + (rnd() - .5) * 10; g.fillStyle = `rgb(${v | 0},${v | 0},${v + 4 | 0})`; g.fillRect(x, 0, 1, h); } }, [1 / 1.6, 1]);
  /* matière Blender -> [photo, taille d'un motif en mètres, teinte] */
  const ALB = { asphalt: ['clean_asphalt', 5, 1.0], sidewalk: ['concrete_pavement_02', 2.4, 1.15], kerb: ['concrete_wall_008', 3, .9], pavers: ['brick_pavement_02', 1.6, 1.0], base: [null, 1, .04],
    clad: ['panel_noir', 9, .5], soffit: [null, 1, .75], plaster: ['white_plaster_02', 3, 1.0], floorc: ['concrete_floor_02', 3, 1.2], curtain: [pleats, 0, .9], roof: [null, 1, .03],
    wall_blue: ['wall_beton', 3, 1.15],      /* immeuble de gauche : béton clair (la brique peinte en bleu a été refusée) */
     wall_dark: ['wall_carreaux', 2.6, .85], wall_grey: ['wall_beton', 3, .9], wall_office: ['wall_beton', 3, .7], wall_brick: ['wall_brique', 1.8, 1.0], wall_tile: ['wall_carreaux2', 2.6, .9],
    frame: [null, 1, .08], sill: ['concrete_wall_008', 3, 1.0], pole: [null, 1, .06] };
  const albT = {}, matFor = (n, grp) => { const a = ALB[n] || [null, 1, .5], t = a[0] && (albT[n] || (albT[n] = typeof a[0] === 'string' ? photo(a[0], a[1]) : a[0]));
    return project(basic({ map: t || null, color: new THREE.Color().setScalar(a[2]), lightMap: LM[grp], lightMapIntensity: LMI })); };
  /* --- le rendu de l'image réaliste, porté par le 3D : l'image d'ouverture est PROJETÉE sur le décor depuis le point de vue de départ
         (comme un projecteur de diapositives posé à la place de la caméra). Chaque surface reçoit ainsi sa « photo », et la garde quand la caméra avance.
         Ne reçoivent pas l'image : les surfaces qu'on ne voyait pas au départ (cachées derrière autre chose — carte de profondeur — ou vues de trop biais). --- */
  const PJ = { cam: new THREE.PerspectiveCamera(40, 16 / 9, 2, 400), k: { value: 0 }, map: { value: null }, depth: { value: null }, mat: { value: new THREE.Matrix4() }, pos: { value: new THREE.Vector3() } }, projHide = [];
  PJ.cam.position.set(0, 1.72, ZF + 12.5); PJ.cam.lookAt(0, 2.85, ZF); PJ.cam.updateMatrixWorld(true); PJ.cam.updateProjectionMatrix();
  PJ.mat.value.multiplyMatrices(PJ.cam.projectionMatrix, PJ.cam.matrixWorldInverse); PJ.pos.value.copy(PJ.cam.position);
  { const t = loader.load('store-assets/ouverture.webp?v=5'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = AN; PJ.map.value = t; }
  const pjRT = new THREE.WebGLRenderTarget(2048, 1152, { depthTexture: new THREE.DepthTexture(2048, 1152) });
  const project = m => { m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { pjMat: PJ.mat, pjPos: PJ.pos, pjMap: PJ.map, pjDepth: PJ.depth, pjK: PJ.k });
      sh.vertexShader = 'uniform mat4 pjMat; varying vec4 vPj; varying vec3 vPjW, vPjN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vec4 pjw = modelMatrix * vec4(transformed, 1.0); vPjW = pjw.xyz; vPj = pjMat * pjw; vPjN = mat3(modelMatrix) * normal;');
      sh.fragmentShader = 'uniform sampler2D pjMap, pjDepth; uniform vec3 pjPos; uniform float pjK; varying vec4 vPj; varying vec3 vPjW, vPjN;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        if (pjK > 0. && vPj.w > 0.){ vec3 pc = vPj.xyz / vPj.w; vec2 puv = pc.xy * .5 + .5;
          float m = smoothstep(0., .006, puv.x) * smoothstep(1., .994, puv.x) * smoothstep(0., .006, puv.y) * smoothstep(1., .994, puv.y);
          vec3 pn = normalize(vPjN); if (!gl_FrontFacing) pn = -pn;
          m *= smoothstep(.004, .03, dot(pn, normalize(pjPos - vPjW)));                                  /* surface vue de trop biais depuis le départ : pas d'image */
          m *= step(pc.z * .5 + .5, texture2D(pjDepth, puv).r + .0028);                               /* surface cachée au départ : pas d'image */
          outgoingLight = mix(outgoingLight, texture2D(pjMap, puv).rgb, m * pjK); }
        #include <opaque_fragment>`); };
    m.customProgramCacheKey = () => 'pj'; return m; };
  const snapDepth = () => { const vis = projHide.map(o => o.visible), d = PJ.depth.value; projHide.forEach(o => o.visible = false); PJ.depth.value = null;      /* la carte ne doit pas être lue pendant qu'on l'écrit */
    const rt0 = renderer.getRenderTarget(); renderer.setRenderTarget(pjRT); renderer.clear(); renderer.render(scene, PJ.cam); renderer.setRenderTarget(rt0);
    projHide.forEach((o, i) => o.visible = vis[i]); PJ.depth.value = pjRT.depthTexture; opt.wake && opt.wake(600); };
  const ROOMDRAW = [];
  const roomAtlas = ctex(640, 192, (g, W, H) => { ROOMDRAW.forEach((d, i) => { g.save(); g.translate(i * 128, 0); g.beginPath(); g.rect(0, 0, 128, H); g.clip(); d(g, 128, H); g.restore(); }); });
  /* photos de façades avec relief : chaque photo a sa carte de profondeur (murs en avant, vitrages en retrait). Le rendu décale l'image
     selon l'angle de vue (parallaxe par pas), si bien que les fenêtres glissent derrière les murs quand la caméra bouge. [largeur, hauteur, profondeur en m] */
  const FAC = { A: [28, 36.4, .13], B: [28, 40.2, .07], C: [42, 64.8, .05], D: [36, 25.6, .09], E: [32, 31.3, .15] };      /* relief volontairement léger : au-delà, les bords se déforment en vue rasante */
  const facadeMat = k => { const f = FAC[k], ld = (s, srgb) => { const t = loader.load(EXT + 'fac_' + k + s + '.webp?h=2'); t.flipY = false; t.anisotropy = AN; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { map: { value: ld('', true) }, hmap: { value: ld('_h') }, dScale: { value: new THREE.Vector2(f[2] / f[0], f[2] / f[1]) } },
      vertexShader: `varying vec2 vUv; varying vec3 vV;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vec3 N = normalize(mat3(modelMatrix) * normal), T = normalize(cross(vec3(0., 1., 0.), N)), V = cameraPosition - wp.xyz;
          vV = vec3(dot(V, T), V.y, dot(V, N)); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform sampler2D map, hmap; uniform vec2 dScale; varying vec2 vUv; varying vec3 vV;
        void main(){ vec3 v = normalize(vV); vec2 shift = -v.xy / max(abs(v.z), .6) * dScale * vec2(1., -1.);      /* v inversé : l'image suit la convention glTF */
          const int N = 32; float layer = 1. / float(N), d = 0.; vec2 uv = vUv, st = shift / float(N); float h = 1. - texture2D(hmap, uv).r;
          for (int i = 0; i < N; i++){ if (d >= h) break; uv += st; d += layer; h = 1. - texture2D(hmap, uv).r; }
          vec2 pu = uv - st; float a = h - d, b = (1. - texture2D(hmap, pu).r) - d + layer; uv = mix(uv, pu, clamp(a / (a - b), 0., 1.));      /* affinage entre les deux derniers pas */
          uv = clamp(uv, vec2(.001), vec2(.999)); vec3 c = texture2D(map, uv).rgb; float hh = texture2D(hmap, uv).r;
          float edge = clamp((texture2D(hmap, uv - st * 3.).r - hh) * 1.6, 0., 1.);                                                      /* ombre portée du mur sur le vitrage */
          c *= mix(.8, 1., hh) * (1. - edge * .3);
          gl_FragColor = vec4(c, 1.);
          #include <colorspace_fragment>
        }` }); };
  new opt.GLTFLoader(mgr).load('store-assets/exterior.glb' + V, gl => {
    gl.scene.traverse(o => { if (!o.isMesh) return; const n = o.material.name, grp = LM[o.name] ? o.name : o.parent && LM[o.parent.name] ? o.parent.name : null;
      if (n === 'led') o.material = led; else if (n === 'ledfin') o.material = basic({ color: 0xdfe8ff }); else if (n === 'lamp') o.material = basic({ color: 0xffe2b8 });
      else if (n.startsWith('fac_')){ const t = loader.load(EXT + n + '.webp'); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = AN; o.material = project(basic({ map: t, side: THREE.DoubleSide })); }      /* photo à plat (le relief par parallaxe, facadeMat, a été refusé : déformations) */
      else if (n === 'pane_lit') o.material = basic({ map: roomAtlas });
      else if (n === 'pane_dark') o.material = std({ color: 0x05070c, roughness: .08, metalness: 1, envMapIntensity: .55 });
      else if (n === 'rail') o.material = std({ color: 0x0b0d12, roughness: .1, metalness: 1, envMapIntensity: .5, transparent: true, opacity: .55 });
      else if (grp) o.material = matFor(n, grp); });
    G.add(gl.scene); opt.wake && opt.wake(1500); [300, 2500, 7000].forEach(t => setTimeout(snapDepth, t));
  });
  { const y = decal(basic({ color: 0x6f5a14 })); [-1, 1].forEach(s => [0, .36].forEach(o => flat(new THREE.PlaneGeometry(60, .15), y, s * 33.4, YR + .004, SW + 11 + o))); }      /* doubles lignes jaunes */

  /* --- ce qui reste posé par la page : verre, reflets, logos, portants de présentation, porte coulissante, halos --- */
  const logoT = loader.load('store-assets/logo.png'); logoT.colorSpace = THREE.SRGBColorSpace; logoT.anisotropy = AN;
  const decor = ['tee-shirt-blanco-nemesis-noir', 'tee-trust', 'tee-shirt-ride', 'tee-worldwide', 'tee-shirt-blanco-nemesis-blanc', 'tee-florida'].map(n => { const t = loader.load('store-assets/decor-' + n + '.webp'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = AN; return t; });
  const glass = basic({ color: 0xa9bdd6, transparent: true, opacity: .055, side: THREE.DoubleSide, depthWrite: false });
  const sheenT = ctex(1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h);
      for (let i = 0; i < 16; i++){ const x = rnd() * w, ww = 14 + rnd() * 50, gr = g.createLinearGradient(x, 0, x + ww, 0); gr.addColorStop(0, 'rgba(190,210,255,0)'); gr.addColorStop(.5, `rgba(200,218,255,${.08 + rnd() * .13})`); gr.addColorStop(1, 'rgba(190,210,255,0)');
        g.save(); g.transform(1, 0, -.35, 1, 0, 0); g.fillStyle = gr; g.fillRect(x, 0, ww, h); g.restore(); } });
  const sheen = basic({ map: sheenT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: .5 });
  const RB = R + .14;
  [135, 225].forEach(a => {
    onF(new THREE.PlaneGeometry(FWd - .36, H1), glass, a, RE, H1 / 2); projHide.push(onF(new THREE.PlaneGeometry(FWd - .36, H1), sheen, a, RE + .004, H1 / 2));
    projHide.push(onF(new THREE.PlaneGeometry(2.6, 2.6 * 279 / 939), basic({ map: logoT, transparent: true }), a, RB + .02, 3.25));
    const k0 = a === 135 ? 0 : 3;
    { const m = onF(new THREE.CylinderGeometry(.014, .014, 3.9, 10), steel, a, RB + .42, 2.3); m.rotation.z = Math.PI / 2; projHide.push(m); }
    [-1.95, 1.95].forEach(u => { projHide.push(onF(new THREE.CylinderGeometry(.014, .014, 2.3, 10), steel, a, RB + .42, 1.15, u), onF(new THREE.BoxGeometry(.03, .03, .5), steel, a, RB + .42, .02, u)); });
    for (let i = 0; i < 5; i++) projHide.push(onF(new THREE.PlaneGeometry(.86, .97), basic({ map: decor[(i + k0) % decor.length], transparent: true, alphaTest: .1, side: THREE.DoubleSide }), a, RB + .42 + (i % 2) * .01, 2.3 - .5, -1.56 + i * .78));
  });
  [[-OW - .02, openH / 2, .03, openH], [OW + .02, openH / 2, .03, openH], [0, openH + .02, OW * 2 + .07, .03]].forEach(([x, y, w, h]) => box(w, h, .02, led, x, y, ZF + .012));      /* cadre lumineux de la porte */
  const leafW = OW - .02, leaves = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * leafW / 2, openH / 2, ZF - .05); G.add(g);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(leafW, openH - .04), glass));
    [[0, openH / 2 - .045, leafW, .05], [0, -openH / 2 + .045, leafW, .05], [-leafW / 2 + .025, 0, .05, openH - .04], [leafW / 2 - .025, 0, .05, openH - .04]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), steel); b.position.set(x, y, 0); g.add(b); });
    const hd = new THREE.Mesh(new THREE.BoxGeometry(.025, .9, .05), std({ color: 0xb9bcc2, roughness: .25, metalness: 1 })); hd.position.set(-s * (leafW / 2 - .12), 0, .04); g.add(hd);
    g.userData = { s, x0: s * leafW / 2 }; return g; });
  glowM.opacity = .45; projHide.push(prism(RE + .52, H1 - .35, H1 + .42, glowM), prism(RE + .77, H3 - .35, H3 + .4, glowM));                                                 /* halo des deux rubans lumineux */

  /* --- enseigne ENTER --- */
  const enterM = basic({ map: ctex(1024, 220, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'italic 900 190px "Helvetica Neue",Helvetica,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.transform(1.25, 0, 0, 1, -w * .125, 0); g.fillText('ENTER', w / 2, h / 2 + 8); }),
    transparent: true, depthWrite: false });
  add(new THREE.PlaneGeometry(3.3, .71), enterM, 0, 3.55, ZF + 1.1).visible = false;      /* enseigne ENTER retirée (24/11/2026) : elle sera remplacée par autre chose */

  /* --- ciel de fin de journée (dôme) --- */
  { const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), basic({ side: THREE.BackSide, depthWrite: false, map: ctex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#04060e'); gr.addColorStop(.36, '#0a1126'); gr.addColorStop(.47, '#1d2542'); gr.addColorStop(.5, '#3a3048'); gr.addColorStop(.51, '#0a0c14'); gr.addColorStop(1, '#05060a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) })); sky.renderOrder = -10; G.add(sky); }

  /* --- pièces allumées derrière les fenêtres des immeubles : 5 dessins rangés dans un atlas (les vitres viennent du modèle) --- */
  const roomD = (kind, hue) => (g, w, h) => {
    if (kind === 'office'){ g.fillStyle = '#c9d6e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f8ff'; for (let x = 10; x < w; x += 40) g.fillRect(x, 10, 26, 7);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(40,50,70,.55)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(30,36,48,.75)'; for (let x = 6; x < w; x += 44){ g.fillRect(x, h - 52, 30, 52); g.fillRect(x + 8, h - 74, 14, 22); } }
    else { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, hue[0]); gr.addColorStop(1, hue[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const lamp = g.createRadialGradient(w * .68, h * .38, 2, w * .68, h * .38, 46); lamp.addColorStop(0, 'rgba(255,246,214,.95)'); lamp.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lamp; g.fillRect(0, 0, w, h);
      if (kind === 'blind'){ g.fillStyle = 'rgba(60,44,24,.33)'; for (let y = 4; y < h * .7; y += 9) g.fillRect(0, y, w, 4); }
      else { const c = g.createLinearGradient(0, 0, 26, 0); c.addColorStop(0, 'rgba(70,52,34,.75)'); c.addColorStop(.5, 'rgba(120,96,66,.55)'); c.addColorStop(1, 'rgba(70,52,34,.75)'); g.fillStyle = c; g.fillRect(0, 0, 26, h); g.save(); g.translate(w - 26, 0); g.fillRect(0, 0, 26, h); g.restore(); }
      g.fillStyle = 'rgba(30,22,14,.6)'; g.fillRect(w * .18, h - 44, w * .4, 44); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, 6); };
  ROOMDRAW.push(roomD('curtain', ['#f3d9a2', '#b98a4c']), roomD('blind', ['#f7e3b6', '#c59a5a']), roomD('curtain', ['#e9e2d4', '#9c8f7c']), roomD('office'), roomD('curtain', ['#b9c6e6', '#5a6688']));
  { const c = roomAtlas.image, g = c.getContext('2d'); ROOMDRAW.forEach((d, i) => { g.save(); g.translate(i * 128, 0); g.beginPath(); g.rect(0, 0, 128, c.height); g.clip(); d(g, 128, c.height); g.restore(); }); } roomAtlas.needsUpdate = true;
  const spr = (x, y, z, s, col, o = 1, par = G) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: spot, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: o })); m.position.set(x, y, z); m.scale.setScalar(s); par.add(m); return m; };
  lamps.forEach(([x, z]) => spr(x, 6.25, z + 2.3, 2.6, 0xffd9a8, .9));

  /* --- voitures : deux 4x4 noirs à carrosserie cubique (silhouette de tout-terrain de luxe), sans aucun logo.
         Peinture vernie et vitrages reflètent la vraie rue : on photographie le décor en 360° depuis l'emplacement des voitures
         (CubeCamera) et cette image sert de reflet — rubans lumineux, vitrines, fenêtres des immeubles, lampadaires. --- */
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x020203, metalness: .9, roughness: .14, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 9 });
  const glassC = new THREE.MeshPhysicalMaterial({ color: 0x010102, metalness: 1, roughness: .02, envMapIntensity: 10 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: .55, metalness: .3, envMapIntensity: 1.2 });            /* plastiques noirs : ailes, pare-chocs, baguettes */
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: .12, metalness: 1, envMapIntensity: 3 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: .9, envMapIntensity: .4 }), rimM = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: .22, metalness: 1, envMapIntensity: 3 });
  const carMats = [paint, glassC, trim, chrome, tyre, rimM], RB_ = opt.RoundedBoxGeometry;
  const rbox = (w, h, d, r, mat, x, y, z, par, ry = 0) => { const m = new THREE.Mesh(new RB_(w, h, d, 4, r), mat); m.position.set(x, y, z); m.rotation.y = ry; par.add(m); return m; };
  const cars = [];
  const car = (x, z, ry) => { const C = new THREE.Group(); C.position.set(x, YR, z); C.rotation.y = ry; G.add(C); cars.push(C);
    /* caisse : bas de caisse, ceinture, capot plat, pavillon droit */
    rbox(4.62, .86, 1.84, .07, paint, 0, .86, 0, C);                                         /* caisse (0,43 → 1,29 m) */
    rbox(2.86, .70, 1.72, .06, paint, -.84, 1.60, 0, C);                                     /* habitacle (1,25 → 1,95 m) */
    rbox(1.62, .07, 1.5, .03, paint, 1.42, 1.31, 0, C);                                      /* bossage de capot */
    rbox(2.6, .04, 1.5, .02, trim, -.84, 1.965, 0, C);                                       /* toit */
    [-1, 1].forEach(s => { rbox(2.5, .03, .05, .012, chrome, -.84, 2.0, s * .74, C);         /* barres de toit */
      /* vitrages latéraux : trois vitres par côté, montants peints entre elles */
      [[.12, .82], [-.82, .9], [-1.78, .78]].forEach(([u, w]) => rbox(w, .46, .02, .008, glassC, u, 1.62, s * .868, C));
      rbox(4.1, .07, .03, .012, trim, -.1, .98, s * .93, C);                                 /* baguette de protection */
      rbox(2.3, .05, .22, .02, trim, -.1, .44, s * .94, C);                                  /* marchepied */
      [.42, -.5].forEach(u => rbox(.16, .03, .03, .01, chrome, u, 1.2, s * .93, C));         /* poignées */
      rbox(.1, .16, .22, .03, paint, .62, 1.42, s * 1.02, C); rbox(.02, .12, .17, .008, glassC, .57, 1.42, s * 1.02, C);      /* rétroviseur */
      rbox(.16, .05, .09, .02, basic({ color: 0xffb04a }), 1.86, 1.335, s * .8, C);          /* clignotant posé sur l'aile */
    });
    rbox(.02, .5, 1.5, .008, glassC, .605, 1.62, 0, C).rotation.z = -.2;                     /* pare-brise, presque vertical */
    rbox(.02, .44, 1.4, .008, glassC, -2.28, 1.64, 0, C);                                    /* lunette arrière */
    /* face avant : calandre à trois lames (sans emblème), phares ronds à anneau lumineux, pare-chocs */
    rbox(.05, .44, .92, .02, trim, 2.315, 1.0, 0, C); [1.12, 1.0, .88].forEach(y => rbox(.03, .045, .84, .01, chrome, 2.345, y, 0, C));
    [-1, 1].forEach(s => { const o = new THREE.Group(); o.position.set(2.32, 1.02, s * .69); o.rotation.y = Math.PI / 2; C.add(o);
      o.add(new THREE.Mesh(new THREE.CylinderGeometry(.135, .135, .06, 32).rotateX(Math.PI / 2), trim));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.105, 32), glassC); lens.position.z = .032; o.add(lens);
      const ringL = new THREE.Mesh(new THREE.TorusGeometry(.112, .012, 8, 40), led); ringL.position.z = .034; o.add(ringL);
      const core = new THREE.Mesh(new THREE.CircleGeometry(.04, 20), led); core.position.z = .036; o.add(core);
      spr(2.4, 1.02, s * .69, .6, 0xdfe8ff, .55, C); });
    rbox(.2, .3, 1.94, .05, trim, 2.32, .58, 0, C); rbox(.06, .12, 1.1, .02, chrome, 2.42, .47, 0, C); rbox(.02, .11, .46, .008, basic({ color: 0xd8d8d2 }), 2.435, .62, 0, C);      /* pare-chocs, sabot, plaque */
    rbox(.2, .3, 1.94, .05, trim, -2.32, .58, 0, C);
    const sw = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .22, 32).rotateZ(Math.PI / 2), paint); sw.position.set(-2.42, 1.08, 0); C.add(sw);      /* roue de secours sous housse */
    /* roues : pneu, jante à cinq doubles branches, élargisseur d'aile */
    [[1.445, 1], [1.445, -1], [-1.445, 1], [-1.445, -1]].forEach(([u, s]) => { const W = new THREE.Group(); W.position.set(u, .4, s * .82); C.add(W);
      W.add(new THREE.Mesh(new THREE.TorusGeometry(.305, .1, 14, 40), tyre)); W.add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .24, 32).rotateX(Math.PI / 2), tyre));
      const face = s * .125; const disc = new THREE.Mesh(new THREE.CylinderGeometry(.215, .215, .02, 32).rotateX(Math.PI / 2), trim); disc.position.z = face * .6; W.add(disc);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(.225, .016, 8, 40), rimM); lip.position.z = face; W.add(lip);
      for (let k = 0; k < 5; k++) [-.09, .09].forEach(o => { const sp = new THREE.Mesh(new THREE.BoxGeometry(.2, .022, .02), rimM); const a = k * Math.PI * 2 / 5 + o; sp.position.set(Math.cos(a) * .12, Math.sin(a) * .12, face); sp.rotation.z = a; W.add(sp); });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .03, 20).rotateX(Math.PI / 2), rimM); hub.position.z = face; W.add(hub);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(.5, .075, 8, 28, Math.PI), trim); arch.position.set(u, .42, s * .9); arch.scale.z = 1.6; C.add(arch); });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.2), basic({ map: spot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .06, color: 0xcfdcff })); beam.rotation.x = -Math.PI / 2; beam.position.set(5, .012, 0); C.add(beam);
    return C; };
  /* 4x4 retirés à la demande (24/11/2026). Pour les remettre : car(-6.0, SW + 4.3, -1.02); car(6.2, SW + 3.9, -2.12); */
  /* reflets : image à 360° de la rue, prise depuis les voitures (elles sont masquées pendant la prise) */
  const cubeRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType }), cubeCam = new THREE.CubeCamera(.5, 300, cubeRT), pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null; const snapEnv = () => { cars.forEach(c => c.visible = false); cubeCam.position.set(0, 1.3, SW + 4.2); cubeCam.update(renderer, scene); cars.forEach(c => c.visible = true);
    const n = pmrem.fromCubemap(cubeRT.texture); carMats.forEach(m => { m.envMap = n.texture; m.needsUpdate = true; }); if (envRT) envRT.dispose(); envRT = n; opt.wake && opt.wake(400); };
  if (cars.length) [1200, 4000, 9000].forEach(t => setTimeout(snapEnv, t));

  return {
    group: G, foot,
    /* point de départ : vue rapprochée, à hauteur d'œil, la porte au centre et les deux vitrines de part et d'autre (≈ 15 m de large visibles sur ordinateur) */
    /* sur écran plus large que 16:9, la caméra se rapproche pour garder la même largeur de rue que l'image d'ouverture */
    viewZ: (tv, aspect) => ZF + (aspect > 16 / 9 ? 12.5 * (16 / 9) / aspect : Math.max(12.5, 4.7 / (tv * aspect))), ZF,
    /* active la projection (écrans paysage) : les éléments que l'image contient déjà sont alors masqués */
    hideForShot(){ projHide.forEach(o => { if (o.material === sheen || o.material === glowM) o.visible = false; }); },
    setProj(on){ const k = on ? 1 : 0; if (k === PJ.k.value) return; PJ.k.value = k; projHide.forEach(o => o.visible = !on); },
    update(p, camZ){
      /* l'extérieur reste affiché une fois dedans : on voit la rue par la porte vitrée. Les portes se referment derrière soi. */
      const a = sstep(ZF + 7.5, ZF + 3, camZ) * sstep(2.4, 3.6, camZ);
      leaves.forEach(g => { g.position.x = g.userData.x0 + g.userData.s * a * (leafW + .06); });
      enterM.opacity = Math.min(1, Math.max(0, (p - .45) / .3));
    }
  };
}
