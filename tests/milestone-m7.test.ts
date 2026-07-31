import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

assertRequiredDocuments();
assertM7ReportGateCoverage();
assertImplementationReadmeLinksM7();
assertRouteBoundaryScan();
assertPackageScript();

console.log("Milestone M7 backend v1 completion gate checks passed.");

function assertRequiredDocuments(): void {
  const required = [
    "docs/implementation/README.md",
    "docs/implementation/backend/README.md",
    "docs/implementation/backend/LWS_M1_SAFETY_BOUNDARY_IMPLEMENTATION_REPORT.md",
    "docs/implementation/backend/LWS_M2_DURABLE_MUTATION_RECOVERY_IMPLEMENTATION_REPORT.md",
    "docs/implementation/backend/LWS_M3_SQLITE_PROJECTION_IMPLEMENTATION_REPORT.md",
    "docs/implementation/backend/LWS_M4_PERMISSION_ENFORCEMENT_IMPLEMENTATION_REPORT.md",
    "docs/implementation/backend/LWS_M5_ADMIN_JOBS_OPERATIONAL_RECOVERY_IMPLEMENTATION_REPORT.md",
    "docs/implementation/backend/LWS_M6_API_CONTRACT_INTEGRATION_HARDENING_IMPLEMENTATION_REPORT.md",
    "docs/implementation/backend/LWS_M7_BACKEND_V1_COMPLETION_GATE_REPORT.md",
    "docs/implementation/backend/LWS_API_ROUTE_INVENTORY.md",
    "docs/implementation/frontend/README.md",
    "docs/implementation/frontend/LWS_FRONTEND_IMPLEMENTATION_MILESTONES.md",
    "docs/reference/LWS_GLOSSARY.md",
    "docs/reference/LWS_BACKEND_WARNING_AND_ERROR_CODES.md"
  ];

  for (const relativePath of required) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} must exist for the M7 gate`);
  }
}

function assertM7ReportGateCoverage(): void {
  const report = read("docs/implementation/backend/LWS_M7_BACKEND_V1_COMPLETION_GATE_REPORT.md");
  const expectedNeedles = [
    "Backend V1 Completion Gate",
    "V1 gate result: Pass",
    "M1 Safety Boundary Closure",
    "M2 Durable Mutation And Idempotent Recovery",
    "M3 SQLite Projection Completion",
    "M4 Permission Enforcement Completion",
    "M5 Admin Jobs And Operational Recovery",
    "M6 API Contract And Integration Hardening",
    "event byte_offset lookup optimization hardening",
    "event hash chain decision",
    "history checkpoint/compaction",
    "event node full materialization",
    "advanced FTS tuning",
    "vector/semantic search",
    "schema migration runner and rollback",
    "advanced observability dashboard",
    "advanced permission administration UI",
    "visual diff merge editor",
    "flowchart LR"
  ];

  for (const needle of expectedNeedles) {
    assert.equal(report.includes(needle), true, `M7 report must include: ${needle}`);
  }
}

function assertImplementationReadmeLinksM7(): void {
  const readme = read("docs/implementation/README.md");
  assert.equal(
    readme.includes("LWS_M7_BACKEND_V1_COMPLETION_GATE_REPORT.md"),
    true,
    "implementation README must link the M7 gate report"
  );
}

function assertPackageScript(): void {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts["test:milestone-m7"], "node --experimental-strip-types tests/milestone-m7.test.ts");
}

function assertRouteBoundaryScan(): void {
  const routeFiles = listRouteFiles(path.join(root, "src", "app", "api", "lws"));
  assert.equal(routeFiles.length > 0, true);

  const forbidden = [
    /\bbackend\.(objectStore|eventStore|indexStore|permissionService|jobService)\b/,
    /\brequest\.json\(/,
    /\bNumber\(/,
    /\bdecodeURIComponent\(/,
    /from\s+["'](?:node:)?fs["']/,
    /require\(["'](?:node:)?fs["']\)/
  ];

  for (const file of routeFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${path.relative(root, file)} matched ${pattern}`);
    }
  }
}

function listRouteFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listRouteFiles(candidate);
    }
    return entry.isFile() && entry.name === "route.ts" ? [candidate] : [];
  });
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
