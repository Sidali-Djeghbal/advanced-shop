import * as THREE from "three";

export function createARMode({ renderer, scene, getCurrent, setActive, setBackdrop }) {
  let session = null;
  let refSpace = null;
  let hitSource = null;
  let transientSource = null;
  let anchor = null;
  let placed = false;
  let savedBg = null;
  let baseHeight = 2.1;
  let s = 1;
  let autoFitOn = true;

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.13, 0.16, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.visible = false;

  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();

  function rayToFloor(input, frame) {
    if (!input || !input.targetRaySpace) return null;
    const pose = frame.getPose(input.targetRaySpace, refSpace);
    if (!pose) return null;
    const o = pose.transform.position;
    const q = pose.transform.orientation;
    _q.set(q.x, q.y, q.z, q.w);
    _v.set(0, 0, -1).applyQuaternion(_q);
    const y = anchor.position.y;
    if (Math.abs(_v.y) < 1e-5) return null;
    const t = (y - o.y) / _v.y;
    if (t < 0) return null;
    return new THREE.Vector3(o.x + _v.x * t, y, o.z + _v.z * t);
  }

  function placeAt(pos) {
    anchor.position.copy(pos);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(s);
    faceViewer();
  }

  const ui = document.createElement("div");
  ui.className = "ar-ui";
  ui.innerHTML = `
    <div class="ar-top">
      <button class="ar-exit" type="button">Exit AR</button>
      <span class="ar-tip">Tap floor to place &middot; drag to move</span>
    </div>
    <div class="ar-bottom">
      <label class="ar-size">Size<input class="ar-scale" type="range" min="40" max="250" value="100"></label>
      <button class="ar-refit" type="button">Auto-fit: On</button>
    </div>
  `;
  const scaleEl = ui.querySelector(".ar-scale");
  const refitBtn = ui.querySelector(".ar-refit");

  scaleEl.addEventListener("input", () => setScale(Number(scaleEl.value) / 100));
  refitBtn.addEventListener("click", () => {
    autoFitOn = !autoFitOn;
    refitBtn.textContent = autoFitOn ? "Auto-fit: On" : "Auto-fit: Off";
    if (autoFitOn) autoFit();
  });
  ui.querySelector(".ar-exit").addEventListener("click", close);

  function showUnsupported(msg) {
    const m = document.createElement("div");
    m.className = "ar-msg";
    m.innerHTML = `
      <div class="ar-msg-box">
        <h3>AR not available</h3>
        <p>${msg}</p>
        <button type="button">Close</button>
      </div>
    `;
    document.body.appendChild(m);
    m.querySelector("button").addEventListener("click", () => m.remove());
  }

  function resetAnchor() {
    if (!anchor) return;
    anchor.position.set(0, 0, 0);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(1);
  }

  function cleanup() {
    if (reticle.parent) reticle.parent.remove(reticle);
    if (ui.parent) ui.remove();
    resetAnchor();
    if (scene.background === null) scene.background = savedBg;
    if (typeof setBackdrop === "function") setBackdrop(true);
    if (typeof setActive === "function") setActive(false);
    placed = false;
    s = 1;
    autoFitOn = true;
    hitSource = null;
    transientSource = null;
    refSpace = null;
  }

  async function open() {
    if (session) return;
    let supported = false;
    try {
      if (navigator.xr) {
        supported = await navigator.xr.isSessionSupported("immersive-ar");
      }
    } catch {
      supported = false;
    }
    if (!supported) {
      showUnsupported(
        "This device or browser does not support WebXR AR. Use an AR-capable phone (Chrome on Android, or Safari 17+ on iOS) over HTTPS.",
      );
      return;
    }

    anchor = getCurrent();
    if (!anchor) {
      showUnsupported("Product is not ready yet.");
      return;
    }
    anchor.position.set(0, 0, 0);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(1);

    const box = new THREE.Box3().setFromObject(anchor);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 1e-3) baseHeight = size.y;

    savedBg = scene.background;
    scene.background = null;
    if (typeof setBackdrop === "function") setBackdrop(false);
    scene.add(reticle);
    document.body.appendChild(ui);

    try {
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local-floor");
      const init = {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["local-floor", "dom-overlay"],
      };
      try {
        session = await navigator.xr.requestSession("immersive-ar", {
          ...init,
          domOverlay: { root: ui },
        });
      } catch {
        session = await navigator.xr.requestSession("immersive-ar", init);
      }
      await renderer.xr.setSession(session);
      refSpace = await session.requestReferenceSpace("local-floor");
      const viewerSpace = await session.requestReferenceSpace("viewer");
      hitSource = await session.requestHitTestSource({ space: viewerSpace });
      try {
        transientSource =
          await session.requestHitTestSourceForTransientInput({
            profile: "generic-touch",
          });
      } catch {
        transientSource = null;
      }
      session.addEventListener("end", onEnd);
      if (typeof setActive === "function") setActive(true);
    } catch (err) {
      const s = session;
      session = null;
      if (s) {
        try {
          s.end();
        } catch {}
      }
      cleanup();
      showUnsupported("The AR session could not be started. Camera permission may be required.");
    }
  }

  function onEnd() {
    const s = session;
    session = null;
    if (s) {
      try {
        s.removeEventListener("end", onEnd);
      } catch {}
    }
    cleanup();
  }

  function isFloor(pose) {
    const q = pose.transform.orientation;
    const y = 1 - 2 * (q.x * q.x + q.z * q.z);
    return y > 0.7;
  }

  function faceViewer() {
    if (!anchor || !renderer.xr.getCamera) return;
    const cam = renderer.xr.getCamera();
    const v = new THREE.Vector3();
    cam.getWorldPosition(v);
    const yaw = Math.atan2(v.x - anchor.position.x, v.z - anchor.position.z);
    anchor.rotation.y = yaw;
  }

  function setScale(v) {
    s = Math.min(3, Math.max(0.35, v));
    scaleEl.value = String(Math.round(s * 100));
    if (anchor) anchor.scale.setScalar(s);
  }

  function autoFit() {
    if (!anchor || !renderer.xr.getCamera) return;
    const cam = renderer.xr.getCamera();
    const v = new THREE.Vector3();
    cam.getWorldPosition(v);
    const d = Math.max(v.distanceTo(anchor.position), 0.25);
    const e = cam.projectionMatrix.elements;
    const tanVHalf = 1 / Math.max(Math.abs(e[5]), 1e-6);
    const targetH = 2 * d * tanVHalf * 0.55;
    setScale(targetH / baseHeight);
  }

  function applyPose(pose) {
    const p = pose.transform.position;
    placeAt(new THREE.Vector3(p.x, p.y, p.z));
  }

  function update(frame) {
    try {
      if (!session || !frame || !refSpace || !hitSource) return;

      let touched = false;
      if (transientSource) {
        const trs = frame.getHitTestResultsForTransientInput(transientSource);
        if (trs.length) {
          const r = trs[0];
          const ray = r.inputSource ? rayToFloor(r.inputSource, frame) : null;
          if (ray) {
            placeAt(ray);
            placed = true;
            touched = true;
            if (autoFitOn) autoFit();
          } else if (r.results.length) {
            const pose = r.results[0].getPose(refSpace);
            if (pose && isFloor(pose)) {
              applyPose(pose);
              placed = true;
              touched = true;
              if (autoFitOn) autoFit();
            }
          }
        }
      }

      const hits = frame.getHitTestResults(hitSource);
      let reticlePose = null;
      if (hits.length) {
        const pose = hits[0].getPose(refSpace);
        if (pose && isFloor(pose)) reticlePose = pose;
      }

      if (reticlePose) {
        reticle.visible = true;
        reticle.position.set(
          reticlePose.position.x,
          reticlePose.position.y + 0.002,
          reticlePose.position.z,
        );
        if (!placed && !touched) {
          const p = reticlePose.transform.position;
          placeAt(new THREE.Vector3(p.x, p.y, p.z));
          if (autoFitOn) autoFit();
        }
      } else {
        reticle.visible = false;
      }
    } catch (err) {
      // never let a hit-test hiccup kill the render loop
    }
  }

  async function close() {
    if (session) {
      const s = session;
      session = null;
      try {
        s.removeEventListener("end", onEnd);
        await s.end();
      } catch {}
    }
    cleanup();
  }

  return { open, close, update };
}
