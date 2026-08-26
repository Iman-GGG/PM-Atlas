import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("fits the five compact project-file tables to the drawer canvas on desktop", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const tables = [
    "lab-v2-milestone-table",
    "lab-v2-material-allocation-table",
    "lab-v2-scope-deliverables-table",
    "lab-v2-team-assignment-table",
    "lab-v2-resource-requirement-table",
  ];

  for (const table of tables) {
    assert.match(timeline, new RegExp(`lab-v2-data-table-wrap lab-v2-fit-table-wrap"[\\s\\S]{0,160}<table className="${table}"`));
  }
  assert.match(styles, /\.lab-v2-data-table-wrap\.lab-v2-fit-table-wrap \{ overflow-x: hidden; \}/);
  assert.match(styles, /\.lab-v2-document-data \.lab-v2-milestone-table \{ min-width: 0;/);
  assert.match(styles, /\.lab-v2-document-data \.lab-v2-material-allocation-table \{ min-width: 0;/);
  assert.match(styles, /\.lab-v2-scope-statement \.lab-v2-scope-deliverables-table \{ width: 100%; min-width: 0;/);
  assert.match(styles, /\.lab-v2-document-data \.lab-v2-team-assignment-table \{ min-width: 0;/);
  assert.match(styles, /\.lab-v2-document-data \.lab-v2-resource-requirement-table \{ min-width: 0;/);
});

test("retains horizontal scrolling only at genuinely narrow widths", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const fitRule = ".lab-v2-data-table-wrap.lab-v2-fit-table-wrap { overflow-x: auto; }";
  const fitRuleIndex = styles.indexOf(fitRule);
  const mediaStart = styles.lastIndexOf("@media (max-width: 900px) {", fitRuleIndex);
  const nextMediaStart = styles.indexOf("@media (", fitRuleIndex + fitRule.length);
  const narrowRules = styles.slice(mediaStart, nextMediaStart === -1 ? undefined : nextMediaStart);

  assert.ok(mediaStart >= 0 && fitRuleIndex > mediaStart);
  assert.match(narrowRules, /\.lab-v2-data-table-wrap\.lab-v2-fit-table-wrap \{ overflow-x: auto; \}/);
  assert.match(narrowRules, /\.lab-v2-document-data \.lab-v2-milestone-table \{ min-width: 760px; \}/);
  assert.match(narrowRules, /\.lab-v2-document-data \.lab-v2-material-allocation-table \{ min-width: 720px; \}/);
  assert.match(narrowRules, /\.lab-v2-scope-statement \.lab-v2-scope-deliverables-table \{ min-width: 760px; \}/);
  assert.match(narrowRules, /\.lab-v2-document-data \.lab-v2-team-assignment-table \{ min-width: 900px; \}/);
  assert.match(narrowRules, /\.lab-v2-document-data \.lab-v2-resource-requirement-table \{ min-width: 760px; \}/);
});

test("keeps the final project file reachable at the bottom of the drawer list", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(timeline, /selectedDocument\.id === "D32"/);
  assert.match(styles, /\.lab-v2-document-layout > nav \{ display: flex; min-height: 0; flex-direction: column;/);
  assert.match(styles, /\.lab-v2-document-list \{ flex: 1 1 auto; min-height: 0; height: auto;[^}]+padding: 0 7px 24px 0;[^}]+overflow-y: auto;/);
});
