import assert from "node:assert/strict";
import test from "node:test";

import { publicLabCaseBaseline } from "../lib/lab/lab-case-public.generated.ts";
import { frozenLabCaseRuntimePackages } from "../worker/generated/lab-case-history.generated.ts";
import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import {
  currentLabCaseRuntimePackage,
  findLabCaseRuntimePackage,
  labCaseRuntimePackages,
} from "../worker/lab/case-packages.ts";

const historicalHashes = {
  v1: "60e75a09b7043b00d18401ab272fe98536348adef8769ab38130a9a99af0466d",
  v2: "f2b85b61f1a727785c5e1043be4f2eba77bdc6059920ace1996d1cba50d0eccd",
  v3: "e2ef46b6e929a4303d1d43f8478c0169d3371991ef8756a61af4d3de28d70847",
  v4: "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353",
};

test("restores exact immutable runtime packages for v1 through v4", () => {
  assert.deepEqual(frozenLabCaseRuntimePackages.map((runtime) => runtime.caseVersion), ["v1", "v2", "v3", "v4"]);
  for (const runtime of frozenLabCaseRuntimePackages) {
    assert.equal(runtime.contentHash, historicalHashes[runtime.caseVersion]);
    assert.equal(runtime.caseId, "car-control");
    assert.equal(runtime.totalWeeks, 32);
    assert.equal(runtime.plans.baselineWorkload.weeks.length, 32);
    assert.ok(runtime.plans.documents.documents.length > 0);
    assert.equal(runtime.scenarios.length, 3);
  }
});

test("publishes the current source as a distinct v5 package", () => {
  assert.equal(publicLabCaseBaseline.caseVersion, "v5");
  assert.equal(privateLabCasePackage.caseVersion, "v5");
  assert.equal(currentLabCaseRuntimePackage.caseVersion, "v5");
  assert.equal(publicLabCaseBaseline.contentHash, privateLabCasePackage.contentHash);
  assert.equal(currentLabCaseRuntimePackage.contentHash, publicLabCaseBaseline.contentHash);
  assert.equal(Object.values(historicalHashes).includes(publicLabCaseBaseline.contentHash), false);
  assert.deepEqual([...new Set(labCaseRuntimePackages.map((runtime) => runtime.caseVersion))], ["v1", "v2", "v3", "v4", "v5"]);
  assert.equal(Object.values(privateLabCasePackage.sourceFiles).every((source) => source.caseVersion === "v5"), true);
});

test("selects branch rules only by an exact version and content hash pair", () => {
  for (const [version, contentHash] of Object.entries(historicalHashes)) {
    assert.equal(findLabCaseRuntimePackage("car-control", version, contentHash)?.caseVersion, version);
    assert.equal(findLabCaseRuntimePackage("car-control", version, `${contentHash}-changed`), null);
  }
  assert.equal(findLabCaseRuntimePackage("car-control", "v5", publicLabCaseBaseline.contentHash), currentLabCaseRuntimePackage);
  assert.equal(findLabCaseRuntimePackage("other-case", "v5", publicLabCaseBaseline.contentHash), null);
});
