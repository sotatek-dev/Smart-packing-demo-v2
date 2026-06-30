const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { randomUUID } = require("crypto");
const { runPacking } = require("./packingEngine");
const { store, persist } = require("./store");
const swaggerSpec = require("./swagger");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

function normalizeBox(b) {
  return {
    id: b.id || "box_" + randomUUID(),
    name: b.name || "",
    type: b.type || "",
    width: Number(b.width) || 0,
    length: Number(b.length) || 0,
    height: Number(b.height) || 0,
    weight: Number(b.weight) || 0,
    loadLimit: Number(b.loadLimit) || 0,
    active: b.active !== false,
  };
}

function normalizeSku(s) {
  const id = s.sku_id || s.id || "sku_" + randomUUID();
  return {
    id,
    sku_id: id,
    name: s.name || "New SKU",
    width: Number(s.width) || 10,
    length: Number(s.length) || 10,
    height: Number(s.height) || 10,
    weight: Number(s.weight) || 1,
    color: s.color || "#3B82F6",
    active: s.active !== false,
  };
}

function validateDims(obj, label) {
  ["width", "length", "height"].forEach((k) => {
    if (!(Number(obj[k]) > 0)) {
      throw new Error(`${label} "${obj.name || obj.id}" has invalid ${k}: must be > 0`);
    }
  });
}

// ─── Boxes CRUD ─────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/boxes:
 *   get:
 *     summary: List all box templates
 *     tags: [Boxes]
 *     responses:
 *       200:
 *         description: Array of boxes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Box' }
 */
app.get("/api/boxes", (req, res) => {
  res.json(store.boxes);
});

/**
 * @swagger
 * /api/boxes:
 *   post:
 *     summary: Create a new box template
 *     tags: [Boxes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BoxInput' }
 *     responses:
 *       201:
 *         description: The created box
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Box' }
 */
app.post("/api/boxes", (req, res) => {
  const box = normalizeBox(req.body || {});
  store.boxes.unshift(box);
  persist();
  res.status(201).json(box);
});

/**
 * @swagger
 * /api/boxes/{id}:
 *   put:
 *     summary: Update a box template
 *     tags: [Boxes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BoxInput' }
 *     responses:
 *       200:
 *         description: The updated box
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Box' }
 *       404:
 *         description: Box not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.put("/api/boxes/:id", (req, res) => {
  const idx = store.boxes.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Box not found" });
  store.boxes[idx] = normalizeBox({ ...store.boxes[idx], ...req.body, id: req.params.id });
  persist();
  res.json(store.boxes[idx]);
});

/**
 * @swagger
 * /api/boxes/{id}:
 *   delete:
 *     summary: Delete a box template
 *     tags: [Boxes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Box not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.delete("/api/boxes/:id", (req, res) => {
  const before = store.boxes.length;
  store.boxes = store.boxes.filter((b) => b.id !== req.params.id);
  if (store.boxes.length === before) return res.status(404).json({ error: "Box not found" });
  persist();
  res.status(204).end();
});

// ─── SKUs CRUD ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/skus:
 *   get:
 *     summary: List all SKUs
 *     tags: [SKUs]
 *     responses:
 *       200:
 *         description: Array of SKUs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Sku' }
 */
app.get("/api/skus", (req, res) => {
  res.json(store.skus);
});

/**
 * @swagger
 * /api/skus:
 *   post:
 *     summary: Create a new SKU
 *     tags: [SKUs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SkuInput' }
 *     responses:
 *       201:
 *         description: The created SKU
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Sku' }
 */
app.post("/api/skus", (req, res) => {
  const sku = normalizeSku(req.body || {});
  store.skus.unshift(sku);
  persist();
  res.status(201).json(sku);
});

/**
 * @swagger
 * /api/skus/{id}:
 *   put:
 *     summary: Update a SKU
 *     tags: [SKUs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SkuInput' }
 *     responses:
 *       200:
 *         description: The updated SKU
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Sku' }
 *       404:
 *         description: SKU not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.put("/api/skus/:id", (req, res) => {
  const idx = store.skus.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "SKU not found" });
  store.skus[idx] = normalizeSku({ ...store.skus[idx], ...req.body, id: req.params.id });
  persist();
  res.json(store.skus[idx]);
});

/**
 * @swagger
 * /api/skus/{id}:
 *   delete:
 *     summary: Delete a SKU
 *     tags: [SKUs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: SKU not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.delete("/api/skus/:id", (req, res) => {
  const before = store.skus.length;
  store.skus = store.skus.filter((s) => s.id !== req.params.id);
  if (store.skus.length === before) return res.status(404).json({ error: "SKU not found" });
  persist();
  res.status(204).end();
});

// ─── Combined settings (matches the frontend's fetchSettings shape) ─────
/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get combined boxes + skus settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Combined settings
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Settings' }
 */
app.get("/api/settings", (req, res) => {
  res.json({ boxes: store.boxes, skus: store.skus });
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Bulk-replace boxes and/or skus
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               boxes: { type: array, items: { $ref: '#/components/schemas/BoxInput' } }
 *               skus: { type: array, items: { $ref: '#/components/schemas/SkuInput' } }
 *     responses:
 *       200:
 *         description: The updated combined settings
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Settings' }
 */
app.put("/api/settings", (req, res) => {
  const { boxes, skus } = req.body || {};
  if (Array.isArray(boxes)) store.boxes = boxes.map(normalizeBox);
  if (Array.isArray(skus)) store.skus = skus.map(normalizeSku);
  persist();
  res.json({ boxes: store.boxes, skus: store.skus });
});

// ─── Optimize ────────────────────────────────────────────────────────────
// Shared core: validates boxes/skus and runs the packing engine.
function runOptimize(boxes, skus) {
  if (!boxes.length) {
    const err = new Error("No active box templates found");
    err.status = 400;
    throw err;
  }
  if (!skus.length) {
    const err = new Error("Please select at least one SKU with quantity > 0");
    err.status = 400;
    throw err;
  }

  boxes.forEach((b) => validateDims(b, "Box"));
  skus.forEach((s) => validateDims(s, "SKU"));

  return runPacking(skus, boxes);
}

/**
 * @swagger
 * /api/optimize/stateless:
 *   post:
 *     summary: Run the packing optimizer (stateless)
 *     description: >
 *       Pass `boxes` and `skus` (each sku needs a `qty`) directly in the request body.
 *       Nothing is read from or written to the stored boxes/skus.
 *     tags: [Optimize]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OptimizeRequestStateless' }
 *     responses:
 *       200:
 *         description: Packing result
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OptimizeResponse' }
 *       400:
 *         description: Invalid request (no active boxes/skus, bad dimensions, etc.)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.post("/api/optimize/stateless", (req, res) => {
  try {
    const { boxes: boxesIn, skus: skusIn } = req.body || {};

    if (!Array.isArray(boxesIn) || !Array.isArray(skusIn)) {
      return res.status(400).json({ error: "Stateless mode requires both `boxes` and `skus` arrays" });
    }

    const boxes = boxesIn.filter((b) => b.active !== false).map(normalizeBox);
    const skus = skusIn
      .filter((s) => s.active !== false)
      .map((s) => ({ ...normalizeSku(s), qty: Number(s.qty) || 0 }))
      .filter((s) => s.qty > 0);

    const result = runOptimize(boxes, skus);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/optimize/stateful:
 *   post:
 *     summary: Run the packing optimizer (stateful)
 *     description: >
 *       Uses the boxes/skus already saved via the CRUD endpoints. Pass
 *       `quantities: { [skuId]: qty }` to specify how many of each saved SKU to pack.
 *     tags: [Optimize]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OptimizeRequestStateful' }
 *     responses:
 *       200:
 *         description: Packing result
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OptimizeResponse' }
 *       400:
 *         description: Invalid request (no active boxes/skus, bad dimensions, etc.)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.post("/api/optimize/stateful", (req, res) => {
  try {
    const { quantities } = req.body || {};

    const boxes = store.boxes.filter((b) => b.active);
    const skus = store.skus
      .filter((s) => s.active)
      .map((s) => ({ ...s, qty: (quantities && quantities[s.id]) || 0 }))
      .filter((s) => s.qty > 0);

    const result = runOptimize(boxes, skus);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 */
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Packing engine API listening on port ${PORT}`);
  });
}

module.exports = app;
