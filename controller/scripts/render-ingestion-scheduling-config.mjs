#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  return "Usage: render-ingestion-scheduling-config.mjs <true|false> <output-path> [report-path]";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function protectedControllerScope(config) {
  return stable({
    name: config.name,
    main: config.main,
    compatibility_date: config.compatibility_date,
    compatibility_flags: config.compatibility_flags,
    workers_dev: config.workers_dev,
    preview_urls: config.preview_urls,
    observability: config.observability,
    durable_objects: config.durable_objects,
    migrations: config.migrations,
    triggers: config.triggers,
    routes: config.routes ?? null,
    analytics_engine_datasets: config.analytics_engine_datasets ?? null,
  });
}

const [enabled, outputPath, reportPath] = process.argv.slice(2);
if (!new Set(["true", "false"]).has(enabled) || !outputPath) {
  console.error(usage());
  process.exit(2);
}

const controllerRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const inputPath = path.join(controllerRoot, "wrangler.jsonc");
const inputText = fs.readFileSync(inputPath, "utf8");
const config = JSON.parse(inputText);
const protectedBefore = protectedControllerScope(config);

if (!config.vars || typeof config.vars !== "object" || Array.isArray(config.vars)) {
  throw new Error("controller/wrangler.jsonc must declare an object vars map");
}

config.vars.INGESTION_SCHEDULING_ENABLED = enabled;

const protectedAfter = protectedControllerScope(config);
if (JSON.stringify(protectedAfter) !== JSON.stringify(protectedBefore)) {
  throw new Error("render changed a protected controller binding, route, cron, migration, or runtime field");
}

const outputText = `${JSON.stringify(config, null, 2)}\n`;
fs.writeFileSync(outputPath, outputText, { encoding: "utf8", mode: 0o600 });

const report = {
  schemaVersion: 1,
  safeMetadataOnly: true,
  status: "pass",
  desiredIngestionSchedulingEnabled: enabled === "true",
  sourceConfigSha256: sha256(inputText),
  renderedConfigSha256: sha256(outputText),
  protectedControllerScopeSha256: sha256(JSON.stringify(protectedBefore)),
  protectedControllerScopeUnchanged: true,
  preserves: {
    workerName: true,
    mainModule: true,
    compatibility: true,
    observability: true,
    durableObjectBindings: true,
    durableObjectMigrations: true,
    cronTriggers: true,
    routes: true,
    analyticsEngineBindings: true,
  },
};

if (reportPath) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

console.log(JSON.stringify(report));
