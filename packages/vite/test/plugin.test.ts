import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "vite";
import { EventManifest } from "@metric-atlas/contracts";
import { serveRuntime } from "../../runtime/src/index.ts";
import metricAtlas from "../src/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Metric Atlas Vite plugin", () => {
  it("transforms supported modules and exposes a current manifest", async () => {
    const plugin = metricAtlas({ buildId: "vite-test" });
    const root = path.resolve("fixture-project");
    const logger = { info: vi.fn() };
    await (plugin.configResolved as Function)({ root, logger });
    await (plugin.buildStart as Function).call({});
    const transformed = await (plugin.transform as Function).call(
      {},
      `export const App = () => <button onClick={() => gtag("event", "open")}>Open</button>;`,
      path.join(root, "src", "App.tsx"),
      { ssr: false, moduleType: "js" },
    );

    expect(transformed.code).toContain("data-atlas-id");
    expect(plugin.api.getManifest().events).toHaveLength(1);
    expect(plugin.api.getManifest().events[0]).toMatchObject({
      eventKey: "ga4:open",
      overlaySupported: true,
    });
    await (plugin.watchChange as Function).call(
      {},
      path.join(root, "src", "App.tsx"),
      { event: "delete" },
    );
    expect(plugin.api.getManifest().events).toEqual([]);
    const htmlHook = plugin.transformIndexHtml as { handler: Function };
    const htmlTags = await htmlHook.handler();
    expect(htmlTags[0].children).toContain("virtual:metric-atlas-overlay-entry");
  });

  it("enables non-MVP detectors only through explicit plugin config", async () => {
    const root = path.resolve("fixture-project");
    // posthog stays opt-in post-DEC-060 (only mixpanel joined the ga4/gtm default).
    const source = `export const App = () => <button onClick={() => posthog.capture("posthog_open")}>Open</button>;`;
    const defaultPlugin = metricAtlas({ buildId: "default-detectors" });
    await (defaultPlugin.configResolved as Function)({ root, logger: { info: vi.fn() } });
    await (defaultPlugin.buildStart as Function).call({});
    await (defaultPlugin.transform as Function).call(
      {},
      source,
      path.join(root, "src", "Default.tsx"),
      { ssr: false, moduleType: "js" },
    );
    expect(defaultPlugin.api.getManifest().events).toEqual([]);

    const optInPlugin = metricAtlas({
      buildId: "opt-in-detectors",
      detectors: ["ga4", "gtm", "posthog"],
    });
    await (optInPlugin.configResolved as Function)({ root, logger: { info: vi.fn() } });
    await (optInPlugin.buildStart as Function).call({});
    const transformed = await (optInPlugin.transform as Function).call(
      {},
      source,
      path.join(root, "src", "OptIn.tsx"),
      { ssr: false, moduleType: "js" },
    );
    expect(transformed.code).toContain("data-atlas-id");
    expect(optInPlugin.api.getManifest().events[0]?.eventKey).toBe(
      "posthog:posthog_open",
    );
  });

  it("uses the dev manifest endpoint in serve and static manifest asset in build", async () => {
    const root = path.resolve("fixture-project");

    const devPlugin = metricAtlas({
      buildId: "dev-overlay-url",
      manifestEndpoint: "/__metric-atlas/dev/manifest",
    });
    await (devPlugin.configResolved as Function)({
      root,
      base: "/",
      command: "serve",
      logger: { info: vi.fn() },
    });
    const devOverlayModule = await (devPlugin.load as Function)(
      "\0virtual:metric-atlas-overlay-entry",
    );
    expect(devOverlayModule).toContain(
      'manifestUrl: "/__metric-atlas/dev/manifest"',
    );

    const buildPlugin = metricAtlas({ buildId: "build-overlay-url" });
    await (buildPlugin.configResolved as Function)({
      root,
      base: "/",
      command: "build",
      logger: { info: vi.fn() },
    });
    const buildOverlayModule = await (buildPlugin.load as Function)(
      "\0virtual:metric-atlas-overlay-entry",
    );
    expect(buildOverlayModule).toContain(
      'manifestUrl: "/.metric-atlas/manifest.json"',
    );
  });

  it("emits the manifest and bundles the overlay in a real Vite build", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-vite-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    await writeFile(
      path.join(root, "index.html"),
      '<div id="root"></div><script type="module" src="/src/main.jsx"></script>',
    );
    await writeFile(
      path.join(root, "src", "main.jsx"),
      `const App = () => <button onClick={() => gtag("event", "built_click")}>Built</button>; globalThis.App = App;`,
    );
    await writeFile(
      path.join(root, "src", "jsx-runtime.js"),
      `export const Fragment = Symbol("Fragment"); export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const jsxDEV = jsx;`,
    );

    await build({
      root,
      configFile: false,
      logLevel: "silent",
      resolve: {
        alias: {
          "react/jsx-dev-runtime": path.join(root, "src", "jsx-runtime.js"),
          "react/jsx-runtime": path.join(root, "src", "jsx-runtime.js"),
        },
      },
      plugins: [metricAtlas({ buildId: "real-build" })],
      build: { outDir: "dist" },
    });

    const manifest = JSON.parse(
      await readFile(path.join(root, "dist", ".metric-atlas", "manifest.json"), "utf8"),
    );
    expect(manifest.events[0]).toMatchObject({
      eventKey: "ga4:built_click",
      overlaySupported: true,
    });
    const builtHtml = await readFile(path.join(root, "dist", "index.html"), "utf8");
    expect(builtHtml).not.toContain("virtual:metric-atlas-overlay-entry");
    const assetsDirectory = path.join(root, "dist", "assets");
    const javaScript = (
      await Promise.all(
        (await readdir(assetsDirectory))
          .filter((file) => file.endsWith(".js"))
          .map((file) => readFile(path.join(assetsDirectory, file), "utf8")),
      )
    ).join("\n");
    expect(javaScript).toContain("data-atlas-id");
    expect(javaScript).toContain("metric-atlas-overlay");

    const runtime = await serveRuntime({ root: path.join(root, "dist"), port: 0 });
    try {
      const response = await fetch(
        `http://${runtime.host}:${runtime.port}/__metric-atlas/api/manifest`,
      );
      expect(response.ok).toBe(true);
      const runtimeManifest: unknown = await response.json();
      expect(() => EventManifest.parse(runtimeManifest)).not.toThrow();
    } finally {
      await runtime.close();
    }
  });
});
