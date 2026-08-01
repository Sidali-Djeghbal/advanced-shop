import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0ec);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / container.clientHeight,
    0.1,
    40,
  );
  camera.position.set(0, 1.75, 3.7);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.5, 5, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 25;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xfff4e8, 0.7);
  fill.position.set(-3, 2, -2);
  scene.add(fill);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfdcd4, 0.5));

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7, 72),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(9, 18, 0xd6d6d0, 0xe4e4de);
  grid.position.y = 0.002;
  scene.add(grid);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.56, 0.04, 96),
    new THREE.MeshStandardMaterial({
      color: 0xe9e9e4,
      roughness: 0.45,
      metalness: 0.25,
    }),
  );
  disc.position.y = 0.02;
  disc.receiveShadow = true;
  disc.castShadow = true;
  scene.add(disc);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  const backdrop = [floor, grid, disc];
  function setBackdrop(visible) {
    for (const o of backdrop) o.visible = visible;
  }

  return { renderer, scene, camera, setBackdrop, key };
}
