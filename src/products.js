import * as THREE from "three";
import doorFaceImage from "../img/door-face.webp";

const frameMat = new THREE.MeshStandardMaterial({
  color: 0x232327,
  metalness: 0.92,
  roughness: 0.3,
});
const panelMat = new THREE.MeshStandardMaterial({
  color: 0x2e2e33,
  metalness: 0.85,
  roughness: 0.36,
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xfcfcfa,
  metalness: 0,
  roughness: 0.04,
  transmission: 0.96,
  thickness: 0.02,
  envMapIntensity: 1.5,
});
const handleMat = new THREE.MeshStandardMaterial({
  color: 0xc4c4be,
  metalness: 1.0,
  roughness: 0.18,
});

function group() {
  return new THREE.Group();
}

function addImagePanel(g, imageUrl) {
  const tex = new THREE.TextureLoader().load(imageUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const imageWidth = 0.72;
  const imageHeight = 2.03;

  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(imageWidth, imageHeight),
    new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  image.position.set(0, 1.07, 0.012);
  image.receiveShadow = true;
  g.add(image);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(imageWidth + 0.08, imageHeight + 0.08, 0.012),
    new THREE.MeshStandardMaterial({
      color: 0xf3f0e8,
      metalness: 0.04,
      roughness: 0.78,
    }),
  );
  frame.position.set(0, 1.07, 0.018);
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  const reveal = new THREE.Mesh(
    new THREE.BoxGeometry(imageWidth + 0.12, imageHeight + 0.12, 0.016),
    new THREE.MeshStandardMaterial({
      color: 0x121214,
      metalness: 0.04,
      roughness: 0.95,
    }),
  );
  reveal.position.set(0, 1.07, -0.002);
  reveal.receiveShadow = true;
  g.add(reveal);

  return image;
}

function bar(g, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

// Door face texture is precomputed offline (img/door-face.webp):
// already cropped to the alpha bbox, with the gold ornament laser-cut
// out of the alpha channel and edges feathered for clean mipmaps.
function loadDoorFace(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        const img = tex.image;
        resolve({ faceTex: tex, aspect: img.width / img.height });
      },
      undefined,
      reject,
    );
  });
}

function buildPlasmaDoor() {
  const g = group();
  const H = 1.98;
  const coreDepth = 0.04;

  // tones sampled from img/door-real/* (gold avg ~#a0874a; warm-ivory paint)
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xece8dc,
    metalness: 0.05,
    roughness: 0.6,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x241c12,
    metalness: 0.2,
    roughness: 0.8,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xf3efe5,
    roughness: 0.6,
    metalness: 0.06,
    alphaTest: 0.5,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xf3efe5,
    roughness: 0.6,
    metalness: 0.06,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xa0874a,
    metalness: 1,
    roughness: 0.32,
    envMapIntensity: 1.3,
  });
  const frameWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xece8dc,
    metalness: 0.05,
    roughness: 0.6,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xcfcfca,
    metalness: 1,
    roughness: 0.45,
    envMapIntensity: 1.1,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xa0874a,
    metalness: 1,
    roughness: 0.32,
    envMapIntensity: 1.3,
  });

  loadDoorFace(doorFaceImage)
    .then(({ faceTex, aspect }) => {
      const W = H * aspect;
      faceMat.map = faceTex;
      faceMat.needsUpdate = true;

      // leaf core
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(W, H, coreDepth),
        [edgeMat, edgeMat, edgeMat, edgeMat, coreMat, coreMat],
      );
      core.position.set(0, H / 2, 0);
      core.castShadow = true;
      core.receiveShadow = true;
      g.add(core);

      // front: laser-cut white steel with the gold mirror backing recessed behind
      {
        const gold = new THREE.Mesh(new THREE.PlaneGeometry(W, H), goldMat);
        gold.position.set(0, H / 2, coreDepth / 2 + 0.0015);
        g.add(gold);

        const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat);
        face.position.set(0, H / 2, coreDepth / 2 + 0.005);
        face.castShadow = true;
        g.add(face);
      }
      // back: plain white interior face, no ornament — only the handle shows
      {
        const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), backMat);
        back.position.set(0, H / 2, -(coreDepth / 2 + 0.005));
        back.rotation.y = Math.PI;
        back.castShadow = true;
        g.add(back);
      }

      // white perimeter frame, like the real door set
      const jambW = 0.055,
        gap = 0.008,
        jambD = 0.09;
      const sideH = H + gap + jambW;
      for (const sign of [1, -1]) {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(jambW, sideH, jambD),
          frameWhiteMat,
        );
        jamb.position.set(sign * (W / 2 + gap + jambW / 2), sideH / 2, 0);
        jamb.castShadow = true;
        jamb.receiveShadow = true;
        g.add(jamb);
      }
      const topJamb = new THREE.Mesh(
        new THREE.BoxGeometry(W + 2 * (gap + jambW), jambW, jambD),
        frameWhiteMat,
      );
      topJamb.position.set(0, H + gap + jambW / 2, 0);
      topJamb.castShadow = true;
      topJamb.receiveShadow = true;
      g.add(topJamb);

      // brass barrel hinges on the right edge
      for (const hy of [1.85, 1.25, 0.38]) {
        const hinge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.013, 0.13, 14),
          brassMat,
        );
        hinge.position.set(W / 2 + gap + 0.006, hy, 0);
        hinge.castShadow = true;
        g.add(hinge);
      }

      // brushed-steel pull handle on both faces (the back is the inside face)
      for (const zSide of [1, -1]) {
        const handle = new THREE.Group();
        const grip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.01, 0.66, 20),
          chromeMat,
        );
        grip.position.set(0, 0, 0.05 * zSide);
        handle.add(grip);
        for (const my of [-0.27, 0.27]) {
          const mount = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.05, 12),
            chromeMat,
          );
          mount.rotation.x = Math.PI / 2;
          mount.position.set(0, my, 0.025 * zSide);
          handle.add(mount);
        }
        handle.position.set(-0.305, 0.99, (coreDepth / 2 + 0.005) * zSide);
        handle.traverse((o) => {
          o.castShadow = true;
        });
        g.add(handle);
      }

      // brass lock cylinders
      for (const ky of [1.41, 0.6]) {
        const knob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.014, 0.022, 16),
          brassMat,
        );
        knob.rotation.x = Math.PI / 2;
        knob.position.set(-0.343, ky, coreDepth / 2 + 0.012);
        g.add(knob);
      }
    })
    .catch(() => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.98), faceMat);
      panel.position.set(0, 0.99, 0);
      g.add(panel);
    });

  return g;
}

function glassPanel(g, w, h, x, y, z, opts = {}) {
  const th = opts.th ?? 0.05;
  const depth = opts.depth ?? 0.05;
  const frame = opts.frame ?? frameMat;
  const glass = opts.glass ?? glassMat;
  const hw = w / 2;
  const hh = h / 2;
  bar(g, w, th, depth, frame, x, y + hh - th / 2, z);
  bar(g, w, th, depth, frame, x, y - hh + th / 2, z);
  bar(g, th, h - th * 2, depth, frame, x - hw + th / 2, y, z);
  bar(g, th, h - th * 2, depth, frame, x + hw - th / 2, y, z);
  bar(g, w - th * 2, h - th * 2, depth - 0.03, glass, x, y, z);
  return g;
}

export function buildMono() {
  const g = group();
  const W = 0.92;
  const H = 2.1;
  const J = 0.08;
  const D = 0.14;
  bar(g, J, H, D, frameMat, -(W - J) / 2, H / 2, 0);
  bar(g, J, H, D, frameMat, (W - J) / 2, H / 2, 0);
  bar(g, W, J, D, frameMat, 0, H - J / 2, 0);

  const lh = H - J - 0.02;
  const yc = lh / 2;
  const lw = W - 2 * J - 0.01;
  bar(g, lw, lh, 0.05, panelMat, 0, yc, 0);
  bar(g, 0.36, 0.42, 0.02, glassMat, 0, 1.55, 0.032);
  bar(g, lw, 0.22, 0.02, handleMat, 0, 0.11, 0.036);

  bar(g, 0.26, 0.04, 0.04, handleMat, 0.3, 1.1, 0.045);
  bar(g, 0.04, 0.04, 0.05, handleMat, 0.3, 1.1, 0.08);

  bar(g, 0.03, 0.09, 0.06, frameMat, -(W - J) / 2 - 0.02, 0.55, 0);
  bar(g, 0.03, 0.09, 0.06, frameMat, -(W - J) / 2 - 0.02, 1.45, 0);
  return g;
}

export function buildTwin() {
  const g = group();
  const W = 1.56;
  const H = 2.1;
  const J = 0.08;
  const D = 0.14;
  bar(g, J, H, D, frameMat, -(W - J) / 2, H / 2, 0);
  bar(g, J, H, D, frameMat, (W - J) / 2, H / 2, 0);
  bar(g, W, J, D, frameMat, 0, H - J / 2, 0);

  const lh = H - J - 0.02;
  const yc = lh / 2;
  const lw = (W - 2 * J - 0.01) / 2;
  const lc = lw / 2 + 0.005;

  bar(g, lw, lh, 0.05, panelMat, -lc, yc, 0);
  bar(g, lw, lh, 0.05, panelMat, lc, yc, 0);
  bar(g, 0.3, 0.4, 0.02, glassMat, -lc, 1.5, 0.032);
  bar(g, 0.3, 0.4, 0.02, glassMat, lc, 1.5, 0.032);
  bar(g, lw - 0.14, 0.05, 0.06, handleMat, -lc, 1.06, 0.048);
  bar(g, lw - 0.14, 0.05, 0.06, handleMat, lc, 1.06, 0.048);
  bar(g, lw, 0.2, 0.02, handleMat, -lc, 0.1, 0.036);
  bar(g, lw, 0.2, 0.02, handleMat, lc, 0.1, 0.036);

  bar(g, 0.03, 0.09, 0.06, frameMat, -(W - J) / 2 - 0.02, 0.55, 0);
  bar(g, 0.03, 0.09, 0.06, frameMat, -(W - J) / 2 - 0.02, 1.45, 0);
  bar(g, 0.03, 0.09, 0.06, frameMat, (W - J) / 2 + 0.02, 0.55, 0);
  bar(g, 0.03, 0.09, 0.06, frameMat, (W - J) / 2 + 0.02, 1.45, 0);
  return g;
}

export function buildSlido() {
  const g = group();
  const W = 1.5;
  const H = 2.1;
  const tw = 0.09;
  bar(g, W, tw, 0.07, frameMat, 0, H - tw / 2, 0);
  bar(g, W, 0.05, 0.07, frameMat, 0, 0.025, 0);

  const ph = H - 0.18;
  const py = 0.09 + ph / 2;
  const pw = 0.7;
  glassPanel(g, pw, ph, -(W - pw) / 2, py, -0.03, { frame: panelMat });
  glassPanel(g, pw, ph, (W - pw) / 2, py, 0.03, { frame: frameMat });

  bar(g, 0.28, 0.04, 0.04, handleMat, (W - pw) / 2 - pw / 2 + 0.1, 1.15, 0.06);
  return g;
}

export function buildCube() {
  const g = group();
  const W = 1.3;
  const H = 1.3;
  const cy = 0.95;
  const J = 0.07;
  bar(g, J, H, 0.1, frameMat, -(W - J) / 2, cy, 0);
  bar(g, J, H, 0.1, frameMat, (W - J) / 2, cy, 0);
  bar(g, W, J, 0.1, frameMat, 0, cy + H / 2 - J / 2, 0);
  bar(g, W + 0.05, 0.05, 0.13, frameMat, 0, cy - H / 2 - 0.02, 0);

  bar(g, 0.05, H, 0.1, frameMat, 0, cy, 0);
  bar(g, W - 2 * J, 0.05, 0.1, frameMat, 0, cy, 0);

  const pw = (W - 2 * J - 0.05) / 2;
  const ph = (H - 0.05) / 2;
  const px = [-(pw / 2 + 0.025), pw / 2 + 0.025];
  const pyy = [cy + 0.025 + ph / 2, cy - 0.025 - ph / 2];
  for (const x of px) {
    for (const y of pyy) {
      bar(g, pw, ph, 0.02, glassMat, x, y, 0);
    }
  }

  bar(g, 0.22, 0.035, 0.035, handleMat, 0, cy + 0.3, 0.07);
  return g;
}

export function buildVista() {
  const g = group();
  const W = 2.1;
  const H = 1.5;
  const cy = 1.05;
  const J = 0.05;
  bar(g, J, H, 0.08, frameMat, -(W - J) / 2, cy, 0);
  bar(g, J, H, 0.08, frameMat, (W - J) / 2, cy, 0);
  bar(g, W, J, 0.08, frameMat, 0, cy + H / 2 - J / 2, 0);
  bar(g, W, 0.05, 0.12, frameMat, 0, cy - H / 2 + 0.02, 0);

  bar(g, 0.018, H, 0.05, frameMat, -W / 4, cy, 0);
  bar(g, 0.018, H, 0.05, frameMat, W / 4, cy, 0);
  bar(g, W - 2 * J, H - 2 * J, 0.02, glassMat, 0, cy, 0);
  return g;
}

export function buildStore() {
  const g = group();
  const W = 2.1;
  const H = 2.35;
  const J = 0.07;
  const kick = 0.45;
  const m = 0.05;
  const gH = H - J - kick;
  const gzY = kick + gH / 2;

  bar(g, J, H, 0.12, frameMat, -(W - J) / 2, H / 2, 0);
  bar(g, J, H, 0.12, frameMat, (W - J) / 2, H / 2, 0);
  bar(g, W, J, 0.12, frameMat, 0, H - J / 2, 0);
  bar(g, W - 2 * J, kick, 0.06, panelMat, 0, kick / 2, 0);

  bar(g, 0.405, gH, 0.02, glassMat, -0.7775, gzY, 0);
  bar(g, 0.45, gH, 0.02, glassMat, -0.3, gzY, 0);
  bar(g, m, gH, 0.1, frameMat, -0.55, gzY, 0);
  bar(g, m, gH, 0.1, frameMat, -0.05, gzY, 0);

  const dc = 0.475;
  const dw = 1.0;
  const dh = gH;
  const s = 0.06;
  bar(g, s, dh, 0.06, frameMat, dc - dw / 2 + s / 2, gzY, 0);
  bar(g, s, dh, 0.06, frameMat, dc + dw / 2 - s / 2, gzY, 0);
  bar(g, dw, s, 0.06, frameMat, dc, gzY + dh / 2 - s / 2, 0);
  bar(g, dw, s, 0.06, frameMat, dc, gzY - dh / 2 + s / 2, 0);
  bar(g, dw - 2 * s, dh - 2 * s, 0.02, glassMat, dc, gzY, 0);

  bar(g, 0.035, 0.95, 0.04, handleMat, dc + dw / 2 - 0.045, gzY, 0.05);
  return g;
}

export const PRODUCTS = [
  {
    key: "photo",
    name: "PHOTO",
    tagline: "Facade reference panel · cropped image",
    build: buildPlasmaDoor,
    icon: "vista",
    dims: [
      ["Width", "1040"],
      ["Height", "2100"],
      ["Depth", "60"],
    ],
    finish: "Photo reference · recessed presentation",
    desc: "A lightweight image-based product built from the attached door.png reference, cropped to its visible content and set in a recessed architectural frame.",
  },
  {
    key: "mono",
    name: "MONO",
    tagline: "Single-leaf swing door",
    build: buildMono,
    icon: "door",
    dims: [
      ["Width", "900"],
      ["Height", "2100"],
      ["Depth", "60"],
    ],
    finish: "Anthracite steel · satin",
    desc: "One clean steel leaf with a floating vision slot and a solid kick plate — the quiet baseline of the range.",
  },
  {
    key: "twin",
    name: "TWIN",
    tagline: "Double-leaf entrance",
    build: buildTwin,
    icon: "twin",
    dims: [
      ["Width", "1500"],
      ["Height", "2100"],
      ["Depth", "60"],
    ],
    finish: "Anthracite steel · satin",
    desc: "Two balanced leaves with full-width push bars. Built for commercial thresholds and heavy traffic.",
  },
  {
    key: "slido",
    name: "SLIDO",
    tagline: "Sliding glass door",
    build: buildSlido,
    icon: "slido",
    dims: [
      ["Width", "1500"],
      ["Height", "2100"],
      ["Depth", "70"],
    ],
    finish: "Anthracite steel · clear glass",
    desc: "A fixed pane and a soft-gliding panel on a concealed top track. Indoors, it disappears.",
  },
  {
    key: "cube",
    name: "CUBE",
    tagline: "Casement window · 2×2 grid",
    build: buildCube,
    icon: "cube",
    dims: [
      ["Width", "1300"],
      ["Height", "1300"],
      ["Depth", "100"],
    ],
    finish: "Anthracite steel · double glass",
    desc: "Square casement with a fine 2×2 grid, insulated glazing and a slim lever handle at the mullion.",
  },
  {
    key: "vista",
    name: "VISTA",
    tagline: "Fixed panorama window",
    build: buildVista,
    icon: "vista",
    dims: [
      ["Width", "2100"],
      ["Height", "1500"],
      ["Depth", "80"],
    ],
    finish: "Anthracite steel · clear glass",
    desc: "One uninterrupted sheet of glass held by a pencil-thin frame. For walls you want to see through.",
  },
  {
    key: "store",
    name: "STORE",
    tagline: "Storefront glazing wall",
    build: buildStore,
    icon: "store",
    dims: [
      ["Width", "2100"],
      ["Height", "2350"],
      ["Depth", "120"],
    ],
    finish: "Anthracite steel · clear glass",
    desc: "Full-height shopfront with a steel kick panel, slim mullions and an integrated glass door.",
  },
];
