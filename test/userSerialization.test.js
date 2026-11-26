const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/User");

test("never serializes password hashes in user API responses", () => {
  const user = new User({
    name: "Test User",
    email: "test@example.com",
    passwordHash: "salt:hashed-value"
  });

  const response = user.toJSON();
  assert.equal(response.email, "test@example.com");
  assert.equal(Object.hasOwn(response, "passwordHash"), false);
});
