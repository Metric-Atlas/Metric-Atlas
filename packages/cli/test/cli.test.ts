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
});
