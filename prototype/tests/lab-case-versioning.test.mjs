import assert from "node:assert/strict";
import test from "node:test";

import { publicLabCaseBaseline } from "../lib/lab/lab-case-public.generated.ts";
import { frozenLabCaseRuntimePackages } from "../worker/generated/lab-case-history.generated.ts";
import { frozenLabCaseV5RuntimePackage } from "../worker/generated/lab-case-v5-frozen.generated.ts";
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
  v5: "a1b0a1b786181e520f17755c4975c68c23e24fb3311d6b0a3681ece806b205c1",
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

test("keeps the v5 runtime package frozen with its published hash", () => {
  assert.equal(frozenLabCaseV5RuntimePackage.caseVersion, "v5");
  assert.equal(frozenLabCaseV5RuntimePackage.contentHash, historicalHashes.v5);
  assert.equal(frozenLabCaseV5RuntimePackage.plans.iterations, undefined);
});

test("publishes the current source as a distinct v6 package", () => {
  assert.equal(publicLabCaseBaseline.caseVersion, "v6");
  assert.equal(privateLabCasePackage.caseVersion, "v6");
  assert.equal(currentLabCaseRuntimePackage.caseVersion, "v6");
  assert.equal(publicLabCaseBaseline.contentHash, privateLabCasePackage.contentHash);
  assert.equal(currentLabCaseRuntimePackage.contentHash, publicLabCaseBaseline.contentHash);
  assert.equal(Object.values(historicalHashes).includes(publicLabCaseBaseline.contentHash), false);
  assert.deepEqual([...new Set(labCaseRuntimePackages.map((runtime) => runtime.caseVersion))], ["v1", "v2", "v3", "v4", "v5", "v6"]);
  assert.equal(Object.values(privateLabCasePackage.sourceFiles).every((source) => source.caseVersion === "v6"), true);
  assert.equal(publicLabCaseBaseline.plans.iterations.sprints.length, 10);
});

test("selects branch rules only by an exact version and content hash pair", () => {
  for (const [version, contentHash] of Object.entries(historicalHashes)) {
    assert.equal(findLabCaseRuntimePackage("car-control", version, contentHash)?.caseVersion, version);
    assert.equal(findLabCaseRuntimePackage("car-control", version, `${contentHash}-changed`), null);
  }
  assert.equal(findLabCaseRuntimePackage("car-control", "v6", publicLabCaseBaseline.contentHash), currentLabCaseRuntimePackage);
  assert.equal(findLabCaseRuntimePackage("other-case", "v6", publicLabCaseBaseline.contentHash), null);
});
