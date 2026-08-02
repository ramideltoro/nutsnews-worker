import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const controllerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authorizationScript = path.join(
  controllerRoot,
  "scripts",
  "verify-backend-transition-authorization.mjs",
);
const action = "cutover";
const runId = 12345;
const runAttempt = 2;
const orchestrationId = `backend-worker-uplift-${action}-${runId}-${runAttempt}`;
const backendRevision = "b".repeat(40);
const workerRevision = "a".repeat(40);
const artifactName =
  `worker-controller-transition-authorization-${action}-${orchestrationId}-` +
  workerRevision;

function exactMetadata() {
  return {
    run: {
      id: runId,
      run_attempt: runAttempt,
      name: "Backend Worker-Uplift Cutover Controls",
      path: ".github/workflows/backend-worker-uplift-cutover-controls.yml",
      event: "workflow_dispatch",
      display_title: `Backend Worker-Uplift ${action} (${orchestrationId})`,
      head_branch: "main",
      head_sha: backendRevision,
      actor: { login: "ramideltoro" },
      triggering_actor: { login: "ramideltoro" },
      status: "in_progress",
      conclusion: null,
      created_at: new Date().toISOString(),
      run_started_at: new Date().toISOString(),
    },
    jobs: {
      jobs: [
        {
          name: `Authorize worker controller ${action} handoff`,
          status: "completed",
          conclusion: "success",
          steps: [],
        },
        {
          name: "Protected live control",
          status: "in_progress",
          conclusion: null,
          steps: [
            {
              name: `Hold worker controller ${action} handoff`,
              status: "in_progress",
              conclusion: null,
            },
          ],
        },
      ],
    },
    artifacts: {
      artifacts: [
        {
          id: 9876,
          name: artifactName,
          expired: false,
          size_in_bytes: 4096,
          digest: `sha256:${"c".repeat(64)}`,
          created_at: new Date().toISOString(),
          workflow_run: {
            id: runId,
            head_branch: "main",
            head_sha: backendRevision,
          },
        },
      ],
    },
    workerMainRef: {
      ref: "refs/heads/main",
      object: { type: "commit", sha: workerRevision },
    },
  };
}

async function runAuthorization({
  mutate,
  responseMode = "json",
  backendToken = "backend-actions-token",
} = {}) {
  const metadata = exactMetadata();
  mutate?.(metadata);
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "nutsnews-backend-transition-authorization-"),
  );
  const outputPath = path.join(tempDirectory, "authorization.json");
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({
      path: request.url,
      authorization: request.headers.authorization ?? null,
    });
    if (responseMode === "http-error") {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end('{"error":"unavailable"}');
      return;
    }
    if (responseMode === "redirect") {
      response.writeHead(302, { Location: "/fixed-redirect-target" });
      response.end();
      return;
    }
    const url = new URL(request.url, "http://127.0.0.1");
    let body;
    if (url.pathname.endsWith(`/actions/runs/${runId}`)) {
      body = metadata.run;
    } else if (
      url.pathname.endsWith(
        `/actions/runs/${runId}/attempts/${runAttempt}/jobs`,
      )
    ) {
      body = metadata.jobs;
    } else if (url.pathname.endsWith(`/actions/runs/${runId}/artifacts`)) {
      body = metadata.artifacts;
    } else if (url.pathname.endsWith("/git/ref/heads/main")) {
      body = metadata.workerMainRef;
    } else {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          authorizationScript,
          action,
          orchestrationId,
          backendRevision,
          workerRevision,
          outputPath,
        ],
        {
          cwd: controllerRoot,
          env: {
            ...process.env,
            GITHUB_TOKEN: "worker-repository-token",
            NUTSNEWS_BACKEND_ACTIONS_READ_TOKEN: backendToken,
            NUTSNEWS_GITHUB_API_BASE_URL: `http://127.0.0.1:${address.port}`,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
    });
    return {
      ...result,
      report: fs.existsSync(outputPath)
        ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
        : null,
      requests,
    };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test("exact in-progress backend metadata authorizes a controller transition", async () => {
  const result = await runAuthorization();

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.status, "authorized");
  assert.equal(result.report.backendRunId, runId);
  assert.equal(result.report.backendRunAttempt, runAttempt);
  assert.deepEqual(result.report.failedChecks, []);
  const backendRequests = result.requests.filter((request) =>
    request.path.includes("/nutsnews-backend/"),
  );
  const workerRequests = result.requests.filter((request) =>
    request.path.includes("/nutsnews-worker/"),
  );
  assert.equal(backendRequests.length, 3);
  assert(backendRequests.every(
    (request) => request.authorization === "Bearer backend-actions-token",
  ));
  assert.equal(workerRequests.length, 1);
  assert.equal(workerRequests[0].authorization, "Bearer worker-repository-token");
});

test("public backend metadata fallback never sends the worker repository token", async () => {
  const result = await runAuthorization({ backendToken: "" });

  assert.equal(result.exitCode, 0, result.stderr);
  const backendRequests = result.requests.filter((request) =>
    request.path.includes("/nutsnews-backend/"),
  );
  assert.equal(backendRequests.length, 3);
  assert(backendRequests.every((request) => request.authorization === null));
  const workerRequest = result.requests.find((request) =>
    request.path.includes("/nutsnews-worker/"),
  );
  assert.equal(workerRequest.authorization, "Bearer worker-repository-token");
});

const denialCases = [
  ["wrong action metadata", (data) => {
    data.run.display_title = data.run.display_title.replace("cutover", "rollback");
    data.artifacts.artifacts[0].name = data.artifacts.artifacts[0].name.replace(
      "cutover",
      "rollback",
    );
  }],
  ["wrong run attempt", (data) => { data.run.run_attempt = 3; }],
  ["wrong backend head SHA", (data) => { data.run.head_sha = "d".repeat(40); }],
  ["wrong display title", (data) => { data.run.display_title = "unrelated"; }],
  ["wrong actor", (data) => { data.run.actor.login = "someone-else"; }],
  ["wrong triggering actor", (data) => {
    data.run.triggering_actor.login = "someone-else";
  }],
  ["stale run", (data) => {
    data.run.run_started_at = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  }],
  ["stale authorization artifact", (data) => {
    data.artifacts.artifacts[0].created_at = new Date(
      Date.now() - 31 * 60 * 1000,
    ).toISOString();
  }],
  ["worker main moved", (data) => {
    data.workerMainRef.object.sha = "d".repeat(40);
  }],
  ["completed run", (data) => {
    data.run.status = "completed";
    data.run.conclusion = "success";
  }],
  ["duplicate artifact", (data) => {
    data.artifacts.artifacts.push({ ...data.artifacts.artifacts[0], id: 9877 });
  }],
  ["missing artifact", (data) => { data.artifacts.artifacts = []; }],
  ["expired artifact", (data) => { data.artifacts.artifacts[0].expired = true; }],
  ["wrong artifact digest", (data) => {
    data.artifacts.artifacts[0].digest = "md5:unsafe";
  }],
  ["wrong authorization job state", (data) => {
    data.jobs.jobs[0].conclusion = "failure";
  }],
  ["wrong action-specific handoff names", (data) => {
    data.jobs.jobs[0].name = "Authorize worker controller rollback handoff";
    data.jobs.jobs[1].steps[0].name = "Hold worker controller rollback handoff";
  }],
  ["wrong protected job state", (data) => {
    data.jobs.jobs[1].status = "completed";
    data.jobs.jobs[1].conclusion = "success";
  }],
  ["wrong protected operation step state", (data) => {
    data.jobs.jobs[1].steps[0].status = "completed";
    data.jobs.jobs[1].steps[0].conclusion = "success";
  }],
];

for (const [name, mutate] of denialCases) {
  test(`authorization denies ${name}`, async () => {
    const result = await runAuthorization({ mutate });

    assert.equal(result.exitCode, 1, result.stderr);
    assert.equal(result.report.status, "denied");
    assert(result.report.failedChecks.length > 0);
  });
}

for (const responseMode of ["http-error", "redirect"]) {
  test(`authorization fails closed on ${responseMode}`, async () => {
    const result = await runAuthorization({ responseMode });

    assert.notEqual(result.exitCode, 0);
    assert.equal(result.report, null);
  });
}
