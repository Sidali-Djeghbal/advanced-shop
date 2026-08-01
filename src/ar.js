import * as THREE from "three";

export function createARMode({ renderer, scene, getCurrent, setActive, setBackdrop }) {
  let session = null;
  let refSpace = null;
  let hitSource = null;
  let transientSource = null;
  let anchor = null;
  let placed = false;
  let savedBg = null;

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

  const ui = document.createElement("div");
  ui.className = "ar-ui";
  ui.innerHTML = `
    <button class="ar-exit" type="button">Exit AR</button>
    <p class="ar-tip">Aim at the floor &middot; tap to place &middot; drag to move</p>
  `;

  function showUnsupported() {
    const m = document.createElement("div");
    m.className = "ar-msg";
    m.innerHTML = `
      <div class="ar-msg-box">
        <h3>AR not available</h3>
        <p>This device or browser does not support WebXR AR. Use an AR-capable phone (Chrome on Android, or Safari 17+ on iOS) over HTTPS.</p>
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
    hitSource = null;
    transientSource = null;
    refSpace = null;
  }

  async function open() {
    if (session) return;
    try {
      if (
        !navigator.xr ||
        !(await navigator.xr.isSessionSupported("immersive-ar"))
      ) {
        showUnsupported();
        return;
      }
    } catch {
      showUnsupported();
      return;
    }

    anchor = getCurrent();
    if (!anchor) {
      showUnsupported();
      return;
    }
    anchor.position.set(0, 0, 0);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(1);

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
      cleanup();
      showUnsupported();
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

  function applyPose(pose) {
    const p = pose.transform.position;
    anchor.position.set(p.x, p.y, p.z);
    faceViewer();
  }

  function update(frame) {
    if (!session || !frame || !refSpace || !hitSource) return;

    let touched = false;
    if (transientSource) {
      const trs = frame.getHitTestResultsForTransientInput(transientSource);
      if (trs.length) {
        const results = trs[0].results;
        if (results.length) {
          const pose = results[0].getPose(refSpace);
          if (pose && isFloor(pose)) {
            applyPose(pose);
            placed = true;
            touched = true;
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
        anchor.position.set(p.x, p.y, p.z);
        anchor.rotation.set(0, 0, 0);
      }
    } else {
      reticle.visible = false;
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
