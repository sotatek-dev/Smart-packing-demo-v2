const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Packing Engine API",
      version: "1.0.0",
      description:
        "Express backend for the 3D box/pallet packing optimizer (Guillotine-Cut algorithm). " +
        "Boxes and SKUs are CRUD resources persisted to disk; /api/optimize runs the packing " +
        "engine in either stateless or stateful mode.",
    },
    servers: [{ url: "/", description: "Current server" }],
    components: {
      schemas: {
        Box: {
          type: "object",
          properties: {
            id: { type: "string", example: "box_3f9c1e2a" },
            name: { type: "string", example: "Pallet" },
            type: { type: "string", example: "" },
            width: { type: "number", example: 100 },
            length: { type: "number", example: 100 },
            height: { type: "number", example: 100 },
            weight: { type: "number", description: "Empty (own) box weight in kg", example: 5 },
            loadLimit: { type: "number", description: "Max payload weight in kg", example: 500 },
            active: { type: "boolean", example: true },
          },
        },
        BoxInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            width: { type: "number" },
            length: { type: "number" },
            height: { type: "number" },
            weight: { type: "number" },
            loadLimit: { type: "number" },
            active: { type: "boolean" },
          },
        },
        Sku: {
          type: "object",
          properties: {
            id: { type: "string", example: "sku_a1b2c3d4" },
            sku_id: { type: "string", example: "sku_a1b2c3d4" },
            name: { type: "string", example: "Cube30" },
            width: { type: "number", example: 30 },
            length: { type: "number", example: 30 },
            height: { type: "number", example: 30 },
            weight: { type: "number", example: 1 },
            color: { type: "string", example: "#3B82F6" },
            active: { type: "boolean", example: true },
          },
        },
        SkuInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            width: { type: "number" },
            length: { type: "number" },
            height: { type: "number" },
            weight: { type: "number" },
            color: { type: "string" },
            active: { type: "boolean" },
          },
        },
        Settings: {
          type: "object",
          properties: {
            boxes: { type: "array", items: { $ref: "#/components/schemas/Box" } },
            skus: { type: "array", items: { $ref: "#/components/schemas/Sku" } },
          },
        },
        OptimizeRequestStateless: {
          type: "object",
          required: ["boxes", "skus"],
          properties: {
            boxes: { type: "array", items: { $ref: "#/components/schemas/BoxInput" } },
            skus: {
              type: "array",
              items: {
                allOf: [
                  { $ref: "#/components/schemas/SkuInput" },
                  { type: "object", properties: { qty: { type: "integer", example: 10 } } },
                ],
              },
            },
          },
        },
        OptimizeRequestStateful: {
          type: "object",
          required: ["quantities"],
          properties: {
            quantities: {
              type: "object",
              additionalProperties: { type: "integer" },
              example: { sku_abc123: 10 },
            },
          },
        },
        PackedItem: {
          type: "object",
          properties: {
            id: { type: "integer" },
            type: { type: "string", description: "SKU id" },
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" },
            layer: { type: "integer" },
            w: { type: "number" },
            d: { type: "number" },
            h: { type: "number" },
            kg: { type: "number" },
            color: { type: "string" },
            name: { type: "string" },
          },
        },
        PackedBox: {
          type: "object",
          properties: {
            boxId: { type: "string" },
            boxName: { type: "string" },
            layout: { type: "array", items: { $ref: "#/components/schemas/PackedItem" } },
            layerDefs: { type: "array", items: { type: "object" } },
            totalWeight: { type: "number" },
            actualHeight: { type: "number" },
            placedQty: { type: "object", additionalProperties: { type: "integer" } },
            freightCost: { type: "number" },
            chargeableWeight: { type: "number" },
            dimensions: {
              type: "object",
              properties: {
                width: { type: "number" },
                depth: { type: "number" },
                height: { type: "number" },
                boxWeight: { type: "number" },
                loadLimit: { type: "number" },
              },
            },
          },
        },
        OptimizeResponse: {
          type: "object",
          properties: {
            boxes: { type: "array", items: { $ref: "#/components/schemas/PackedBox" } },
            summary: {
              type: "object",
              properties: {
                totalBoxesUsed: { type: "integer" },
                totalSkusRequested: { type: "integer" },
                totalSkusPacked: { type: "integer" },
                unpackedCount: { type: "integer" },
                totalWeight: { type: "number" },
                totalFreightCost: { type: "number" },
                spaceEfficiencyPct: { type: "number" },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    tags: [
      { name: "Boxes", description: "Box template CRUD" },
      { name: "SKUs", description: "SKU CRUD" },
      { name: "Settings", description: "Combined boxes + skus settings" },
      { name: "Optimize", description: "Run the packing algorithm" },
      { name: "Health", description: "Service health check" },
    ],
  },
  apis: ["./src/server.js"],
};

module.exports = swaggerJSDoc(options);
