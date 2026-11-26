const test = require("node:test");
const assert = require("node:assert/strict");
const { findPaymentPackage } = require("../src/utils/paymentPackages");

test("accepts only the advertised coin packages", () => {
  assert.deepEqual(findPaymentPackage(1, 10), { amount: 1, coins: 10 });
  assert.deepEqual(findPaymentPackage("35", "1000"), { amount: 35, coins: 1000 });
  assert.equal(findPaymentPackage(1, 100000), undefined);
  assert.equal(findPaymentPackage(2, 20), undefined);
});
