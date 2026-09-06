import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const startScript = path.join(repoRoot, "scripts/start-prod-8383.sh");

function createProductionCheckout(revisionMarker: "current" | "previous") {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "start-prod-8383-"));
  const appDir = path.join(testRoot, "trading-web");
  const distDir = path.join(appDir, ".next-prod-8383");
  const npmCaptureFile = path.join(testRoot, "npm-start.txt");
  const fakeNpm = path.join(testRoot, "npm");

  fs.mkdirSync(appDir);
  fs.writeFileSync(path.join(appDir, "package.json"), '{"version":"1.0.0"}\n');
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: appDir, stdio: "ignore" });
  execFileSync("git", ["add", "package.json"], { cwd: appDir });
  execFileSync(
    "git",
    ["-c", "user.name=Production Start Test", "-c", "user.email=start-prod@example.invalid", "commit", "-m", "fixture"],
    { cwd: appDir, stdio: "ignore" },
  );
  const previousRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: appDir, encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(appDir, "source-revision.txt"), "updated source\n");
  execFileSync("git", ["add", "source-revision.txt"], { cwd: appDir });
  execFileSync(
    "git",
    ["-c", "user.name=Production Start Test", "-c", "user.email=start-prod@example.invalid", "commit", "-m", "updated fixture"],
    { cwd: appDir, stdio: "ignore" },
  );
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: appDir, encoding: "utf8" }).trim();
  const recordedRevision = revisionMarker === "current" ? sourceRevision : previousRevision;

  fs.mkdirSync(distDir);
  fs.writeFileSync(path.join(distDir, "APP_VERSION"), "1.0.0+test");
  fs.writeFileSync(path.join(distDir, "APP_REVISION"), recordedRevision);
  fs.writeFileSync(
    fakeNpm,
    '#!/bin/sh\nprintf "%s\\n%s\\n" "$NEXT_PUBLIC_APP_REVISION" "$*" > "$NPM_CAPTURE_FILE"\n',
    { mode: 0o755 },
  );

  return { appDir, npmCaptureFile, fakeNpm, recordedRevision, sourceRevision, testRoot };
}

function runStartScript(fixture: ReturnType<typeof createProductionCheckout>) {
  return spawnSync("zsh", [startScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_BIN: process.execPath,
      NPM_BIN: fixture.fakeNpm,
      NPM_CAPTURE_FILE: fixture.npmCaptureFile,
      PRODUCTION_APP_DIR: fixture.appDir,
    },
  });
}

test("production start refuses a build recorded for a different checkout revision", (t) => {
  const fixture = createProductionCheckout("previous");
  t.after(() => fs.rmSync(fixture.testRoot, { force: true, recursive: true }));

  const result = runStartScript(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /refusing to serve stale 8383 production build/);
  assert.match(result.stderr, new RegExp(`recorded revision ${fixture.recordedRevision}`));
  assert.match(result.stderr, new RegExp(`does not match checked-out revision ${fixture.sourceRevision}`));
  assert.equal(fs.existsSync(fixture.npmCaptureFile), false, "npm start must not run for a stale build");
});

test("production start accepts a build recorded for the checked-out revision", (t) => {
  const fixture = createProductionCheckout("current");
  t.after(() => fs.rmSync(fixture.testRoot, { force: true, recursive: true }));

  const result = runStartScript(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(fixture.npmCaptureFile, "utf8"),
    `${fixture.sourceRevision}\nrun start -- --hostname 0.0.0.0 --port 8383\n`,
  );
});
