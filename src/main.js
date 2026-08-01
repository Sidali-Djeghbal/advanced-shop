import * as THREE from 'three'
import './styles.css'
import { createScene } from './scene.js'
import { PRODUCTS } from './products.js'
import { createARMode } from './ar.js'

const stage = document.getElementById('stage')
const { renderer, scene, camera, setBackdrop } = createScene(stage)

let xrActive = false
const ar = createARMode({
  renderer,
  scene,
  camera,
  getCurrent: () => current,
  setActive: (v) => { xrActive = v },
  setBackdrop,
})
renderer.xr.enabled = true
document.getElementById('ar-open').addEventListener('click', () => ar.open())

const pool = PRODUCTS.map((p) => p.build())
let current = pool[0]
scene.add(current)
let selectedIndex = 0

const anims = []
const parallax = { x: 0, y: 0 }

let rotY = 0
let vel = 0
const drag = { active: false, x: 0 }

stage.addEventListener('pointerdown', (e) => {
  if (xrActive) return
  drag.active = true
  drag.x = e.clientX
  vel = 0
  stage.setPointerCapture(e.pointerId)
  stage.classList.add('grabbing')
})
stage.addEventListener('pointermove', (e) => {
  if (!drag.active || anims.length > 0) return
  const dx = e.clientX - drag.x
  drag.x = e.clientX
  rotY += dx * 0.006
  vel = dx * 0.006
})
stage.addEventListener('pointerup', () => {
  drag.active = false
  stage.classList.remove('grabbing')
})
stage.addEventListener('pointercancel', () => {
  drag.active = false
  stage.classList.remove('grabbing')
})

function dirFor() {
  return new THREE.Vector3(1, 0, 0)
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
const easeInCubic = (t) => t * t * t

function selectProduct(i) {
  if (i === selectedIndex) return
  const dir = dirFor()
  const next = pool[i]
  next.visible = true
  scene.add(next)
  next.position.copy(dir).multiplyScalar(2.4)
  next.rotation.set(0, 0, 0)
  next.scale.setScalar(0.94)
  anims.push({ kind: 'enter', obj: next, dir, spin: i % 2 === 0 ? 1 : -1, t: 0, dur: 0.6 })
  anims.push({ kind: 'exit', obj: current, dir: dir.clone().multiplyScalar(-1), t: 0, dur: 0.32 })
  current = next
  selectedIndex = i
  updateInfo(i)
  refreshActive(i)
}

/* ---- info card ---- */
const infoEl = document.getElementById('info')

function updateInfo(i) {
  const p = PRODUCTS[i]
  document.getElementById('info-name').textContent = p.name
  document.getElementById('info-tag').textContent = p.tagline
  const dims = document.getElementById('info-dims')
  dims.innerHTML = p.dims
    .map(([k, v]) => `<div><span>${k}</span><b>${v} mm</b></div>`)
    .join('') + `<div><span>Finish</span><b>${p.finish}</b></div>`
  document.getElementById('info-desc').textContent = p.desc
  infoEl.classList.remove('pop')
  void infoEl.offsetWidth
  infoEl.classList.add('pop')
}

/* ---- slide-in catalog ---- */
const catalog = document.getElementById('catalog')
const catalogTab = document.getElementById('catalog-tab')
const catalogList = document.getElementById('catalog-list')

function setCatalog(open) {
  catalog.classList.toggle('open', open)
  catalogTab.classList.toggle('hide', open)
}
catalogTab.addEventListener('click', () => setCatalog(true))
document.getElementById('menu-close').addEventListener('click', () => setCatalog(false))
setCatalog(window.innerWidth > 760)

function iconSvg(type) {
  switch (type) {
    case 'art':
      return '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 4.5L16 9l-4 4.5L8 9Z"/><circle cx="12" cy="16.5" r="1.6"/>'
    case 'door':
      return '<rect x="7" y="2" width="10" height="20" rx="1"/><rect x="9.5" y="5" width="5" height="4.5" rx="0.5"/><rect x="14" y="11" width="2" height="2"/>'
    case 'twin':
      return '<rect x="3" y="2" width="8" height="20" rx="1"/><rect x="13" y="2" width="8" height="20" rx="1"/><rect x="7" y="11" width="1.6" height="1.6"/><rect x="15.5" y="11" width="1.6" height="1.6"/>'
    case 'slido':
      return '<rect x="2" y="3" width="20" height="18" rx="1"/><rect x="4.5" y="5.5" width="6" height="11" rx="0.5"/><rect x="13.5" y="5.5" width="6" height="11" rx="0.5"/><path d="M4 21l4-3M4 18l4 3"/>'
    case 'cube':
      return '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/>'
    case 'vista':
      return '<rect x="1" y="6" width="22" height="12" rx="1"/><path d="M1 12h22"/>'
    case 'store':
      return '<rect x="2" y="2" width="20" height="20" rx="1"/><path d="M8 2v20M14 2v20"/><rect x="17.2" y="10" width="1.6" height="3"/>'
  }
  return ''
}

function buildCatalog() {
  catalogList.innerHTML = PRODUCTS.map(
    (p, i) => `
    <li class="catalog-item ${i === selectedIndex ? 'active' : ''}" data-i="${i}">
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${iconSvg(p.icon)}</svg>
      <span class="meta"><b>${p.name}</b><small>${p.tagline}</small></span>
    </li>`
  ).join('')
  catalogList.querySelectorAll('.catalog-item').forEach((el) => {
    el.addEventListener('click', () => selectProduct(Number(el.dataset.i)))
  })
}

function refreshActive(i) {
  catalogList.querySelectorAll('.catalog-item').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.i) === i)
  })
}

buildCatalog()

window.addEventListener('pointermove', (e) => {
  parallax.x = e.clientX / innerWidth - 0.5
  parallax.y = e.clientY / innerHeight - 0.5
})

/* ---- render loop ---- */
const clock = new THREE.Clock()

function animate(time, frame) {
  const dt = Math.min(clock.getDelta(), 0.05)

  if (xrActive) {
    try {
      ar.update(frame)
    } catch (e) {
      /* keep the loop alive */
    }
  } else {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]
      a.t = clamp01(a.t + dt / a.dur)
      if (a.kind === 'enter') {
        const e = easeOutCubic(a.t)
        a.obj.position.set(
          a.dir.x * 2.4 * (1 - e),
          Math.sin(a.t * Math.PI) * 0.35 * (1 - e),
          a.dir.z * 2.4 * (1 - e)
        )
        a.obj.rotation.y = (1 - e) * 0.55 * a.spin
        a.obj.scale.setScalar(0.94 + 0.06 * e)
        if (a.t >= 1) {
          a.obj.position.set(0, 0, 0)
          a.obj.rotation.set(0, 0, 0)
          a.obj.scale.setScalar(1)
        }
      } else {
        const e = easeInCubic(a.t)
        a.obj.position.set(
          a.dir.x * 2.4 * e,
          Math.sin(a.t * Math.PI) * 0.3 * e,
          a.dir.z * 2.4 * e
        )
        a.obj.scale.setScalar(1 - 0.05 * e)
        if (a.t >= 1) {
          a.obj.visible = false
          scene.remove(a.obj)
        }
      }
      if (a.t >= 1) anims.splice(i, 1)
    }

    if (anims.length === 0) {
      if (!drag.active) {
        rotY += vel
        vel *= 0.94
      }
      current.rotation.y = rotY
    }

    camera.position.x += (parallax.x * 0.18 - camera.position.x) * 0.045
    camera.position.y += ((1.75 - parallax.y * 0.1) - camera.position.y) * 0.045
    camera.lookAt(0, 1.12, 0)
  }

  renderer.render(scene, camera)
}

updateInfo(0)
renderer.setAnimationLoop(animate)
