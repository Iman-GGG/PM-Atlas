import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLabCasePackages } from "./build-lab-case-packages.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const publicOutputPath = path.join(projectRoot, "prototype", "lib", "lab", "lab-case-public.generated.ts");
const privateOutputPath = path.join(projectRoot, "prototype", "worker", "generated", "lab-case-private.generated.ts");
const scenarioPlanPath = path.join(projectRoot, "content", "lab-cases", "car-control", "v5", "scenario-plan.json");
const forbiddenTokens = [
  "minimumCorrectCardIds",
  "minimumCorrectConnections",
  "decisionReasoning",
  "necessaryManagementActions",
  "satisfiesActionIds",
  "evaluationRole",
  "consequenceId",
  "idealOutcome",
  "harmfulConsequences",
  "terminalRules",
  "scenarioOverrides",
];

await buildLabCasePackages();
const [publicSource, privateSource, scenarioPlanSource] = await Promise.all([
  readFile(publicOutputPath, "utf8"),
  readFile(privateOutputPath, "utf8"),
  readFile(scenarioPlanPath, "utf8"),
]);

const scenarioPlan = JSON.parse(scenarioPlanSource);
for (const scenario of scenarioPlan.scenarios) {
  forbiddenTokens.push(scenario.title);
  forbiddenTokens.push(...scenario.necessaryManagementActions.map((action) => action.id));
  forbiddenTokens.push(...scenario.cards.map((card) => card.id));
  forbiddenTokens.push(...Object.values(scenario.eventMaterials).flat().map((material) => material.id));
}

for (const token of forbiddenTokens) {
  if (publicSource.includes(token)) throw new Error(`Public package contains private token: ${token}`);
}
if (!privateSource.includes("necessaryManagementActions") || !privateSource.includes("satisfiesActionIds")) {
  throw new Error("Private package is missing rule-engine fields");
}
if (!publicSource.includes('"label": "从这里接手"')) throw new Error("Public package is missing takeover points");

console.log("Verified public projection contains no private scenario rules or future event titles.");
