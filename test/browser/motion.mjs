// Run after `npm run build`: node test/browser/motion.mjs
// Uses an installed Chrome and Node's built-in CDP WebSocket client.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "../parser.mjs";
import { explain } from "../../src/lib/explain.js";
import { resolveCommands } from "../../src/lib/wrap.js";

let responseDelay = 0;
let scriptDelay = 0;
let failResponse = false;
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/api/explain") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { cmd, env } = JSON.parse(body);
      await delay(responseDelay);
      res.setHeader("content-type", "application/json");
      if (failResponse) {
        res.writeHead(500).end(JSON.stringify({ error: "Test failure" }));
        return;
      }
      const parsed = parse(cmd);
      const pages = {};
      const commands = await resolveCommands(parsed, async (name) => {
        try { return JSON.parse(await readFile(new URL(`../fixtures/corpus/${name}.json`, import.meta.url))); }
        catch { return null; }
      }, pages);
      res.end(JSON.stringify(explain(cmd, { ...parsed, commands }, pages, env)));
      return;
    }
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = pathname === "/" ? "index.html" : pathname.slice(1);
    const data = await readFile(new URL(`../../dist/${file}`, import.meta.url));
    if (extname(file) === ".js") await delay(scriptDelay);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
    res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});

const profile = await mkdtemp(join(tmpdir(), "rungkai-motion-"));
let chrome;
let socket;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(process.env.CHROME_BIN ?? "google-chrome", [
    "--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    chrome.stderr.on("data", (data) => {
      stderr += data;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.on("error", reject);
    chrome.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${stderr}`)));
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(JSON.stringify(message.error)));
    else callbacks.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params, sessionId }));
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  const evaluate = async (expression) => {
    const value = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
    return value.result.value;
  };
  const waitFor = async (expression) => {
    for (let n = 0; n < 200; n++) {
      if (await evaluate(expression)) return;
      await delay(25);
    }
    throw new Error(`Timed out: ${expression}\n${JSON.stringify(await evaluate("({body: document.body.innerText.slice(-1500), errors: window.exampleFlashed, routes: document.querySelector('#connectors')?.outerHTML.slice(0,500)})"))}\nBrowser errors: ${JSON.stringify(errors)}`);
  };
  const frames = () => evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const viewport = (width) => cdp("Emulation.setDeviceMetricsOverride", { width, height: 854, deviceScaleFactor: 1, mobile: false });
  await viewport(925);
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.exampleFlashed = false;
    window.commandControlsFlashed = false;
    window.toolbarFrames = [];
    function sample() {
      const examples = document.querySelector('#examples');
      if (location.search.includes('cmd=') && examples && getComputedStyle(examples).display !== 'none') window.exampleFlashed = true;
      if (location.search.includes('cmd=')) {
        for (const control of document.querySelectorAll('#new-command, #esc-hint')) {
          if (getComputedStyle(control).display === 'none') window.commandControlsFlashed = true;
        }
        const status = document.querySelector('#status-text');
        const enter = document.querySelector('#explain');
        if (status && enter) {
          const icon = enter.querySelector('svg');
          window.toolbarFrames.push({
            status: status.textContent,
            statusVisibility: getComputedStyle(status).visibility,
            dot: document.querySelector('#status-dot').className,
            enterOpacity: getComputedStyle(enter).opacity,
            iconOpacity: getComputedStyle(icon).opacity,
            command: document.querySelector('#cmd').value,
          });
        }
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  ` });
  const navigate = async (cmd = "") => {
    await cdp("Page.navigate", { url: origin + (cmd ? `/?cmd=${encodeURIComponent(cmd)}` : "/") });
    await waitFor(cmd ? "!!document.querySelector('#connectors path[data-step]')" : "!!document.querySelector('.cat-tab')");
  };
  const submit = (cmd) => evaluate(`document.querySelector('#cmd').value = ${JSON.stringify(cmd)}; document.querySelector('#explain-form').requestSubmit()`);

  scriptDelay = 200;
  responseDelay = 250;
  await navigate("ls -la /tmp");
  assert.equal(await evaluate("window.commandControlsFlashed"), false, "command controls are visible before scripts and results load");
  assert.ok(await evaluate("toolbarFrames.length > 0 && toolbarFrames.every(f => f.enterOpacity === '1' && f.iconOpacity === '1')"), "Enter button never dims during the initial request");
  assert.ok(await evaluate("toolbarFrames.every(f => f.statusVisibility === 'hidden' || f.status !== 'Ready when you are')"), "new command links never flash the landing status");
  scriptDelay = 0;
  responseDelay = 0;
  assert.equal(await evaluate("window.exampleFlashed"), false, "shared link must not flash landing examples");
  assert.ok(await evaluate("[...document.querySelectorAll('path[data-step]')].some(p => p.getAnimations().length && parseFloat(getComputedStyle(p).strokeDashoffset) > 0)"), "shared link draws its routes");
  assert.equal(await evaluate("[...document.querySelectorAll('.route-hit')].some(p => p.getAnimations().length)"), false, "hit targets are never animated");
  await evaluate(`
    window.wire = document.querySelector('#connectors path[data-step]');
    window.wireAnimation = wire.getAnimations()[0];
    window.wireStart = wireAnimation.startTime;
    scrollTo(0, 70);
  `);
  await frames();
  await viewport(1000);
  await frames();
  assert.ok(await evaluate("wire.isConnected && wire.getAnimations()[0] === wireAnimation && wireAnimation.startTime === wireStart"), "scroll and resize preserve the running animation");
  await delay(1500);
  assert.equal(await evaluate("parseFloat(getComputedStyle(wire).strokeDashoffset)"), 0, "route completes after redraw");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#connectors circle')).opacity"), "1");
  await evaluate("document.querySelector('#synopsis [data-card]').focus()");
  assert.ok(await evaluate("document.querySelector('#results').classList.contains('hovering')"), "keyboard focus still highlights routes");

  // A repeated render with identical geometry used to leave an empty overlay.
  await submit("ls -la /tmp");
  await waitFor("!document.querySelector('#explain').disabled");
  assert.ok(await evaluate("document.querySelectorAll('#connectors path[data-step]').length > 0"));

  const previousStatus = await evaluate("document.querySelector('#status-text').textContent");
  const previousDot = await evaluate("document.querySelector('#status-dot').className");
  const previousDocument = await evaluate("performance.timeOrigin");
  responseDelay = 350;
  scriptDelay = 200;
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor(`performance.timeOrigin !== ${previousDocument}`);
  await waitFor("!!document.querySelector('#connectors path[data-step]') && !document.querySelector('#explain').disabled");
  assert.equal(await evaluate("window.commandControlsFlashed"), false, "refresh never hides the new-command button or Escape hint");
  const toolbarFrames = await evaluate("window.toolbarFrames");
  assert.ok(toolbarFrames.length > 5, "sample the toolbar throughout a delayed reload");
  assert.ok(toolbarFrames.every((frame) => frame.status === previousStatus && frame.dot === previousDot), "source label and dot keep their previous appearance from first paint");
  assert.ok(toolbarFrames.every((frame) => frame.statusVisibility === "visible"), "restored source label never disappears during refresh");
  assert.ok(toolbarFrames.every((frame) => frame.enterOpacity === "1" && frame.iconOpacity === "1"), "Enter icon stays at full opacity throughout refresh");
  assert.ok(toolbarFrames.every((frame) => frame.command === "ls -la /tmp"), "command input never flashes its empty state");
  responseDelay = 0;
  scriptDelay = 0;

  await navigate("sudo -u www ls -la");
  assert.ok(await evaluate("document.querySelector('#cards').textContent.includes('sudo(8) § OPTIONS')"), "option citations use the manual section");
  assert.equal(await evaluate("document.querySelector('#cards').textContent.includes('sudo(1)')"), false, "sudo never cites section 1");

  const loop = "for user in $(cut -f1 -d: /etc/passwd); do crontab -u $user -l 2>/dev/null; done";
  await navigate(loop);
  await delay(1400);
  if (process.env.MOTION_SCREENSHOT) {
    const { data } = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(process.env.MOTION_SCREENSHOT, Buffer.from(data, "base64"));
  }
  assert.ok(await evaluate("document.querySelectorAll('#cards .entry').length > 5"));
  assert.ok(await evaluate("[...document.querySelectorAll('.connectors path')].every(p => !p.getAttribute('d').includes('NaN'))"));
  await viewport(700);
  await frames();
  assert.ok(await evaluate("document.querySelector('#synopsis').classList.contains('is-wrapped')"), "long command wraps cleanly");
  assert.equal(await evaluate("document.querySelectorAll('.route-hit[data-step]').length"), 0, "wrapping keeps hit targets separate from visible strokes");
  await viewport(390);
  await frames();
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#connectors')).display"), "none");
  await viewport(925);
  await frames();
  assert.ok(await evaluate("document.querySelector('#connectors path') !== null"), "routes return after mobile layout");

  // Slow requests retain the current view; clearing cannot resurrect results.
  await evaluate("document.querySelector('#clear').click()");
  await waitFor("document.querySelector('#results').hidden");
  responseDelay = 500;
  await submit("ls -la /tmp");
  await delay(100);
  assert.equal(await evaluate("document.querySelector('#examples').hidden"), false, "examples stay while loading");
  await waitFor("!document.querySelector('#explain').disabled");
  await evaluate("window.oldCard = document.querySelector('#cards .entry')");
  await submit("echo hello");
  await delay(100);
  assert.equal(await evaluate("oldCard.isConnected"), true, "existing explanation stays while loading");
  await evaluate("document.querySelector('#clear').click()");
  await delay(700);
  assert.ok(await evaluate("document.querySelector('#results').hidden && !document.querySelector('#examples').hidden"), "aborted response cannot reopen results");
  assert.equal(await evaluate("document.querySelectorAll('.connectors > *').length"), 0, "home clears both SVG layers");

  responseDelay = 0;
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await submit("ls -la /tmp");
  await waitFor("!document.querySelector('#explain').disabled");
  assert.equal(await evaluate("[...document.querySelectorAll('path[data-step]')].some(p => p.getAnimations().length)"), false, "reduced motion skips route animation");
  await cdp("Emulation.setEmulatedMedia", { features: [] });
  await evaluate("document.startViewTransition = undefined");
  await submit("echo hello");
  await waitFor("!document.querySelector('#explain').disabled");
  assert.ok(await evaluate("[...document.querySelectorAll('path[data-step]')].some(p => p.getAnimations().length)"), "route animation also works without View Transition API");
  failResponse = true;
  await submit("ls");
  await waitFor("!document.querySelector('#explain').disabled");
  assert.equal(await evaluate("document.querySelector('#cards').textContent"), "Test failure");
  assert.equal(await evaluate("document.querySelectorAll('.connectors > *').length"), 0, "errors clear both SVG layers");
  assert.deepEqual(errors, [], "no browser exceptions");
  console.log("PASS: toolbar first-paint stability, source label/dot and Enter icon across slow refresh, command input restoration, shared-link entrance, continuous route draw, scroll/resize, repeated render, wrapping, mobile, cancellation, reduced motion, browser fallback, errors, keyboard focus");
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill();
    await exited;
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
