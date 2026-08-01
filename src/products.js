import * as THREE from "three";
import doorImage from "../img/door.png";

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

function addExtrudedShape(
  g,
  shape,
  depth,
  mat,
  x,
  y,
  z,
  ry = 0,
  sx = 1,
  sy = 1,
) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    curveSegments: 18,
  });
  geometry.center();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.scale.set(sx, sy, 1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function rectShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return s;
}

function diamondHole(cx, cy, w, h) {
  const s = new THREE.Shape();
  s.moveTo(cx, cy + h / 2);
  s.lineTo(cx + w / 2, cy);
  s.lineTo(cx, cy - h / 2);
  s.lineTo(cx - w / 2, cy);
  s.closePath();
  return s;
}

function perforatedPanelShape(w, h, cellW, cellH, holeW, holeH, inset = 0.1) {
  const shape = rectShape(w, h);
  const cols = Math.floor((w - inset * 2) / cellW);
  const rows = Math.floor((h - inset * 2) / cellH);
  const startX = -((cols - 1) * cellW) / 2;
  const startY = -((rows - 1) * cellH) / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offset = row % 2 === 0 ? 0 : cellW / 2;
      const x = startX + col * cellW + offset;
      const y = startY + row * cellH;
      if (Math.abs(x) > w / 2 - inset || Math.abs(y) > h / 2 - inset) continue;
      shape.holes.push(diamondHole(x, y, holeW, holeH));
    }
  }
  return shape;
}

function arcBandShape(innerRadius, outerRadius, startAngle, endAngle) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
  shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  shape.closePath();
  return shape;
}

function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.16, 0.1, 0.22, 0.34, 0.03, 0.62);
  s.bezierCurveTo(-0.08, 0.34, -0.06, 0.1, 0, 0);
  s.closePath();
  return s;
}

function makeCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function loadDoorTextures(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const src = document.createElement("canvas");
      src.width = img.width;
      src.height = img.height;
      const sctx = src.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(img, 0, 0);
      const px = sctx.getImageData(0, 0, img.width, img.height).data;

      let minX = img.width,
        minY = img.height,
        maxX = -1,
        maxY = -1;
      for (let y = 0; y < img.height; y++) {
        const row = y * img.width;
        for (let x = 0; x < img.width; x++) {
          if (px[(row + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) {
        minX = 0;
        minY = 0;
        maxX = img.width - 1;
        maxY = img.height - 1;
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      // base paint texture (photo composited on the door's cream paint)
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const octx = out.getContext("2d");
      octx.fillStyle = "#f4f1ea";
      octx.fillRect(0, 0, w, h);
      octx.drawImage(img, minX, minY, w, h, 0, 0, w, h);

      // gold ornament mask: keep only gold pixels, everything else transparent
      const crop = sctx.getImageData(minX, minY, w, h);
      const sp = crop.data;
      const gold = document.createElement("canvas");
      gold.width = w;
      gold.height = h;
      const gctx = gold.getContext("2d");
      const gimg = gctx.createImageData(w, h);
      const dp = gimg.data;
      for (let i = 0; i < sp.length; i += 4) {
        const r = sp[i],
          g = sp[i + 1],
          b = sp[i + 2],
          a = sp[i + 3];
        const mx = Math.max(r, g, b),
          mn = Math.min(r, g, b);
        const sat = mx > 0 ? (mx - mn) / mx : 0;
        if (a > 128 && sat > 0.28 && r > 110 && r > b + 40 && g > b + 20) {
          dp[i] = r;
          dp[i + 1] = g;
          dp[i + 2] = b;
          dp[i + 3] = 255;
        }
      }
      gctx.putImageData(gimg, 0, 0);

      resolve({
        baseTex: makeCanvasTexture(out),
        goldTex: makeCanvasTexture(gold),
        aspect: w / h,
      });
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function makeContactShadow() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  grad.addColorStop(0, "rgba(0,0,0,0.5)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.2)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.9),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  return m;
}

function buildPlasmaDoor() {
  const g = group();
  const H = 1.98;
  const depth = 0.05;

  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xf2efe8,
    metalness: 0,
    roughness: 0.6,
  });
  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.3,
    alphaTest: 0.5,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd9d9d6,
    metalness: 1,
    roughness: 0.22,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9a23f,
    metalness: 1,
    roughness: 0.3,
  });

  // soft contact shadow — grounds the door so it stops looking pasted on
  g.add(makeContactShadow());

  loadDoorTextures(doorImage)
    .then(({ baseTex, goldTex, aspect }) => {
      const W = H * aspect;
      paintMat.map = baseTex;
      paintMat.needsUpdate = true;
      goldMat.map = goldTex;
      goldMat.needsUpdate = true;

      // solid door leaf, photo on both faces
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(W, H, depth),
        [edgeMat, edgeMat, edgeMat, edgeMat, paintMat, paintMat],
      );
      leaf.position.set(0, H / 2, 0);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      g.add(leaf);

      // raised metallic gold ornament, 2 mm proud of the face
      const ornament = new THREE.Mesh(new THREE.PlaneGeometry(W, H), goldMat);
      ornament.position.set(0, H / 2, depth / 2 + 0.002);
      g.add(ornament);

      // chrome pull handle standing off the face (matches the photo)
      const handle = new THREE.Group();
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.66, 20),
        chromeMat,
      );
      grip.position.set(0, 0, 0.055);
      handle.add(grip);
      for (const my of [-0.27, 0.27]) {
        const mount = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.007, 0.055, 12),
          chromeMat,
        );
        mount.rotation.x = Math.PI / 2;
        mount.position.set(0, my, 0.0275);
        handle.add(mount);
      }
      handle.position.set(-0.305, 0.99, depth / 2);
      handle.traverse((o) => {
        o.castShadow = true;
      });
      g.add(handle);

      // brass hinges on the right edge
      for (const hy of [1.85, 1.25, 0.38]) {
        const hinge = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.12, 0.026),
          brassMat,
        );
        hinge.position.set(W / 2 + 0.008, hy, 0);
        hinge.castShadow = true;
        g.add(hinge);
      }

      // brass lock knobs
      for (const ky of [1.41, 0.6]) {
        const knob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, 0.024, 16),
          brassMat,
        );
        knob.rotation.x = Math.PI / 2;
        knob.position.set(-0.343, ky, depth / 2 + 0.008);
        knob.castShadow = true;
        g.add(knob);
      }
    })
    .catch(() => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.92, 1.98),
        paintMat,
      );
      panel.position.set(0, 0.99, 0);
      g.add(panel);
    });

  return g;
}

function strokeGeometryToShapes(bufferGeometry) {
  // Extract boundary edge loops from indexed geometry and return shapes
  const pos = bufferGeometry.attributes.position.array;
  const idx = bufferGeometry.index ? bufferGeometry.index.array : null;
  const vertices = [];
  for (let i = 0; i < pos.length; i += 3)
    vertices.push(new THREE.Vector2(pos[i], pos[i + 1]));

  const edgeCount = new Map();
  const pushEdge = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  };

  if (idx) {
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i],
        b = idx[i + 1],
        c = idx[i + 2];
      pushEdge(a, b);
      pushEdge(b, c);
      pushEdge(c, a);
    }
  } else {
    for (let i = 0; i < vertices.length; i += 3) {
      const a = i,
        b = i + 1,
        c = i + 2;
      pushEdge(a, b);
      pushEdge(b, c);
      pushEdge(c, a);
    }
  }

  const boundaryEdges = [];
  for (const key of edgeCount.keys())
    if (edgeCount.get(key) === 1) boundaryEdges.push(key);

  const adjacency = new Map();
  for (const key of boundaryEdges) {
    const [sa, sb] = key.split("_").map((s) => parseInt(s, 10));
    if (!adjacency.has(sa)) adjacency.set(sa, []);
    if (!adjacency.has(sb)) adjacency.set(sb, []);
    adjacency.get(sa).push(sb);
    adjacency.get(sb).push(sa);
  }

  const loops = [];
  const visited = new Set();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const loop = [start];
    visited.add(start);
    let cur = start;
    let prev = null;
    while (true) {
      const nexts = adjacency.get(cur) || [];
      let next = null;
      for (const n of nexts)
        if (n !== prev) {
          next = n;
          break;
        }
      if (next === null) break;
      if (next === start) break;
      loop.push(next);
      visited.add(next);
      prev = cur;
      cur = next;
    }
    if (loop.length > 2) loops.push(loop);
  }

  const shapes = [];
  for (const loop of loops) {
    const s = new THREE.Shape();
    const p0 = vertices[loop[0]];
    s.moveTo(p0.x, p0.y);
    for (let i = 1; i < loop.length; i++) {
      const p = vertices[loop[i]];
      s.lineTo(p.x, p.y);
    }
    s.closePath();
    shapes.push(s);
  }
  return shapes;
}

function addSvgExtrudedPanel(g, svgUrl) {
  const loader = new SVGLoader();
  const data = loader.parse(svgUrl);
  const scale = 0.0017;
  const centerX = 0.5 * 850 * scale;
  const centerY = 0.5 * 1100 * scale;
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e0da,
    metalness: 0.94,
    roughness: 0.22,
  });

  const panelGroup = new THREE.Group();

  // base thin panel
  const panelThickness = 0.06;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(850 * scale, 1100 * scale, panelThickness),
    new THREE.MeshStandardMaterial({
      color: 0x141416,
      metalness: 0.18,
      roughness: 0.9,
    }),
  );
  base.position.set(0, (1100 * scale) / 2, -panelThickness / 2);
  panelGroup.add(base);

  for (const path of data.paths) {
    const style = { ...path.userData.style };

    // if filled shapes exist, extrude them
    const shapes = SVGLoader.createShapes(path);
    if (shapes && shapes.length) {
      for (const s of shapes) {
        const depth = 0.06;
        const mesh = addExtrudedShape(panelGroup, s, depth, steelMat, 0, 0, 0);
        mesh.geometry.scale(scale, -scale, 1);
        mesh.geometry.translate(-centerX, centerY, 0);
        mesh.position.z = 0.02;
      }
    }

    // handle strokes by generating a stroked polygon and extruding it
    for (const subPath of path.subPaths) {
      const points = subPath.getPoints(6);
      if (points.length < 2) continue;
      const strokeWidth = Math.max(
        (parseFloat(style.strokeWidth) || 0.35) * 9,
        1.2,
      );
      style.strokeWidth = String(strokeWidth);
      const strokedGeom = SVGLoader.pointsToStroke(points, style, 6, 0.001);
      if (!strokedGeom) continue;
      strokedGeom.scale(scale, -scale, scale);
      strokedGeom.translate(-centerX, centerY, 0);
      const strokedShapes = strokeGeometryToShapes(strokedGeom);
      for (const s of strokedShapes) {
        const depth = 0.06;
        addExtrudedShape(panelGroup, s, depth, steelMat, 0, 0, 0);
      }
    }
  }

  panelGroup.scale.setScalar(1.08);
  g.add(panelGroup);
  return panelGroup;
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

export function buildImage(imageUrl, opts = {}) {
  const g = group();
  const backerMat = new THREE.MeshStandardMaterial({
    color: opts.backer ?? 0x1c1c20,
    metalness: 0.8,
    roughness: 0.35,
  });
  const backer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backerMat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  backer.position.z = -0.014;
  backer.castShadow = true;
  backer.receiveShadow = true;
  plane.castShadow = true;
  g.add(backer, plane);

  const tex = new THREE.TextureLoader().load(imageUrl, () => {
    const img = tex.image;
    if (!img) return;
    const aspect = img.width / img.height;
    const w = opts.width ?? 1.2;
    const h = w / aspect;
    plane.geometry.dispose();
    plane.geometry = new THREE.PlaneGeometry(w, h);
    backer.geometry.dispose();
    backer.geometry = new THREE.PlaneGeometry(w + 0.08, h + 0.08);
    plane.position.y = h / 2;
    backer.position.y = h / 2;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  plane.material = new THREE.MeshStandardMaterial({
    map: tex,
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.4,
    metalness: opts.metalness ?? 0.55,
  });
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
