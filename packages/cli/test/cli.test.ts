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
    // posthog stays opt-in post-DEC-060 (only mixpanel joined the ga4/gtm default).
    await writeFile(
      path.join(root, "src", "Posthog.tsx"),
      `export const Button = () => <button onClick={() => posthog.capture("posthog_click")}>Post</button>;`,
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
      "ga4,gtm,posthog",
      "--output",
      "opt-in.json",
    ]);
    const optInManifest = JSON.parse(
      await readFile(path.join(root, "opt-in.json"), "utf8"),
    );
    expect(optInManifest.events[0]?.eventKey).toBe("posthog:posthog_click");
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
      "--include",
      "src/**/*.{ts,tsx}",
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

  it("creates a Runtime env file and copies the LLM key from an environment variable without printing it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-cli-env-"));
    temporaryDirectories.push(root);
    const outputFile = path.join(root, ".env.metric-atlas");
    const secret = "sk-test-secret";

    const { stderr, stdout } = await execute(
      process.execPath,
      [
        cli,
        "init-env",
        "--output",
        outputFile,
        "--ga4-property-id",
        "123456789",
        "--google-application-credentials",
        "/secure/reader.json",
        "--llm-provider",
        "openai",
        "--llm-base-url",
        "https://openrouter.ai/api/v1",
        "--llm-model",
        "openrouter/free",
        "--llm-api-key-env",
        "METRIC_ATLAS_TEST_LLM_KEY",
      ],
      { env: { ...process.env, METRIC_ATLAS_TEST_LLM_KEY: secret } },
    );

    const contents = await readFile(outputFile, "utf8");
    expect(contents).toContain("METRIC_ATLAS_GA4_PROPERTY_ID=123456789");
    expect(contents).toContain("GOOGLE_APPLICATION_CREDENTIALS=/secure/reader.json");
    expect(contents).toContain("METRIC_ATLAS_LLM_BASE_URL=https://openrouter.ai/api/v1");
    expect(contents).toContain("METRIC_ATLAS_LLM_API_KEY=sk-test-secret");
    expect(stdout).not.toContain(secret);
    expect(stderr).not.toContain(secret);
    expect(stderr).toContain("key value was not printed");
  });

  it("refuses to overwrite an existing Runtime env file unless --force is passed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-cli-env-"));
    temporaryDirectories.push(root);
    const outputFile = path.join(root, ".env.metric-atlas");
    await writeFile(outputFile, "EXISTING=true\n");

    await expect(
      execute(process.execPath, [cli, "init-env", "--output", outputFile]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Refusing to overwrite"),
    });

    await execute(process.execPath, [cli, "init-env", "--output", outputFile, "--force"]);
    expect(await readFile(outputFile, "utf8")).toContain("METRIC_ATLAS_LLM_PROVIDER=openai");
  });
});
