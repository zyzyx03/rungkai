import test from "node:test";
import assert from "node:assert/strict";
import { chatAuthorized } from "../src/lib/chat-auth.js";

const request = (authorization) => ({ headers: new Map(authorization ? [["authorization", authorization]] : []) });

test("no configured token means chat is closed", async () => {
  assert.equal(await chatAuthorized(request("Bearer anything"), ""), "missing");
});

test("a missing or wrong header is refused", async () => {
  assert.equal(await chatAuthorized(request(null), "secret"), "denied");
  assert.equal(await chatAuthorized(request("Bearer wrong"), "secret"), "denied");
  assert.equal(await chatAuthorized(request("Basic secret"), "secret"), "denied");
});

test("the bearer token is accepted, whatever the case", async () => {
  assert.equal(await chatAuthorized(request("Bearer secret"), "secret"), "ok");
  assert.equal(await chatAuthorized(request("bearer secret"), "secret"), "ok");
});
