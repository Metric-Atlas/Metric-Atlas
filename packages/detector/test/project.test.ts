import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { scanGitRef, scanProject } from "../src/index.ts";

const execute = promisify(execFile);

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

  it("scans Base and Head Git trees without changing the worktree", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-git-ref-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    await execute("git", ["init", "--quiet"], { cwd: root });
    await execute("git", ["config", "user.email", "metric-atlas@example.test"], {
      cwd: root,
    });
    await execute("git", ["config", "user.name", "Metric Atlas Test"], {
      cwd: root,
    });
    const sourceFile = path.join(root, "src", "App.tsx");
    await writeFile(
      sourceFile,
      `export const App = () => <button onClick={() => gtag("event", "base_click")}>Base</button>;`,
    );
    await execute("git", ["add", "src/App.tsx"], { cwd: root });
    await execute("git", ["commit", "--quiet", "-m", "base"], { cwd: root });
    const { stdout: baseRef } = await execute("git", ["rev-parse", "HEAD"], {
      cwd: root,
    });

    const headSource = `export const App = () => <button onClick={() => gtag("event", "head_click")}>Head</button>;`;
    await writeFile(sourceFile, headSource);
    await execute("git", ["add", "src/App.tsx"], { cwd: root });
    await execute("git", ["commit", "--quiet", "-m", "head"], { cwd: root });
    const { stdout: headRef } = await execute("git", ["rev-parse", "HEAD"], {
      cwd: root,
    });

    const [base, head] = await Promise.all([
      scanGitRef({ root, ref: baseRef.trim() }),
      scanGitRef({ root, ref: headRef.trim() }),
    ]);

    expect(base.manifest.events[0]?.eventName).toBe("base_click");
    expect(head.manifest.events[0]?.eventName).toBe("head_click");
    expect(await readFile(sourceFile, "utf8")).toBe(headSource);
    expect((await execute("git", ["status", "--short"], { cwd: root })).stdout).toBe("");
  });
});
