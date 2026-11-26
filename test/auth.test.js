const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hashPassword,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
  verifyPassword
} = require("../src/utils/auth");

test("normalizes and validates email addresses", () => {
  assert.equal(normalizeEmail("  User@Example.com "), "user@example.com");
  assert.equal(isValidEmail("User@Example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
});

test("requires a password with minimum length, letters, and digits", () => {
  assert.equal(isStrongPassword("StrongPass1"), true);
  assert.equal(isStrongPassword("short1"), false);
  assert.equal(isStrongPassword("lettersOnly"), false);
});

test("hashes passwords and verifies them without storing plaintext", async () => {
  const encoded = await hashPassword("StrongPass1");
  assert.notEqual(encoded, "StrongPass1");
  assert.equal(await verifyPassword("StrongPass1", encoded), true);
  assert.equal(await verifyPassword("WrongPass1", encoded), false);
  assert.equal(await verifyPassword("StrongPass1", "invalid"), false);
});
