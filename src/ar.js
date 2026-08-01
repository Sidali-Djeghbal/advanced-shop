import * as THREE from "three";

export function createARMode({
  renderer,
  scene,
  camera,
  getCurrent,
  setActive,
  setBackdrop,
}) {
  let session = null;
  let refSpace = null;
  let refType = "local-floor";
  let hitSource = null;
  let transientHitSource = null;
  let anchor = null;
  let savedBg = null;
  let baseHeight = 2.1;
  let s = 1;
  let autoFitOn = true;
  let followCamera = true;
  let activeInput = null;
  let activePointerId = null;
  let dragStarted = false;
  let viewerPose = null;
  let hasSmooth = false;
  let smoothYaw = 0;
  let lastT = 0;
  let lastPct = -1;

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
  const _d = new THREE.Vector3();
  const _ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _fwd = new THREE.Vector3(0, 0, -1);
  const _t1 = new THREE.Vector3();
  const _t2 = new THREE.Vector3();

  // "local" spaces have their origin at head height, so guess the floor.
  function floorY() {
    return refType === "local-floor" ? 0 : -1.45;
  }

  function rayPlaneY(origin, dir, y, out) {
    if (Math.abs(dir.y) < 1e-5) return null;
    const t = (y - origin.y) / dir.y;
    if (t < 0) return null;
    return out.set(origin.x + dir.x * t, y, origin.z + dir.z * t);
  }

  // Accept only real floor hits: horizontal, up-facing, clearly below the viewer.
  function floorHitPosition(pose, out) {
    const q = pose.transform.orientation;
    _q.set(q.x, q.y, q.z, q.w);
    _v.set(0, 1, 0).applyQuaternion(_q);
    if (_v.y < 0.6) return null; // walls / ceilings
    const p = pose.transform.position;
    const vy = viewerPose ? viewerPose.transform.position.y : p.y + 1.5;
    if (vy - p.y < 0.5) return null; // table tops and higher surfaces
    return out.set(p.x, p.y, p.z);
  }

  function cameraTarget(out) {
    if (!viewerPose) return null;
    const t = viewerPose.transform;
    _q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    _d.set(0, 0, -1).applyQuaternion(_q);
    _d.y = 0;
    if (_d.lengthSq() > 1e-6) {
      _d.normalize();
      _fwd.copy(_d);
    } else {
      _d.copy(_fwd); // looking straight up/down: keep last heading
    }
    const p = t.position;
    return out.set(p.x + _d.x * 2, floorY(), p.z + _d.z * 2);
  }

  function pointerTarget(clientX, clientY, out) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    _ray.setFromCamera(_ndc, renderer.xr.getCamera());
    return rayPlaneY(_ray.ray.origin, _ray.ray.direction, floorY(), out);
  }

  function inputTarget(input, frame, out) {
    if (!input || !input.targetRaySpace) return null;
    const pose = frame.getPose(input.targetRaySpace, refSpace);
    if (!pose) return null;
    const o = pose.transform.position;
    const q = pose.transform.orientation;
    _q.set(q.x, q.y, q.z, q.w);
    _v.set(0, 0, -1).applyQuaternion(_q);
    _d.set(o.x, o.y, o.z);
    return rayPlaneY(_d, _v, floorY(), out);
  }

  function desiredYaw(pos) {
    if (!viewerPose) return 0;
    const v = viewerPose.transform.position;
    return Math.atan2(v.x - pos.x, v.z - pos.z);
  }

  function faceViewer() {
    if (!anchor || !viewerPose) return;
    anchor.rotation.y = desiredYaw(anchor.position);
  }

  // instant placement (user-driven drag)
  function placeAt(pos) {
    anchor.position.copy(pos);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(s);
    faceViewer();
    hasSmooth = false; // re-arm smoothing so follow eases out of the drop point
  }

  // damped placement (camera follow) — glides instead of jittering
  function followStep(target, dt) {
    const k = dt > 0 ? 1 - Math.exp(-dt * 9) : 1;
    const yaw = desiredYaw(target);
    if (!hasSmooth) {
      anchor.position.copy(target);
      smoothYaw = yaw;
      hasSmooth = true;
    } else {
      anchor.position.lerp(target, k);
      let dy = yaw - smoothYaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      smoothYaw += dy * k;
    }
    anchor.rotation.set(0, smoothYaw, 0);
    anchor.scale.setScalar(s);
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
      <span class="ar-tip">Point at the floor &middot; touch &amp; drag to place</span>
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
    setFollow(false); // user takes control; don't snap back on release
    const target = pointerTarget(clientX, clientY, _t2);
    if (target) {
      placeAt(target);
      if (autoFitOn) autoFit();
    }
    dragStarted = true;
  }

  function moveDrag(clientX, clientY) {
    if (!session || !anchor || !dragStarted) return;
    const target = pointerTarget(clientX, clientY, _t2);
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
    const p = Math.round(s * 100);
    if (p !== lastPct) {
      // avoid DOM writes every frame — they jank the XR compositor
      lastPct = p;
      scaleEl.value = String(p);
      pctEl.textContent = p + "%";
    }
    if (anchor) anchor.scale.setScalar(s);
  }

  function autoFit() {
    if (!anchor || !viewerPose || !viewerPose.views || !viewerPose.views.length)
      return;
    const v = viewerPose.transform.position;
    const d = Math.max(
      Math.hypot(
        v.x - anchor.position.x,
        v.y - anchor.position.y,
        v.z - anchor.position.z,
      ),
      0.25,
    );
    const e = viewerPose.views[0].projectionMatrix;
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
    try {
      hitSource?.cancel();
    } catch {}
    try {
      transientHitSource?.cancel();
    } catch {}
    hitSource = null;
    transientHitSource = null;
    try {
      renderer.xr.setFramebufferScaleFactor?.(1);
    } catch {}
    resetAnchor();
    if (scene.background === null) scene.background = savedBg;
    if (typeof setBackdrop === "function") setBackdrop(true);
    if (typeof setActive === "function") setActive(false);
    if (camera) {
      camera.position.set(0, 1.75, 3.7);
      camera.lookAt(0, 1.12, 0);
    }
    activeInput = null;
    activePointerId = null;
    dragStarted = false;
    viewerPose = null;
    refSpace = null;
    hasSmooth = false;
    lastT = 0;
    lastPct = -1;
    setScale(1);
    autoFitOn = true;
    refitBtn.textContent = "Auto-fit: On";
    refitBtn.classList.remove("off");
    setFollow(true);
  }

  function onSelectStart(e) {
    activeInput = e.inputSource;
    setFollow(false); // user takes control; don't snap back on release
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
    anchor.position.set(0, 0, -2);
    anchor.rotation.set(0, 0, 0);
    anchor.scale.setScalar(1);
    setScale(1);

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
      session = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["dom-overlay", "hit-test"],
        domOverlay: { root: ui },
      });
      try {
        refType = "local-floor";
        refSpace = await session.requestReferenceSpace(refType);
      } catch {
        refType = "local";
        refSpace = await session.requestReferenceSpace(refType);
      }
      renderer.xr.setReferenceSpaceType(refType);
      await renderer.xr.setSession(session);

      // real floor detection via hit-test (optional; math fallback below)
      hitSource = null;
      transientHitSource = null;
      try {
        const viewerSpace = await session.requestReferenceSpace("viewer");
        hitSource = await session.requestHitTestSource({ space: viewerSpace });
      } catch {}
      try {
        if (session.requestHitTestSourceForTransientInput) {
          transientHitSource = await session.requestHitTestSourceForTransientInput(
            { profile: "generic-touchscreen" },
          );
        }
      } catch {}

      // render the XR view a bit below native resolution for a smoother feed
      try {
        renderer.xr.setFramebufferScaleFactor?.(0.85);
      } catch {}

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
      viewerPose = frame.getViewerPose(refSpace);
      if (!viewerPose) return;

      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      if (activeInput) {
        let t = null;
        if (transientHitSource) {
          try {
            const results =
              frame.getHitTestResultsForTransientInput(transientHitSource);
            for (const r of results) {
              if (r.inputSource !== activeInput || !r.results.length) continue;
              for (const h of r.results) {
                const p = h.getPose(refSpace);
                if (p && floorHitPosition(p, _t2)) {
                  t = _t2;
                  break;
                }
              }
              break;
            }
          } catch {}
        }
        if (!t) t = inputTarget(activeInput, frame, _t2);
        if (t) {
          placeAt(t);
          if (autoFitOn) autoFit();
        }
      }

      if (followCamera && !activeInput && !dragStarted) {
        let target = null;
        if (hitSource) {
          try {
            const hits = frame.getHitTestResults(hitSource);
            for (const h of hits) {
              const p = h.getPose(refSpace);
              if (p && floorHitPosition(p, _t1)) {
                target = _t1;
                break;
              }
            }
          } catch {}
        }
        if (!target) target = cameraTarget(_t1);
        if (target) {
          followStep(target, dt);
          if (autoFitOn) autoFit();
        }
      }

      reticle.visible = true;
      reticle.position.set(
        anchor.position.x,
        anchor.position.y + 0.002,
        anchor.position.z,
      );
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
