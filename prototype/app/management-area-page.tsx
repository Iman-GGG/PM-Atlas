import type { ManagementArea, ManagementProcess } from "./management-area-data";
import { CASE_PROJECT_NAME } from "./data";
import { DocumentWorkspace } from "./document-workspace";

export function ActivityInputOutputSummary({ process }: { process: ManagementProcess }) {
  return (
    <section className="activity-io-strip" aria-label={`${process.title}输入输出`}>
      <div><span>主要输入</span><p>{process.inputs.map((item) => <strong key={item}>{item}</strong>)}</p></div>
      <i aria-hidden="true">→</i>
      <div className="activity-io-center"><span>{process.group}过程组</span><strong>{process.title}</strong></div>
      <i aria-hidden="true">→</i>
      <div><span>主要输出</span><p>{process.outputs.map((item) => <strong key={item}>{item}</strong>)}</p></div>
    </section>
  );
}

export function ManagementAreaPage({ area }: { area: ManagementArea }) {
  const focusProcess = area.processes.find((item) => item.id === area.focusProcessId) ?? area.processes[0];
  const groups = Array.from(new Set(area.processes.map((item) => item.group)));

  return (
    <main className="management-area-page">
      <section className="management-activity-intro">
        <div>
          <span className="section-index">{area.title} · {CASE_PROJECT_NAME}</span>
          <h1>{area.title}</h1>
          <p>{area.description}</p>
        </div>
        <div className="management-intro-stats">
          <div><span>子活动</span><strong>{area.processes.length}</strong></div>
          <div><span>涉及过程组</span><strong>{groups.length}</strong></div>
          <div><span>当前展开</span><strong>{focusProcess.title}</strong></div>
        </div>
      </section>

      <section className="focus-process-section">
        <div className="knowledge-section-heading">
          <div><span className="section-index">当前样本 · {focusProcess.group}过程组</span><h2>{focusProcess.title}</h2></div>
          <p>{focusProcess.purpose}</p>
        </div>
        <div className="focus-process-flow panel" aria-label={`${focusProcess.title}主要输入输出`}>
          <div className="focus-flow-side">
            <span>主要输入</span>
            {focusProcess.inputs.map((item) => <strong key={item}>{item}</strong>)}
          </div>
          <div className="focus-flow-arrow" aria-hidden="true">→</div>
          <div className="focus-flow-process"><small>{focusProcess.group}过程组</small><strong>{focusProcess.title}</strong><p>{focusProcess.purpose}</p></div>
          <div className="focus-flow-arrow" aria-hidden="true">→</div>
          <div className="focus-flow-side focus-flow-output">
            <span>主要输出</span>
            {focusProcess.outputs.map((item) => <strong key={item}>{item}</strong>)}
          </div>
        </div>
      </section>

      <section className="area-process-section">
        <div className="knowledge-section-heading">
          <div><span className="section-index">完整输入输出</span><h2>{area.title}的全部管理活动</h2></div>
          <span className="area-process-count">{area.processes.length} 个活动 · 按教材顺序排列</span>
        </div>
        <div className="area-process-grid">
          {area.processes.map((item, index) => (
            <article className={`area-process-card ${item.id === area.focusProcessId ? "active" : ""}`} key={item.id}>
              <header><span>{String(index + 1).padStart(2, "0")}</span><small>{item.group}过程组</small><h3>{item.title}</h3><p>{item.purpose}</p></header>
              <div className="area-process-io">
                <section><span>输入</span><ul>{item.inputs.map((input) => <li key={input}>{input}</li>)}</ul></section>
                <section><span>输出</span><ul>{item.outputs.map((output) => <li key={output}>{output}</li>)}</ul></section>
              </div>
            </article>
          ))}
        </div>
      </section>

      <DocumentWorkspace areaId={area.id} />
    </main>
  );
}
