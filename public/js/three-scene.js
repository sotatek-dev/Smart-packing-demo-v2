// ─── 3D VISUALIZATION ───────────────────────────────────────────────────
// Relies on window.S (app state) and window.settingsData (box/sku catalog)
// being kept up to date by js/app.js.

let scene3D, camera3D, renderer3D, controls3D, palletGroup;

const drag3D = {
  active: false,
  mesh: null,
  edgeMesh: null,
  item: null,
  plane: null,
  offset: null,
  originalPos: null,
  highlightMat: null,
  pendingDrop: null,
  rotationState: 0,
  origDims: null,
};
let _raycaster3D = null;
let _mouse3D = null;
let _intersect3D = null;
let _draggableSkus = [];
let _lastDragSnapshot = null;
let _dragHistory = [];

function _updateRevertButtons() {
  const btnLast = document.getElementById("btn-revert-drag");
  const btnAll = document.getElementById("btn-revert-all");
  const hasHistory = _dragHistory.length > 0;
  if (btnLast) {
    btnLast.disabled = !hasHistory;
    btnLast.style.opacity = hasHistory ? "1" : "0.5";
    btnLast.textContent = hasHistory ? `↩ Revert (${_dragHistory.length})` : "↩ Revert Last Move";
  }
  if (btnAll) {
    btnAll.disabled = !hasHistory;
    btnAll.style.opacity = hasHistory ? "1" : "0.5";
  }
}

function init3D() {
  const container = document.getElementById("three-container");
  if (!container) return;
  if (!window.THREE) {
    console.error("THREE not loaded");
    return;
  }
  if (renderer3D) return;

  const w = container.offsetWidth || container.parentElement?.offsetWidth || 800;
  const h = container.offsetHeight || container.parentElement?.offsetHeight || 600;

  try {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x1a1a2e);

    camera3D = new THREE.PerspectiveCamera(45, w / h, 1, 20000);
    camera3D.position.set(1000, 800, 1000);
    camera3D.lookAt(0, 0, 0);

    renderer3D = new THREE.WebGLRenderer({ antialias: true });
    renderer3D.setPixelRatio(window.devicePixelRatio);
    renderer3D.setSize(w, h);
    renderer3D.domElement.style.width = "100%";
    renderer3D.domElement.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(renderer3D.domElement);

    const OC = window.OrbitControls || THREE.OrbitControls;
    if (OC) {
      controls3D = new OC(camera3D, renderer3D.domElement);
      controls3D.enableDamping = true;
      controls3D.dampingFactor = 0.05;
    }

    scene3D.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(1000, 1500, 500);
    scene3D.add(dl);
    const dl2 = new THREE.DirectionalLight(0x8888ff, 0.3);
    dl2.position.set(-1000, 200, -500);
    scene3D.add(dl2);

    palletGroup = new THREE.Group();
    scene3D.add(palletGroup);

    const grid = new THREE.GridHelper(3000, 60, 0x3a3a5c, 0x2a2a3c);
    grid.position.y = -1;
    scene3D.add(grid);

    drag3D.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    drag3D.plane.rotation.x = -Math.PI / 2;
    scene3D.add(drag3D.plane);

    _raycaster3D = new THREE.Raycaster();
    _mouse3D = new THREE.Vector2();
    _intersect3D = new THREE.Vector3();
    drag3D.offset = new THREE.Vector3();
    drag3D.originalPos = new THREE.Vector3();

    renderer3D.domElement.addEventListener("pointerdown", on3DPointerDown);
    renderer3D.domElement.addEventListener("pointermove", on3DPointerMove);
    renderer3D.domElement.addEventListener("pointerup", on3DPointerUp);

    window.addEventListener("keydown", on3DKeyDown);

    animate3D();
  } catch (err) {
    console.error("init3D FAILED:", err);
  }
}

function getPointer3D(e) {
  const el = renderer3D.domElement;
  const rect = el.getBoundingClientRect();
  _mouse3D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  _mouse3D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function getStackHeight(gx, gy, gw, gd, excludeId) {
  const S = window.S;
  let topZ = 0;
  S.layout.forEach((it) => {
    if (it.id === excludeId) return;
    const overlapX = gx < it.x + it.w && gx + gw > it.x;
    const overlapY = gy < it.y + it.d && gy + gd > it.y;
    if (overlapX && overlapY) {
      topZ = Math.max(topZ, it.z + it.h);
    }
  });
  return topZ;
}

function on3DPointerDown(e) {
  if (!window.S || !window.S.isManual) return;
  getPointer3D(e);
  _raycaster3D.setFromCamera(_mouse3D, camera3D);
  const meshes = _draggableSkus.map((d) => d.mesh);
  const hits = _raycaster3D.intersectObjects(meshes, false);
  if (!hits.length) return;

  const hit = hits[0];
  const found = _draggableSkus.find((d) => d.mesh === hit.object);
  if (!found) return;

  const item = found.item;
  const S = window.S;

  const hasSkuOnTop = S.layout.some((other) => {
    if (other.id === item.id) return false;
    if (Math.abs(other.z - (item.z + item.h)) > 0.5) return false;
    return !(
      item.x >= other.x + other.w ||
      item.x + item.w <= other.x ||
      item.y >= other.y + other.d ||
      item.y + item.d <= other.y
    );
  });
  if (hasSkuOnTop) return;

  e.stopPropagation();
  drag3D.active = true;
  drag3D.mesh = found.mesh;
  drag3D.edgeMesh = found.edgeMesh;
  drag3D.item = item;
  drag3D.originalPos = drag3D.mesh.position.clone();
  drag3D.rotationState = 0;
  drag3D.origDims = { w: item.w, d: item.d, h: item.h };

  const planeY = hit.point.y;
  drag3D.plane.position.y = planeY;

  _raycaster3D.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), _intersect3D);
  drag3D.offset.copy(_intersect3D).sub(drag3D.mesh.position);
  drag3D.offset.y = 0;

  drag3D.mesh.material = drag3D.mesh.material.clone();
  drag3D.mesh.material.emissive = new THREE.Color(0x334466);
  drag3D.mesh.material.opacity = 0.85;
  drag3D.mesh.material.transparent = true;

  if (controls3D) controls3D.enabled = false;
  renderer3D.domElement.style.cursor = "grabbing";
}

function on3DPointerMove(e) {
  if (!drag3D.active) {
    if (!window.S || !window.S.isManual) return;
    getPointer3D(e);
    _raycaster3D.setFromCamera(_mouse3D, camera3D);
    const meshes = _draggableSkus.map((d) => d.mesh);
    const hits = _raycaster3D.intersectObjects(meshes, false);
    if (!hits.length) {
      renderer3D.domElement.style.cursor = "default";
      return;
    }
    const found = _draggableSkus.find((d) => d.mesh === hits[0].object);
    if (!found) {
      renderer3D.domElement.style.cursor = "default";
      return;
    }
    const item = found.item;
    const S = window.S;
    const hasSkuOnTop = S.layout.some((other) => {
      if (other.id === item.id) return false;
      if (Math.abs(other.z - (item.z + item.h)) > 0.5) return false;
      return !(
        item.x >= other.x + other.w ||
        item.x + item.w <= other.x ||
        item.y >= other.y + other.d ||
        item.y + item.d <= other.y
      );
    });
    renderer3D.domElement.style.cursor = hasSkuOnTop ? "not-allowed" : "grab";
    return;
  }

  getPointer3D(e);
  _raycaster3D.setFromCamera(_mouse3D, camera3D);

  const planeY = drag3D.plane.position.y;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  if (!_raycaster3D.ray.intersectPlane(plane, _intersect3D)) return;

  const S = window.S;
  const p = window.settingsData.boxes.find((i) => i.id === S.boxId);
  if (!p) return;

  const item = drag3D.item;

  let nx = _intersect3D.x - drag3D.offset.x;
  let nz = _intersect3D.z - drag3D.offset.z;
  nx = Math.max(item.w / 2, Math.min(p.width - item.w / 2, nx));
  nz = Math.max(item.d / 2, Math.min(p.length - item.d / 2, nz));

  const dropX = Math.round(nx - item.w / 2);
  const dropY = Math.round(nz - item.d / 2);

  const best = findClosestFreePosition(dropX, dropY, item, item.id, p.width, p.length);

  drag3D.pendingDrop = best;

  drag3D.mesh.position.x = best.x + item.w / 2;
  drag3D.mesh.position.y = best.z + item.h / 2 + 2;
  drag3D.mesh.position.z = best.y + item.d / 2;
}

function findClosestFreePosition(dropX, dropY, item, excludeId, boxW, boxL) {
  const S = window.S;

  function clamp(cx, cy) {
    return {
      x: Math.max(0, Math.min(cx, boxW - item.w)),
      y: Math.max(0, Math.min(cy, boxL - item.d)),
    };
  }

  function collidesAt(cx, cy, atZ) {
    return S.layout.some((other) => {
      if (other.id === excludeId) return false;
      if (Math.abs(other.z - atZ) > 0.5) return false;
      return !(cx >= other.x + other.w || cx + item.w <= other.x || cy >= other.y + other.d || cy + item.d <= other.y);
    });
  }

  const xAnchors = [0, boxW - item.w];
  const yAnchors = [0, boxL - item.d];

  S.layout.forEach((other) => {
    if (other.id === excludeId) return;
    xAnchors.push(other.x, other.x + other.w, other.x - item.w, other.x + other.w - item.w);
    yAnchors.push(other.y, other.y + other.d, other.y - item.d, other.y + other.d - item.d);
  });

  const uniqueX = [...new Set(xAnchors)];
  const uniqueY = [...new Set(yAnchors)];

  const candidates = [];
  uniqueX.forEach((ax) => {
    uniqueY.forEach((ay) => {
      candidates.push(clamp(ax, ay));
    });
  });

  let best = null;
  let bestDist = Infinity;

  candidates.forEach((c) => {
    const cz = getStackHeight(c.x, c.y, item.w, item.d, excludeId);
    if (collidesAt(c.x, c.y, cz)) return;
    const dx = c.x - dropX;
    const dy = c.y - dropY;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = { x: c.x, y: c.y, z: cz };
    }
  });

  if (!best) {
    const fb = clamp(dropX, dropY);
    return { x: fb.x, y: fb.y, z: getStackHeight(fb.x, fb.y, item.w, item.d, excludeId) };
  }

  return best;
}

function on3DPointerUp(e) {
  if (!drag3D.active) return;
  drag3D.active = false;

  const S = window.S;
  const p = window.settingsData.boxes.find((i) => i.id === S.boxId);
  if (!p) {
    restoreDragSku();
    return;
  }

  const item = drag3D.item;

  const best =
    drag3D.pendingDrop ||
    (() => {
      const rawX = drag3D.mesh.position.x - item.w / 2;
      const rawY = drag3D.mesh.position.z - item.d / 2;
      const dx = Math.round(Math.max(0, Math.min(rawX, p.width - item.w)));
      const dy = Math.round(Math.max(0, Math.min(rawY, p.length - item.d)));
      return findClosestFreePosition(dx, dy, item, item.id, p.width, p.length);
    })();
  drag3D.pendingDrop = null;

  _dragHistory.push({
    itemId: item.id,
    x: item.x,
    y: item.y,
    z: item.z,
    layer: item.layer,
    w: drag3D.origDims ? drag3D.origDims.w : item.w,
    d: drag3D.origDims ? drag3D.origDims.d : item.d,
    h: drag3D.origDims ? drag3D.origDims.h : item.h,
  });
  _lastDragSnapshot = _dragHistory[_dragHistory.length - 1];
  _updateRevertButtons();

  item.x = best.x;
  item.y = best.y;
  item.z = best.z;
  const layerFloors = [...new Set(S.layout.map((i) => i.z))].sort((a, b) => a - b);
  item.layer = layerFloors.indexOf(best.z) + 1 || layerFloors.length + 1;

  drag3D.mesh.position.x = best.x + item.w / 2;
  drag3D.mesh.position.y = best.z + item.h / 2;
  drag3D.mesh.position.z = best.y + item.d / 2;

  if (drag3D.mesh && drag3D.mesh.material) {
    drag3D.mesh.material.emissive = new THREE.Color(0x000000);
    drag3D.mesh.material.transparent = false;
    drag3D.mesh.material.opacity = 1.0;
  }

  if (controls3D) controls3D.enabled = true;
  renderer3D.domElement.style.cursor = "grab";

  drag3D.mesh = null;
  drag3D.edgeMesh = null;
  drag3D.item = null;

  render3DLayout(true);
}

function restoreDragSku() {
  if (drag3D.mesh && drag3D.originalPos) {
    drag3D.mesh.position.copy(drag3D.originalPos);
  }
  if (controls3D) controls3D.enabled = true;
  drag3D.mesh = null;
  drag3D.edgeMesh = null;
  drag3D.item = null;
  drag3D.pendingDrop = null;
}

function getRotatedDims(origW, origD, origH, state) {
  const orientations = [
    [origW, origD, origH],
    [origD, origW, origH],
    [origH, origD, origW],
    [origW, origH, origD],
    [origD, origH, origW],
    [origH, origW, origD],
  ];
  return orientations[state % 6];
}

function on3DKeyDown(e) {
  if (e.key !== "q" && e.key !== "Q") return;
  if (!drag3D.active || !drag3D.item || !drag3D.origDims) return;

  e.preventDefault();

  const item = drag3D.item;
  const p = window.settingsData.boxes.find((i) => i.id === window.S.boxId);
  if (!p) return;

  drag3D.rotationState = (drag3D.rotationState + 1) % 6;
  const [nw, nd, nh] = getRotatedDims(drag3D.origDims.w, drag3D.origDims.d, drag3D.origDims.h, drag3D.rotationState);

  item.w = nw;
  item.d = nd;
  item.h = nh;

  const newGeo = new THREE.BoxGeometry(nw, nh, nd);

  drag3D.mesh.geometry.dispose();
  drag3D.mesh.geometry = newGeo;

  if (drag3D.edgeMesh) {
    drag3D.edgeMesh.geometry.dispose();
    drag3D.edgeMesh.geometry = new THREE.EdgesGeometry(newGeo);
  }

  const currX = drag3D.mesh.position.x;
  const currZ = drag3D.mesh.position.z;
  const dropX = Math.round(Math.max(0, Math.min(currX - nw / 2, p.width - nw)));
  const dropY = Math.round(Math.max(0, Math.min(currZ - nd / 2, p.length - nd)));
  const best = findClosestFreePosition(dropX, dropY, item, item.id, p.width, p.length);
  drag3D.pendingDrop = best;

  drag3D.mesh.position.x = best.x + nw / 2;
  drag3D.mesh.position.y = best.z + nh / 2 + 2;
  drag3D.mesh.position.z = best.y + nd / 2;

  if (window.showToast) window.showToast(`Orientation ${drag3D.rotationState + 1}/6 — ${nw}×${nd}×${nh} cm`, "info");
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if (controls3D) controls3D.update();
  if (renderer3D && scene3D && camera3D) {
    renderer3D.render(scene3D, camera3D);
  }
}

function createDimSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(226,232,240,0.9)";
  ctx.font = "600 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 2;
  return sprite;
}

function createDimArrowLine(start, end) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (!len) return null;
  const d = dir.clone().normalize();
  const headLength = Math.max(0.45, Math.min(1.2, len * 0.09));
  const headWidth = Math.max(0.28, Math.min(0.75, headLength * 0.7));
  const worldUp = new THREE.Vector3(0, 1, 0);
  let side = new THREE.Vector3().crossVectors(d, worldUp);
  if (side.lengthSq() < 1e-6) {
    side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1));
  }
  side.normalize().multiplyScalar(headWidth);
  const back = d.clone().multiplyScalar(headLength);
  const shaftGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const shaftMat = new THREE.LineBasicMaterial({ color: 0xb8c1d1, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(shaftGeom, shaftMat);

  const headMat = new THREE.MeshBasicMaterial({
    color: 0xb8c1d1,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
  });

  const sTip = start.clone();
  const sBaseA = start.clone().add(back).add(side);
  const sBaseB = start.clone().add(back).sub(side);
  const sGeom = new THREE.BufferGeometry();
  sGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [sTip.x, sTip.y, sTip.z, sBaseA.x, sBaseA.y, sBaseA.z, sBaseB.x, sBaseB.y, sBaseB.z],
      3,
    ),
  );
  sGeom.computeVertexNormals();
  const startHead = new THREE.Mesh(sGeom, headMat);

  const eTip = end.clone();
  const eBaseA = end.clone().sub(back).add(side);
  const eBaseB = end.clone().sub(back).sub(side);
  const eGeom = new THREE.BufferGeometry();
  eGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [eTip.x, eTip.y, eTip.z, eBaseA.x, eBaseA.y, eBaseA.z, eBaseB.x, eBaseB.y, eBaseB.z],
      3,
    ),
  );
  eGeom.computeVertexNormals();
  const endHead = new THREE.Mesh(eGeom, headMat);

  const grp = new THREE.Group();
  grp.add(line);
  grp.add(startHead);
  grp.add(endHead);
  return grp;
}

function render3DLayout(keepCamera = false) {
  if (!palletGroup || !renderer3D || !scene3D) return;

  const S = window.S;
  const sd = window.settingsData;
  if (!S || !sd) return;

  const _fallbackP = sd.boxes.find((i) => i.active) || sd.boxes[0];
  if (!_fallbackP) return;

  const container = document.getElementById("three-container");
  if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
    const w = container.offsetWidth,
      h = container.offsetHeight;
    camera3D.aspect = w / h;
    camera3D.updateProjectionMatrix();
    renderer3D.setSize(w, h);
  }

  while (palletGroup.children.length > 0) {
    palletGroup.remove(palletGroup.children[0]);
  }
  _draggableSkus = [];

  const viewAll = S.activeBoxIdx === -1;
  let boxesToRender = [];
  if (viewAll) {
    let boxSignature = "";
    S.boxesData.forEach((pd) => {
      let boxCountId = pd.boxId;
      Object.keys(pd.placedQty).forEach((key) => {
        boxCountId += key + pd.placedQty[key];
      });
      if (boxCountId != boxSignature) {
        boxSignature = boxCountId;
        boxesToRender.push(pd);
      }
    });
  } else {
    boxesToRender = [S.boxesData[S.activeBoxIdx]];
  }
  if (!boxesToRender || !boxesToRender.length || !boxesToRender[0]) return;

  let curOffsetX = 0;
  let totalRenderWidth = 0;
  boxesToRender.forEach((pd) => {
    if (!pd) return;
    const _p = sd.boxes.find((i) => i.id === pd.boxId) || _fallbackP;
    totalRenderWidth += _p.width + _p.width * 0.3;
  });

  boxesToRender.forEach((pd, renderIdx) => {
    if (!pd) return;
    const p = sd.boxes.find((i) => i.id === pd.boxId) || _fallbackP;
    const GAP = p.width * 0.3;

    const palletGrp = new THREE.Group();
    palletGrp.position.x = curOffsetX;
    palletGroup.add(palletGrp);
    curOffsetX += p.width + GAP;

    const palletBase = new THREE.Mesh(
      new THREE.BoxGeometry(p.width, 4, p.length),
      new THREE.MeshLambertMaterial({ color: 0xb0b8c8 }),
    );
    palletBase.position.set(p.width / 2, -2, p.length / 2);
    palletGrp.add(palletBase);

    const refH = sd.boxes.find((pl) => pl.id === pd.boxId)?.height || 0;
    if (refH > 0) {
      const boundsGeom = new THREE.BoxGeometry(p.width, refH, p.length);
      const edges = new THREE.EdgesGeometry(boundsGeom);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.2 }),
      );
      line.position.set(p.width / 2, refH / 2, p.length / 2);
      palletGrp.add(line);

      if (!viewAll) {
        const labelScale = Math.max(6, Math.min(p.width, p.length) * 0.45);
        const wGuideY = 1.5;
        const wGuideZ = p.length + 6;
        const wLabel = createDimSprite(`${p.width} cm`);
        if (wLabel) {
          wLabel.scale.set(labelScale * 1.2, labelScale * 0.45, 1);
          wLabel.position.set(p.width / 2, wGuideY, wGuideZ + 1.8);
          const wArrow = createDimArrowLine(
            new THREE.Vector3(0, wGuideY, wGuideZ),
            new THREE.Vector3(p.width, wGuideY, wGuideZ),
          );
          if (wArrow) palletGrp.add(wArrow);
          palletGrp.add(wLabel);
        }
        const lGuideY = 1.5;
        const lGuideX = -6;
        const lLabel = createDimSprite(`${p.length} cm`);
        if (lLabel) {
          lLabel.scale.set(labelScale * 1.2, labelScale * 0.45, 1);
          lLabel.position.set(lGuideX - 1.8, lGuideY, p.length / 2);
          const lArrow = createDimArrowLine(
            new THREE.Vector3(lGuideX, lGuideY, 0),
            new THREE.Vector3(lGuideX, lGuideY, p.length),
          );
          if (lArrow) palletGrp.add(lArrow);
          palletGrp.add(lLabel);
        }
        const hGuideX = lGuideX;
        const hGuideZ = wGuideZ;
        const hLabel = createDimSprite(`${refH} cm`);
        if (hLabel) {
          hLabel.scale.set(labelScale * 1.1, labelScale * 0.45, 1);
          hLabel.position.set(hGuideX - 1.8, refH / 2, hGuideZ);
          const hArrow = createDimArrowLine(new THREE.Vector3(hGuideX, 0, hGuideZ), new THREE.Vector3(hGuideX, refH, hGuideZ));
          if (hArrow) palletGrp.add(hArrow);
          palletGrp.add(hLabel);
        }
      }
    }

    if (boxesToRender.length > 1) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 72;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, 256, 72);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Box ${renderIdx + 1}`, 128, 26);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#aaaacc";
      ctx.fillText(p.name, 128, 46);
      ctx.fillText(`${pd.layout.length} SKUs · ${pd.totalWeight.toFixed(1)} kg`, 128, 64);
      const tex = new THREE.CanvasTexture(canvas);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      labelMesh.position.set(p.width / 2, (refH || pd.actualHeight || 50) + 10, p.length / 2);
      labelMesh.rotation.x = -Math.PI / 8;
      palletGrp.add(labelMesh);
    }

    const isDraggable = !viewAll && S.isManual;
    pd.layout.forEach((item) => {
      const bw = item.w;
      const bh = item.h;
      const bd = item.d;

      const boxGeom = new THREE.BoxGeometry(bw, bh, bd);
      const boxMat = new THREE.MeshLambertMaterial({ color: item.color || "#3B82F6" });

      const boxMesh = new THREE.Mesh(boxGeom, boxMat);

      boxMesh.position.x = item.x + item.w / 2;
      boxMesh.position.y = item.z + item.h / 2;
      boxMesh.position.z = item.y + item.d / 2;

      palletGrp.add(boxMesh);

      const bEdges = new THREE.EdgesGeometry(boxMesh.geometry);
      const bLine = new THREE.LineSegments(
        bEdges,
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
      );

      boxMesh.add(bLine);

      if (isDraggable) {
        _draggableSkus.push({ mesh: boxMesh, edgeMesh: bLine, item });
      }
    });
  });

  if (!keepCamera) {
    const refH = S.actualHeight || _fallbackP?.height || _fallbackP?.length || 160;
    const centerX = totalRenderWidth / 2 - _fallbackP.width / 2;
    const dist = Math.max(totalRenderWidth, _fallbackP.length, refH, 50) * 1.5;
    camera3D.position.set(centerX + 1, dist * 0.7, dist);
    if (controls3D) {
      controls3D.target.set(centerX, refH / 3, 0);
      controls3D.update();
    }
  }
}

window.render3DLayout = render3DLayout;
window.init3D = init3D;
window._dragHistory = _dragHistory;
window._getDragHistory = () => _dragHistory;
window._resetDragHistory = () => {
  _dragHistory.length = 0;
  _lastDragSnapshot = null;
};
window._popDragHistory = () => _dragHistory.pop();
window._updateRevertButtons = _updateRevertButtons;
