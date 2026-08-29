"use client";

import { useEffect, useMemo, useRef } from "react";
import { resolveKnowledgeEntry } from "./knowledge-entry-data";

export { knowledgeReferenceExists } from "./knowledge-entry-data";

export function KnowledgeEntryDrawer({ referenceId, onClose }: { referenceId: string; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const entry = useMemo(() => resolveKnowledgeEntry(referenceId), [referenceId]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  if (!entry) return null;

  return (
    <div className="lab-v2-knowledge-backdrop" onClick={onClose}>
      <aside className="lab-v2-knowledge-drawer" role="dialog" aria-modal="true" aria-label={`${entry.displayId} ${entry.title}知识条目`} onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span>PM ATLAS / KNOWLEDGE ENTRY</span><small>{entry.kind} · {entry.category}</small><h2><b>{entry.displayId}</b>{entry.title}</h2></div>
          <button ref={closeButtonRef} type="button" onClick={onClose}>关闭</button>
        </header>
        <section className="lab-v2-knowledge-content">
          <span>正式条目</span>
          <p>{entry.content}</p>
        </section>
        {entry.related.length > 0 && <section className="lab-v2-knowledge-related">
          <span>相关知识</span>
          <div>{entry.related.map((item) => <i key={item.id}>{item.title}</i>)}</div>
        </section>}
        <footer><span>来源</span><strong>{entry.sourcePath ? `PM Atlas 知识库 · ${entry.sourcePath}` : "PM Atlas 正式知识库"}</strong><p>关闭侧栏后继续当前情景；分支、周次、材料和行动链不会重置。</p></footer>
      </aside>
    </div>
  );
}
