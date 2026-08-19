import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/bin.js", import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("metric-atlas CLI", () => {
  it("scans to a file and produces a PR markdown diff without mutating source", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-cli-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    const source = `export const Button = () => <button onClick={() => gtag("event", "cli_click")}>CLI</button>;`;
    const sourceFile = path.join(root, "src", "Button.tsx");
    await writeFile(sourceFile, source);

    await execute(process.execPath, [
      cli,
      "scan",
      "--root",
      root,
      "--build-id",
      "cli-test",
      "--output",
      "base.json",
    ]);
    const writtenManifest = JSON.parse(
      await readFile(path.join(root, "base.json"), "utf8"),
    );
    expect(writtenManifest.events[0].eventKey).toBe("ga4:cli_click");
    expect(await readFile(sourceFile, "utf8")).toBe(source);

    const { stdout } = await execute(process.execPath, [
      cli,
      "diff",
      "--base",
      path.join(root, "base.json"),
      "--head",
      path.join(root, "base.json"),
    ]);
    expect(stdout).toContain("Metric Atlas Analytics Change");
    expect(stdout).toContain("Added events: 0");
  });

  it("requires explicit CLI opt-in for non-MVP detectors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-cli-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    await writeFile(
      path.join(root, "src", "Mixpanel.tsx"),
      `export const Button = () => <button onClick={() => mixpanel.track("mix_click")}>Mix</button>;`,
    );

    await execute(process.execPath, [
      cli,
      "scan",
      "--root",
      root,
      "--output",
      "default.json",
    ]);
    const defaultManifest = JSON.parse(
      await readFile(path.join(root, "default.json"), "utf8"),
    );
    expect(defaultManifest.events).toEqual([]);

    await execute(process.execPath, [
      cli,
      "scan",
      "--root",
      root,
      "--detectors",
      "ga4,gtm,mixpanel",
      "--output",
      "opt-in.json",
    ]);
    const optInManifest = JSON.parse(
      await readFile(path.join(root, "opt-in.json"), "utf8"),
    );
    expect(optInManifest.events[0]?.eventKey).toBe("mixpanel:mix_click");
  });

  it("creates a Base/Head PR report directly from Git refs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-cli-report-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "src"));
    await execute("git", ["init", "--quiet"], { cwd: root });
    await execute("git", ["config", "user.email", "metric-atlas@example.test"], {
      cwd: root,
    });
    await execute("git", ["config", "user.name", "Metric Atlas Test"], {
      cwd: root,
    });
    const sourceFile = path.join(root, "src", "Button.tsx");
    await writeFile(
      sourceFile,
      `export const Button = () => <button onClick={() => gtag("event", "base_click")}>Base</button>;`,
    );
    await execute("git", ["add", "src/Button.tsx"], { cwd: root });
    await execute("git", ["commit", "--quiet", "-m", "base"], { cwd: root });
    const baseRef = (
      await execute("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim();

    await writeFile(
      sourceFile,
      `export const Button = () => <button onClick={() => gtag("event", "head_click")}>Head</button>;`,
    );
    await execute("git", ["add", "src/Button.tsx"], { cwd: root });
    await execute("git", ["commit", "--quiet", "-m", "head"], { cwd: root });
    const headRef = (
      await execute("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim();
    const reportFile = path.join(root, "report.md");
    const manifestDirectory = path.join(root, "artifacts");

    await execute(process.execPath, [
      cli,
      "report",
      "--root",
      root,
      "--base-ref",
      baseRef,
      "--head-ref",
      headRef,
      "--output",
      reportFile,
      "--manifest-dir",
      manifestDirectory,
    ]);

    const report = await readFile(reportFile, "utf8");
    expect(report).toContain("ga4:head_click");
    expect(report).toContain("ga4:base_click");
    expect(
      JSON.parse(await readFile(path.join(manifestDirectory, "head-manifest.json"), "utf8"))
        .events[0].eventName,
    ).toBe("head_click");
  });
});
