/**
 * Box Packing Engine
 * Ported 1:1 from the frontend Guillotine-Cut packing algorithm.
 *
 * Axis mapping (engine → layout item)
 *   item.length → layout.w  (box x-axis / width)
 *   item.width  → layout.d  (box z-axis / length/depth)
 *   item.height → layout.h  (y-axis / upward)
 *   placement.x → layout.x
 *   placement.z → layout.z  (depth position in box)
 *   placement.y → layout.y  (height off box floor, used for layers)
 */

const FREIGHT_TARIFF_PER_KG = 8;

/**
 * Generate all unique 3D orientations (up to 6).
 */
function generateRotations(l, w, h) {
  const rots = [
    { length: l, width: w, height: h },
    { length: l, width: h, height: w },
    { length: w, width: l, height: h },
    { length: w, width: h, height: l },
    { length: h, width: l, height: w },
    { length: h, width: w, height: l },
  ];
  const unique = [];
  rots.forEach((r) => {
    if (
      !unique.some(
        (u) => u.length === r.length && u.width === r.width && u.height === r.height,
      )
    )
      unique.push(r);
  });
  return unique;
}

/**
 * Guillotine Cut — find the best space for an item.
 * Spaces sorted lowest-y first (gravity), then nearest origin.
 * Tries all rotations per space. Returns { x,y,z,length,width,height } or null.
 */
function findBestPlacement(spaces, item) {
  let best = null;
  let bestTopHeight = Infinity;

  for (const space of spaces) {
    for (const rot of item.rotations) {
      if (rot.length <= space.length && rot.width <= space.width && rot.height <= space.height) {
        const topHeight = space.y + rot.height;
        if (
          topHeight < bestTopHeight ||
          (topHeight === bestTopHeight && space.x + space.z < (best?.x + best?.z ?? Infinity))
        ) {
          bestTopHeight = topHeight;
          best = {
            x: space.x,
            y: space.y,
            z: space.z,
            length: rot.length,
            width: rot.width,
            height: rot.height,
            spaceId: space.id,
          };
        }
      }
    }
  }

  return best;
}

function updateSpaces(spaces, placement) {
  let newSpaces = [];

  for (let sp of spaces) {
    if (
      placement.x >= sp.x + sp.length ||
      placement.x + placement.length <= sp.x ||
      placement.y >= sp.y + sp.height ||
      placement.y + placement.height <= sp.y ||
      placement.z >= sp.z + sp.width ||
      placement.z + placement.width <= sp.z
    ) {
      newSpaces.push(sp);
      continue;
    }

    const x1 = sp.x;
    const x2 = sp.x + sp.length;
    const y1 = sp.y;
    const y2 = sp.y + sp.height;
    const z1 = sp.z;
    const z2 = sp.z + sp.width;

    const px1 = placement.x;
    const px2 = placement.x + placement.length;
    const py1 = placement.y;
    const py2 = placement.y + placement.height;
    const pz1 = placement.z;
    const pz2 = placement.z + placement.width;

    if (px1 > x1) {
      newSpaces.push({ x: x1, y: y1, z: z1, length: px1 - x1, width: sp.width, height: sp.height });
    }
    if (px2 < x2) {
      newSpaces.push({ x: px2, y: y1, z: z1, length: x2 - px2, width: sp.width, height: sp.height });
    }
    if (pz1 > z1) {
      newSpaces.push({ x: x1, y: y1, z: z1, length: sp.length, width: pz1 - z1, height: sp.height });
    }
    if (pz2 < z2) {
      newSpaces.push({ x: x1, y: y1, z: pz2, length: sp.length, width: z2 - pz2, height: sp.height });
    }
    if (py2 < y2) {
      newSpaces.push({ x: x1, y: py2, z: z1, length: sp.length, width: sp.width, height: y2 - py2 });
    }
  }

  return pruneSpaces(newSpaces);
}

function pruneSpaces(spaces) {
  return spaces.filter(
    (a, i) =>
      !spaces.some((b, j) => {
        if (i === j) return false;
        return (
          a.x >= b.x &&
          a.y >= b.y &&
          a.z >= b.z &&
          a.x + a.length <= b.x + b.length &&
          a.y + a.height <= b.y + b.height &&
          a.z + a.width <= b.z + b.width
        );
      }),
  );
}

/**
 * Pack as many items as possible into one container (boxDim).
 * boxDim: { width (x), depth (z), height (y) }
 */
function tryPackInBox(items, boxType, boxDim) {
  const box = {
    type: boxType,
    dimensions: boxDim,
    items: [],
    spaces: [{ x: 0, y: 0, z: 0, length: boxDim.width, width: boxDim.depth, height: boxDim.height }],
  };
  let runningWeight = 0;
  const maxWeight = boxDim.loadLimit != null ? boxDim.loadLimit : Infinity;
  [...items]
    .sort((a, b) => b.volume - a.volume)
    .forEach((item) => {
      if (runningWeight + (item.weight || 0) > maxWeight) return;
      const pl = findBestPlacement(box.spaces, item, boxDim);
      if (pl) {
        box.items.push({ ...item, ...pl });
        box.spaces = updateSpaces(box.spaces, pl, item);
        runningWeight += item.weight || 0;
      }
    });
  return box;
}

/** Fallback: force the single largest item into the container. */
function forcePackLargest(items, BOX_TYPES) {
  if (!items.length) return null;
  const keys = Object.keys(BOX_TYPES);
  const boxType = keys[keys.length - 1];
  const boxDim = BOX_TYPES[boxType];
  const box = {
    type: boxType,
    dimensions: boxDim,
    items: [],
    spaces: [{ x: 0, y: 0, z: 0, length: boxDim.width, width: boxDim.depth, height: boxDim.height }],
  };
  const maxWeight = boxDim.loadLimit != null ? boxDim.loadLimit : Infinity;
  if ((items[0].weight || 0) > maxWeight) return null;
  const pl = findBestPlacement(box.spaces, items[0], boxDim);
  if (pl) {
    box.items.push({ ...items[0], ...pl });
    return box;
  }
  return null;
}

function calculateTotalVolume(boxes) {
  return boxes.reduce((s, b) => s + b.dimensions.width * b.dimensions.height * b.dimensions.depth, 0);
}

function getVolumetricWeight(box, divisor = 6000) {
  return (box.length * box.width * box.height) / divisor;
}

function calculateFreightCostForPackedBox(packedBox) {
  const boxDim = packedBox.dimensions || {};
  const itemsWeight = packedBox.items.reduce((s, i) => s + (i.weight || 0), 0);
  const boxOwnWeight = boxDim.boxWeight || 0;
  const totalWeightWithBox = itemsWeight + boxOwnWeight;

  const volumetricWeight = getVolumetricWeight({
    length: boxDim.depth,
    width: boxDim.width,
    height: boxDim.height,
  });

  const chargeableWeight = Math.max(totalWeightWithBox, volumetricWeight);
  return chargeableWeight * FREIGHT_TARIFF_PER_KG;
}

function calculateChargeableWeightForPackedBox(packedBox) {
  const boxDim = packedBox.dimensions || {};
  const itemsWeight = packedBox.items.reduce((s, i) => s + (i.weight || 0), 0);
  const boxOwnWeight = boxDim.boxWeight || 0;
  const totalWeightWithBox = itemsWeight + boxOwnWeight;
  const volumetricWeight = getVolumetricWeight({
    length: boxDim.depth,
    width: boxDim.width,
    height: boxDim.height,
  });
  return Math.max(totalWeightWithBox, volumetricWeight);
}

function calculateTotalFreightCost(packedBoxes) {
  return packedBoxes.reduce((sum, b) => sum + calculateFreightCostForPackedBox(b), 0);
}

// ── Strategy 1: First-Fit Decreasing ──────────────────────────────────
function packWithSmallestFirst(items, BOX_TYPES) {
  const boxes = [];
  const remaining = [...items];

  while (remaining.length) {
    let packed = false;
    for (const [type, dim] of Object.entries(BOX_TYPES)) {
      const res = tryPackInBox(remaining, type, dim);
      if (res.items.length) {
        boxes.push(res);
        res.items.forEach((pi) => {
          const i = remaining.findIndex((x) => x._uid === pi._uid);
          if (i !== -1) remaining.splice(i, 1);
        });
        packed = true;
        break;
      }
    }
    if (!packed) {
      const res = forcePackLargest(remaining, BOX_TYPES);
      if (res) {
        boxes.push(res);
        const i = remaining.findIndex((x) => x._uid === res.items[0]._uid);
        if (i !== -1) remaining.splice(i, 1);
      } else break;
    }
  }
  return boxes;
}

// ── Strategy 2: Best-Fit with Maximum Fill Rate ────────────────────────
function packWithMaxFill(items, BOX_TYPES) {
  const boxes = [];
  const remaining = [...items];
  while (remaining.length) {
    let bestBox = null;
    let bestEff = 0;
    for (const [type, dim] of Object.entries(BOX_TYPES)) {
      const res = tryPackInBox([...remaining], type, dim);
      if (res.items.length) {
        const eff = res.items.reduce((s, i) => s + i.volume, 0) / (dim.width * dim.height * dim.depth);
        if (eff > bestEff) {
          bestEff = eff;
          bestBox = res;
        }
      }
    }
    if (bestBox) {
      boxes.push(bestBox);
      bestBox.items.forEach((pi) => {
        const i = remaining.findIndex((x) => x._uid === pi._uid);
        if (i !== -1) remaining.splice(i, 1);
      });
    } else {
      const res = forcePackLargest(remaining, BOX_TYPES);
      if (res) {
        boxes.push(res);
        const i = remaining.findIndex((x) => x._uid === res.items[0]._uid);
        if (i !== -1) remaining.splice(i, 1);
      } else break;
    }
  }
  return boxes;
}

// ── Strategy 3: Similar-Size Clustering ───────────────────────────────
function packBySimilarSize(items, BOX_TYPES) {
  const boxes = [];
  const remaining = [...items].sort((a, b) => b.volume - a.volume);
  while (remaining.length) {
    const ref = remaining[0];
    let bestBox = null;
    for (const [type, dim] of Object.entries(BOX_TYPES)) {
      if (tryPackInBox([ref], type, dim).items.length) {
        const similar = remaining
          .slice(1)
          .filter((it) => it.volume >= ref.volume * 0.3 && it.volume <= ref.volume * 1.5);
        const res = tryPackInBox([ref, ...similar], type, dim);
        if (!bestBox || res.items.length > bestBox.items.length) bestBox = res;
      }
    }
    if (bestBox && bestBox.items.length) {
      boxes.push(bestBox);
      bestBox.items.forEach((pi) => {
        const i = remaining.findIndex((x) => x._uid === pi._uid);
        if (i !== -1) remaining.splice(i, 1);
      });
    } else {
      const res = forcePackLargest(remaining, BOX_TYPES);
      if (res) {
        boxes.push(res);
        const i = remaining.findIndex((x) => x._uid === res.items[0]._uid);
        if (i !== -1) remaining.splice(i, 1);
      } else break;
    }
  }
  return boxes;
}

// ── Strategy 4: Minimize Total Chargeable Weight (Global, beam search) ─
function packByMinChargeableWeight(items, BOX_TYPES) {
  const BEAM_WIDTH = 4;
  const startState = { remaining: [...items], boxes: [], score: 0, count: 0 };

  let states = [startState];
  let bestState = null;

  const betterGlobal = (a, b) => {
    if (a.count !== b.count) return a.count > b.count;
    return a.score < b.score;
  };
  const beamCompare = (a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.count - a.count;
  };

  const maxIters = Math.max(1, items.length);
  for (let iter = 0; iter < maxIters; iter++) {
    const next = [];
    let anyProgress = false;

    for (const st of states) {
      if (!st.remaining.length) {
        next.push(st);
        if (!bestState || betterGlobal(st, bestState)) bestState = st;
        continue;
      }

      let generated = false;
      for (const [type, dim] of Object.entries(BOX_TYPES)) {
        const res = tryPackInBox(st.remaining, type, dim);
        if (!res.items.length) continue;
        generated = true;
        anyProgress = true;

        const packedIds = new Set(res.items.map((x) => x._uid));
        const nextRemaining = st.remaining.filter((x) => !packedIds.has(x._uid));
        next.push({
          remaining: nextRemaining,
          boxes: st.boxes.concat([res]),
          score: st.score + calculateChargeableWeightForPackedBox(res),
          count: st.count + res.items.length,
        });
      }

      if (!generated) {
        const res = forcePackLargest(st.remaining, BOX_TYPES);
        if (res && res.items.length) {
          anyProgress = true;
          const packedIds = new Set(res.items.map((x) => x._uid));
          const nextRemaining = st.remaining.filter((x) => !packedIds.has(x._uid));
          next.push({
            remaining: nextRemaining,
            boxes: st.boxes.concat([res]),
            score: st.score + calculateChargeableWeightForPackedBox(res),
            count: st.count + res.items.length,
          });
        }
      }
    }

    if (!anyProgress || !next.length) break;
    next.sort(beamCompare);
    states = next.slice(0, BEAM_WIDTH);
    for (const st of states) {
      if (!bestState || betterGlobal(st, bestState)) bestState = st;
    }
  }

  return bestState && bestState.boxes.length ? bestState.boxes : [];
}

/**
 * packItemsIntoBoxes — MAIN ALGORITHM
 * Runs all 4 strategies and returns the best overall result.
 */
function packItemsIntoBoxes(items, BOX_TYPES) {
  const strategies = [
    packWithSmallestFirst(items, BOX_TYPES),
    packWithMaxFill(items, BOX_TYPES),
    packBySimilarSize(items, BOX_TYPES),
    packByMinChargeableWeight(items, BOX_TYPES),
  ];

  const countItems = (boxes) => boxes.reduce((s, b) => s + b.items.length, 0);

  let best = strategies[0];
  let bestCount = countItems(strategies[0]);
  let bestCost = calculateTotalFreightCost(strategies[0]);
  let bestVol = calculateTotalVolume(strategies[0]);
  for (let i = 1; i < strategies.length; i++) {
    const count = countItems(strategies[i]);
    const cost = calculateTotalFreightCost(strategies[i]);
    const vol = calculateTotalVolume(strategies[i]);
    if (
      count > bestCount ||
      (count === bestCount && cost < bestCost) ||
      (count === bestCount && cost === bestCost && vol < bestVol)
    ) {
      best = strategies[i];
      bestCount = count;
      bestCost = cost;
      bestVol = vol;
    }
  }
  return best; // array of packed-container objects
}

/**
 * High level entry point.
 *
 * @param {Array} skus - [{ id, name, width, length, height, weight, color, qty }]
 * @param {Array} boxes - [{ id, name, width, length, height, weight, loadLimit }]
 * @returns {Object} { boxes: [...], summary: {...} }
 */
function runPacking(skus, boxes) {
  // 1. Expand SKU quantities into individual item instances
  const rawSkus = [];
  skus.forEach((b) => {
    const qty = Number(b.qty) || 0;
    for (let i = 0; i < qty; i++) rawSkus.push(b);
  });
  if (!rawSkus.length) {
    return { boxes: [], summary: emptySummary() };
  }

  // 2. Convert to packing-engine item format
  const items = rawSkus.map((b, idx) => ({
    _uid: idx,
    id: b.id,
    name: b.name,
    color: b.color || "#3B82F6",
    weight: Number(b.weight) || 0,
    volume: Number(b.width) * Number(b.length) * Number(b.height),
    length: Number(b.width),
    width: Number(b.length),
    height: Number(b.height),
    rotations: generateRotations(Number(b.width), Number(b.length), Number(b.height)),
  }));
  items.sort((a, b) => b.volume - a.volume);

  // 3. Build BOX_TYPES from active boxes
  const BOX_TYPES = {};
  boxes.forEach((p) => {
    BOX_TYPES[p.id] = {
      width: Number(p.width),
      depth: Number(p.length),
      height: Number(p.height) || 160,
      name: p.name,
      boxWeight: Number(p.weight) || 0,
      loadLimit: p.loadLimit != null ? Number(p.loadLimit) : Infinity,
    };
  });

  if (!Object.keys(BOX_TYPES).length) {
    throw new Error("No box types provided");
  }

  // 4. Run the main algorithm
  const packedBoxes = packItemsIntoBoxes(items, BOX_TYPES);

  // 5. Build one layout per packed box (same shape as the frontend's S.boxesData)
  const boxesData = [];
  let globalSeq = 0;

  packedBoxes.forEach((pb) => {
    const p = boxes.find((i) => i.id === pb.type) || boxes[0];

    const layout = [];
    const layerDefs = [];
    let runningWeight = 0;
    const allPlaced = pb.items;

    allPlaced.forEach((item) => {
      runningWeight += item.weight || 0;
    });

    const yValues = [...new Set(allPlaced.map((i) => i.y))].sort((a, b) => a - b);
    const yToLayer = {};
    yValues.forEach((y, idx) => {
      yToLayer[y] = idx;
    });
    yValues.forEach(() => layerDefs.push({ baseZ: 0, maxH: 0, footprint: [], items: [] }));

    allPlaced.forEach((item) => {
      const li = yToLayer[item.y];
      const ld = layerDefs[li];
      const layoutItem = {
        id: globalSeq++,
        type: item.id,
        x: item.x,
        y: item.z,
        z: item.y,
        layer: li + 1,
        w: item.length,
        d: item.width,
        h: item.height,
        kg: item.weight,
        color: item.color,
        name: item.name,
      };
      layout.push(layoutItem);
      ld.items.push(layoutItem);
      ld.footprint.push({
        x1: item.x,
        y1: item.z,
        x2: item.x + item.length,
        y2: item.z + item.width,
      });
      if (item.height > ld.maxH) ld.maxH = item.height;
    });

    const actualHeight = layout.length ? Math.max(...layout.map((i) => i.z + i.h)) : 0;
    const placedQty = {};
    layout.forEach((item) => {
      placedQty[item.type] = (placedQty[item.type] || 0) + 1;
    });

    boxesData.push({
      boxId: p.id,
      boxName: p.name,
      layout,
      layerDefs,
      totalWeight: runningWeight,
      actualHeight,
      placedQty,
      freightCost: calculateFreightCostForPackedBox(pb),
      chargeableWeight: calculateChargeableWeightForPackedBox(pb),
      dimensions: pb.dimensions,
    });
  });

  // 6. Summary stats
  const totalSkusRequested = rawSkus.length;
  const totalSkusPacked = boxesData.reduce((s, b) => s + b.layout.length, 0);
  const totalWeight = boxesData.reduce((s, b) => s + b.totalWeight, 0);
  const totalFreightCost = boxesData.reduce((s, b) => s + b.freightCost, 0);
  const usedVolume = boxesData.reduce(
    (s, b) => s + b.layout.reduce((s2, i) => s2 + i.w * i.d * i.h, 0),
    0,
  );
  const totalVolume = boxesData.reduce((s, b) => s + b.dimensions.width * b.dimensions.depth * b.dimensions.height, 0);

  return {
    boxes: boxesData,
    summary: {
      totalBoxesUsed: boxesData.length,
      totalSkusRequested,
      totalSkusPacked,
      unpackedCount: totalSkusRequested - totalSkusPacked,
      totalWeight: round2(totalWeight),
      totalFreightCost: round2(totalFreightCost),
      spaceEfficiencyPct: totalVolume ? round2((usedVolume / totalVolume) * 100) : 0,
    },
  };
}

function emptySummary() {
  return {
    totalBoxesUsed: 0,
    totalSkusRequested: 0,
    totalSkusPacked: 0,
    unpackedCount: 0,
    totalWeight: 0,
    totalFreightCost: 0,
    spaceEfficiencyPct: 0,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  runPacking,
  generateRotations,
  FREIGHT_TARIFF_PER_KG,
};
