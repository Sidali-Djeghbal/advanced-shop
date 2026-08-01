import * as THREE from "three";

export function createARMode({
  renderer,
  scene,
  getCurrent,
  setActive,
  setBackdrop,
}) {
  let session = null;
  let refSpace = null;
  let anchor = null;
  let savedBg = null;
  let baseHeight = 2.1;
  let s = 1;
  let autoFitOn = true;
  let followCamera = true;
  let activeInput = null;
  let activePointerId = null;
  let dragStarted = false;

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
  const _p = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();

  function rayPlaneY(origin, dir, y) {
    if (Math.abs(dir.y) < 1e-5) return null;
    const t = (y - origin.y) / dir.y;
    if (t < 0) return null;
    return new THREE.Vector3(origin.x + dir.x * t, y, origin.z + dir.z * t);
  }

  function cameraTarget() {
    const cam = renderer.xr.getCamera();
    cam.getWorldPosition(_p);
    cam.getWorldDirection(_d);
    _d.y = 0;
    if (_d.lengthSq() < 1e-6) {
      cam.getWorldDirection(_d);
      _d.y = 0;
    }
    _d.normalize();
    return new THREE.Vector3(_p.x + _d.x * 2, 0, _p.z + _d.z * 2);
  }

  function pointerTarget(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    _ray.setFromCamera(_ndc, renderer.xr.getCamera());
    return rayPlaneY(_ray.ray.origin, _ray.ray.direction, 0) || cameraTarget();
  }

  function inputTarget(input, frame) {
    if (!input || !input.targetRaySpace) return null;
    const pose = frame.getPose(input.targetRaySpace, refSpace);
    if (!pose) return null;
    const o = pose.transform.position;
    const q = pose.transform.orientation;
    _q.set(q.x, q.y, q.z, q.w);
    _v.set(0, 0, -1).applyQuaternion(_q);
    return rayPlaneY(new THREE.Vector3(o.x, o.y, o.z), _v, 0);
  }

  function faceViewer() {
    if (!anchor || !renderer.xr.getCamera) return;
    const cam = renderer.xr.getCamera();
    const v = new THREE.Vector3();
    cam.getWorldPosition(v);
    const yaw = Math.atan2(v.x - anchor.position.x, v.z - anchor.position.z);
    anchor.rotation.y = yaw;
  }

  function placeAt(pos) {
    anchor.position.copy(pos);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(s);
    faceViewer();
  }

  function setFollow(next) {
    followCamera = next;
    followBtn.textContent = followCamera ? "Follow: On" : "Follow: Off";
    followBtn.classList.toggle("off", !followCamera);
  }

  const ui = document.createElement("div");
  ui.className = "ar-ui";
  ui.innerHTML = `
    <div class="ar-top">
      <button class="ar-exit" type="button">Exit AR</button>
      <span class="ar-tip">Preview in front of you &middot; drag to anchor</span>
    </div>
    <div class="ar-bottom">
      <div class="ar-slider">
        <label>Size <b class="ar-pct">100%</b></label>
        <input class="ar-scale" type="range" min="40" max="250" value="100">
      </div>
      <div class="ar-toggles">
        <button class="ar-refit" type="button">Auto-fit: On</button>
        <button class="ar-follow" type="button">Follow: On</button>
      </div>
    </div>
  `;
  const scaleEl = ui.querySelector(".ar-scale");
  const pctEl = ui.querySelector(".ar-pct");
  const refitBtn = ui.querySelector(".ar-refit");
  const followBtn = ui.querySelector(".ar-follow");

  scaleEl.addEventListener("input", () =>
    setScale(Number(scaleEl.value) / 100),
  );
  refitBtn.addEventListener("click", () => {
    autoFitOn = !autoFitOn;
    refitBtn.textContent = autoFitOn ? "Auto-fit: On" : "Auto-fit: Off";
    refitBtn.classList.toggle("off", !autoFitOn);
    if (autoFitOn) autoFit();
  });
  followBtn.addEventListener("click", () => setFollow(!followCamera));
  ui.querySelector(".ar-exit").addEventListener("click", close);

  function beginDrag(clientX, clientY) {
    if (!session || !anchor) return;
    const target = pointerTarget(clientX, clientY);
    if (target) {
      placeAt(target);
      if (autoFitOn) autoFit();
    }
    dragStarted = true;
    setFollow(false);
  }

  function moveDrag(clientX, clientY) {
    if (!session || !anchor || !dragStarted) return;
    const target = pointerTarget(clientX, clientY);
    if (target) {
      placeAt(target);
      if (autoFitOn) autoFit();
    }
  }

  function endDrag() {
    dragStarted = false;
    activePointerId = null;
  }

  function setScale(v) {
    s = Math.min(3, Math.max(0.35, v));
    scaleEl.value = String(Math.round(s * 100));
    pctEl.textContent = Math.round(s * 100) + "%";
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
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("pointerup", onPointerUp);
    renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
    resetAnchor();
    if (scene.background === null) scene.background = savedBg;
    if (typeof setBackdrop === "function") setBackdrop(true);
    if (typeof setActive === "function") setActive(false);
    activeInput = null;
    activePointerId = null;
    dragStarted = false;
    s = 1;
    autoFitOn = true;
    followCamera = true;
    refSpace = null;
  }

  function onSelectStart(e) {
    activeInput = e.inputSource;
  }
  function onSelectEnd(e) {
    if (activeInput === e.inputSource) activeInput = null;
  }

  function onPointerDown(e) {
    if (!session || e.button !== 0 || activePointerId !== null) return;
    activePointerId = e.pointerId;
    renderer.domElement.setPointerCapture?.(e.pointerId);
    beginDrag(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (activePointerId !== e.pointerId) return;
    moveDrag(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (activePointerId !== e.pointerId) return;
    endDrag();
    e.preventDefault();
  }

  function onPointerCancel(e) {
    if (activePointerId !== e.pointerId) return;
    endDrag();
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
    const initial = cameraTarget();
    anchor.position.set(initial.x, initial.y, initial.z);
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
    renderer.domElement.addEventListener("pointerdown", onPointerDown, {
      passive: false,
    });
    renderer.domElement.addEventListener("pointermove", onPointerMove, {
      passive: false,
    });
    renderer.domElement.addEventListener("pointerup", onPointerUp, {
      passive: false,
    });
    renderer.domElement.addEventListener("pointercancel", onPointerCancel, {
      passive: false,
    });

    try {
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local-floor");
      session = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: ui },
      });
      await renderer.xr.setSession(session);
      refSpace = await session.requestReferenceSpace("local-floor");
      session.addEventListener("selectstart", onSelectStart);
      session.addEventListener("selectend", onSelectEnd);
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
      showUnsupported(
        "The AR session could not be started. Camera permission may be required.",
      );
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

  function update(frame) {
    try {
      if (!session || !frame || !refSpace || !anchor) return;

      if (activeInput) {
        const t = inputTarget(activeInput, frame);
        if (t) {
          placeAt(t);
          if (autoFitOn) autoFit();
        }
      }

      const target =
        followCamera && !dragStarted ? cameraTarget() : anchor.position;
      if (target) {
        reticle.visible = true;
        reticle.position.set(target.x, target.y + 0.002, target.z);
      } else {
        reticle.visible = false;
      }

      if (followCamera && !activeInput && !dragStarted && target) {
        placeAt(target);
        if (autoFitOn) autoFit();
      }
    } catch (err) {
      // never let an input hiccup kill the render loop
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
