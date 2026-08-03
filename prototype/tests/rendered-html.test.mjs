import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the PM Atlas knowledge workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>PM Atlas｜项目管理知识库与项目实验室<\/title>/i);
  assert.match(html, /项目管理渐进式学习/);
  assert.match(html, /知识库/);
  assert.match(html, /项目实验室/);
  assert.match(html, /32[^<]*<\/strong><span>项目文档/);
  assert.match(html, /133[^<]*<\/strong><span>工具和技术/);
  assert.doesNotMatch(html, /Codex/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("keeps the production entry point free of starter artifacts", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import \{ PrototypeApp \} from "\.\/prototype-app"/);
  assert.match(page, /<PrototypeApp \/>/);
  assert.match(layout, /title:\s*"PM Atlas｜项目管理知识库与项目实验室"/);
  assert.match(layout, /description:\s*"面向新项目经理/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|Starter Project/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
