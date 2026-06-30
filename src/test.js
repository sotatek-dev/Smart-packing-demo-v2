const assert = require("assert");
const { runPacking } = require("../src/packingEngine");

// Box: 100x100x100, items: 30 cubes of 30x30x30 (1 kg each)
const boxes = [{ id: "b1", name: "Pallet", width: 100, length: 100, height: 100, weight: 5, loadLimit: 500 }];
const skus = [{ id: "s1", name: "Cube30", width: 30, length: 30, height: 30, weight: 1, color: "#fff", qty: 30 }];

const result = runPacking(skus, boxes);
console.log(JSON.stringify(result.summary, null, 2));
assert(result.summary.totalSkusPacked > 0, "should pack at least some items");
assert(result.boxes.length > 0, "should produce at least one box");
result.boxes.forEach((b) => {
  assert(b.totalWeight <= 500, "weight under load limit");
  b.layout.forEach((item) => {
    assert(item.x + item.w <= b.dimensions.width + 1e-6, "x within bounds");
    assert(item.z + item.h <= b.dimensions.height + 1e-6, "z within bounds");
    assert(item.y + item.d <= b.dimensions.depth + 1e-6, "y within bounds");
  });
});
console.log("OK — boxes used:", result.boxes.length, "items packed:", result.summary.totalSkusPacked);

// Test multiple SKUs + multiple box types
const boxes2 = [
  { id: "small", name: "Small", width: 50, length: 50, height: 50, weight: 2, loadLimit: 50 },
  { id: "large", name: "Large", width: 120, length: 100, height: 100, weight: 8, loadLimit: 800 },
];
const skus2 = [
  { id: "a", name: "A", width: 20, length: 20, height: 20, weight: 1, qty: 10 },
  { id: "b", name: "B", width: 40, length: 30, height: 25, weight: 3, qty: 5 },
];
const result2 = runPacking(skus2, boxes2);
console.log(JSON.stringify(result2.summary, null, 2));
assert(result2.summary.totalSkusPacked === 15, "all 15 items should pack");
console.log("OK — multi-sku multi-box test passed");

console.log("\nAll tests passed.");
