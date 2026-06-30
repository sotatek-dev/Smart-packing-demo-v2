# Packing Engine API

Express backend for the 3D box/pallet packing optimizer. The packing algorithm
(`src/packingEngine.js`) is a faithful port of the Guillotine-Cut engine from
the `index.html` frontend — it runs all 4 packing strategies (First-Fit
Decreasing, Best-Fit Max-Fill, Similar-Size Clustering, and a beam-search
Min-Chargeable-Weight strategy) and returns whichever packs the most items at
the lowest freight cost.

## Setup

```bash
npm install
npm start          # production: node src/server.js, listens on PORT (default 3000)
npm run dev         # development: nodemon src/server.js, auto-restarts on changes in src/
```

## API Docs (Swagger)

Interactive API docs are served by Swagger UI once the server is running:

- **Swagger UI:** http://localhost:3000/api-docs
- **Raw OpenAPI 3.0 spec (JSON):** http://localhost:3000/api-docs.json

Start the server (`npm start` or `npm run dev`) and open the Swagger UI link
in your browser to explore and call every endpoint — boxes/SKUs CRUD,
settings, `/api/optimize`, and `/api/health` — directly from the page,
including example request/response bodies for each schema.

The spec is generated from JSDoc `@swagger` annotations above each route in
`src/server.js`, built with `swagger-jsdoc`, and rendered with
`swagger-ui-express` (see `src/swagger.js` for the base spec/schema
definitions). If you add or change an endpoint, update its `@swagger` block
and the docs regenerate automatically the next time the server starts.

If you're running on a different port (`PORT=xxxx npm start`), swap `3000`
for that port in the URLs above.

## Data model

**Box** `{ id, name, width, length, height, weight, loadLimit, active }`
**SKU** `{ id, name, width, length, height, weight, color, active }`

Dimensions are in cm, weight in kg. `loadLimit` is the box's max payload
weight; `weight` on a box is the box's own (empty) weight, used for freight
chargeable-weight calculations.

### Storage

Boxes and SKUs created via the CRUD endpoints are persisted to a JSON file
on disk (`data/db.json` by default) instead of living only in memory, so
data survives server restarts. Override the location with the `DB_FILE`
environment variable. See `src/store.js`.

## Endpoints

### Boxes / SKUs CRUD (file-based store)
- `GET /api/boxes` / `POST /api/boxes` / `PUT /api/boxes/:id` / `DELETE /api/boxes/:id`
- `GET /api/skus` / `POST /api/skus` / `PUT /api/skus/:id` / `DELETE /api/skus/:id`
- `GET /api/settings` — `{ boxes, skus }` combined (matches the frontend's `fetchSettings` shape)
- `PUT /api/settings` — bulk replace boxes/skus

### Optimize
Two separate endpoints depending on how you want to call it:

**`POST /api/optimize/stateless`** — pass everything in the request body
(each SKU needs a `qty`); nothing is read from or written to the stored
boxes/SKUs:
```json
{
  "boxes": [{ "id": "b1", "name": "Pallet", "width": 100, "length": 100, "height": 100, "weight": 5, "loadLimit": 500 }],
  "skus": [{ "id": "s1", "name": "Cube30", "width": 30, "length": 30, "height": 30, "weight": 1, "qty": 10 }]
}
```

**`POST /api/optimize/stateful`** — uses boxes/SKUs already saved via the
CRUD endpoints; just supply quantities by SKU id:
```json
{ "quantities": { "sku_abc123": 10 } }
```

Both endpoints return the same response shape:
```json
{
  "boxes": [
    {
      "boxId": "b1",
      "boxName": "Pallet",
      "layout": [ { "id": 0, "type": "s1", "x": 0, "y": 0, "z": 0, "layer": 1, "w": 30, "d": 30, "h": 30, "kg": 1, "color": "#3B82F6", "name": "Cube30" } ],
      "layerDefs": [ ... ],
      "totalWeight": 10,
      "actualHeight": 90,
      "placedQty": { "s1": 10 },
      "freightCost": 666.67,
      "chargeableWeight": 83.33,
      "dimensions": { "width": 100, "depth": 100, "height": 100, "boxWeight": 5, "loadLimit": 500 }
    }
  ],
  "summary": {
    "totalBoxesUsed": 1,
    "totalSkusRequested": 10,
    "totalSkusPacked": 10,
    "unpackedCount": 0,
    "totalWeight": 10,
    "totalFreightCost": 666.67,
    "spaceEfficiencyPct": 27.0
  }
}
```

`layout[].x/y/z/w/d/h` use the same axis convention as the frontend's 3D
renderer (`x` = width position, `y` = depth position, `z` = height off the
floor; `w/d/h` = item's placed width/depth/height after rotation), so the
response can be fed directly into the existing Three.js visualizer.

## Tests

```bash
npm test
```
