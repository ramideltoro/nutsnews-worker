#!/usr/bin/env node

console.error(
  "Direct controller deployment is disabled because it can change ingestion ownership. " +
    "Use Worker Pipeline for a state-preserving deploy or Controller Ingestion Scheduling Operations for a protected transition.",
);
process.exit(1);
