import assert from "node:assert/strict";
import test from "node:test";
import { readLogin, readRegister } from "../validation/user.js";

test("login accepts username and password and ignores email", () => {
  const result = readLogin({
    username: "Ada_1",
    password: "password1",
    email: "not-used@example.com",
  });
  assert.deepEqual(result, { username: "Ada_1", password: "password1" });
});

test("password is rejected when it exceeds 72 bytes", () => {
  const password = "é".repeat(40);
  assert.equal(password.length < 72, true);
  assert.equal(
    readRegister({ username: "ada", email: "ada@example.com", password }).error,
    "Password must be at least 8 characters and no more than 72 bytes",
  );
});

test("register requires a normal unique-looking email", () => {
  assert.equal(readRegister({ username: "ada", password: "password1" }).error, "Enter a valid email address");
  assert.equal(
    readRegister({ username: "ada", email: "not-an-email", password: "password1" }).error,
    "Enter a valid email address",
  );
  assert.deepEqual(
    readRegister({ username: "Ada", email: "Ada@Example.com", password: "password1" }),
    { username: "Ada", email: "ada@example.com", password: "password1" },
  );
});
