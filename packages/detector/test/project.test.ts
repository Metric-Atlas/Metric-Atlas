import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanProject } from "../src/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("scanProject", () => {
  it("honors include/exclude, emits stats, and never writes source", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-detector-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    const source = `export const App = () => <button onClick={() => gtag("event", "open")}>Open</button>;`;
    await writeFile(path.join(root, "src", "App.tsx"), source);
    await writeFile(
      path.join(root, "src", "App.test.tsx"),
      `gtag("event", "test_only")`,
    );

    const result = await scanProject({
      root,
      buildId: "scan-build",
      generatedAt: "2026-08-18T00:00:00.000Z",
    });

    expect(result.manifest.events.map((event) => event.eventName)).toEqual(["open"]);
    expect(result.manifest.scanStats).toMatchObject({
      filesScanned: 1,
      eventsDetected: 1,
    });
    expect(result.manifest.generatedAt).toBe("2026-08-18T00:00:00.000Z");
    expect(await readFile(path.join(root, "src", "App.tsx"), "utf8")).toBe(source);
  });

  it("keeps scanning valid files when another file cannot be parsed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-detector-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    await writeFile(
      path.join(root, "src", "Valid.tsx"),
      `export const Valid = () => <button onClick={() => gtag("event", "valid")}>Valid</button>;`,
    );
    await writeFile(path.join(root, "src", "Broken.tsx"), `export const = ;`);

    const result = await scanProject({ root, buildId: "resilient-build" });
    expect(result.manifest.events.map((event) => event.eventName)).toEqual(["valid"]);
    expect(result.manifest.warnings).toContainEqual(
      expect.objectContaining({
        code: "PARSE_ERROR",
        file: "src/Broken.tsx",
      }),
    );
  });
});
