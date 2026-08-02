"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CASE_PROJECT_NAME } from "./data";
import { documentTemplates, type DocumentTemplate } from "./document-templates";
import { managementAreaById, type LabAreaId } from "./management-area-data";
import { downloadWordDocument } from "./word-export";

type AreaId = Exclude<LabAreaId, "overview">;
type FormValues = Record<string, string>;
type FormState = Record<string, FormValues>;
type TableState = Record<string, string[][]>;

const DEFAULT_PROJECT_NAME = CASE_PROJECT_NAME;

function blankRows(template: DocumentTemplate, count = 3) {
  const columnCount = template.columns?.length ?? 0;
  return Array.from({ length: count }, () => Array.from({ length: columnCount }, () => ""));
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "项目文档";
}

export function DocumentWorkspace({
  areaId,
  projectName = DEFAULT_PROJECT_NAME,
}: {
  areaId: AreaId;
  projectName?: string;
}) {
  const area = managementAreaById[areaId];
  const templates = useMemo(
    () => documentTemplates.filter((template) => template.areaId === areaId),
    [areaId],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [formState, setFormState] = useState<FormState>({});
  const [tableState, setTableState] = useState<TableState>({});
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?.id ?? "");
    }
  }, [selectedTemplateId, templates]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const selectedProcess = selectedTemplate
    ? area.processes.find((process) => process.id === selectedTemplate.processId) ?? area.processes[0]
    : area.processes[0];

  const currentForm = selectedTemplate ? formState[selectedTemplate.id] ?? {} : {};
  const currentRows = selectedTemplate
    ? tableState[selectedTemplate.id] ?? blankRows(selectedTemplate)
    : [];

  const completion = useMemo(() => {
    if (!selectedTemplate) return { complete: 0, total: 0 };
    if (selectedTemplate.kind === "form") {
      const fields = selectedTemplate.fields ?? [];
      return {
        complete: fields.filter((field) => currentForm[field.id]?.trim()).length,
        total: fields.length,
      };
    }
    const rowsWithContent = currentRows.filter((row) => row.some((value) => value.trim()));
    return {
      complete: rowsWithContent.reduce(
        (total, row) => total + row.filter((value) => value.trim()).length,
        0,
      ),
      total: rowsWithContent.length * (selectedTemplate.columns?.length ?? 0),
    };
  }, [currentForm, currentRows, selectedTemplate]);

  const updateField = (fieldId: string, value: string) => {
    if (!selectedTemplate) return;
    setFormState((current) => ({
      ...current,
      [selectedTemplate.id]: {
        ...(current[selectedTemplate.id] ?? {}),
        [fieldId]: value,
      },
    }));
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    if (!selectedTemplate) return;
    setTableState((current) => {
      const rows = (current[selectedTemplate.id] ?? blankRows(selectedTemplate)).map((row) => [...row]);
      rows[rowIndex][columnIndex] = value;
      return { ...current, [selectedTemplate.id]: rows };
    });
  };

  const addRow = () => {
    if (!selectedTemplate) return;
    setTableState((current) => ({
      ...current,
      [selectedTemplate.id]: [
        ...(current[selectedTemplate.id] ?? blankRows(selectedTemplate)),
        Array.from({ length: selectedTemplate.columns?.length ?? 0 }, () => ""),
      ],
    }));
  };

  const removeRow = (rowIndex: number) => {
    if (!selectedTemplate) return;
    setTableState((current) => {
      const rows = current[selectedTemplate.id] ?? blankRows(selectedTemplate);
      const nextRows = rows.filter((_, index) => index !== rowIndex);
      return {
        ...current,
        [selectedTemplate.id]: nextRows.length ? nextRows : blankRows(selectedTemplate, 1),
      };
    });
  };

  const exportCurrent = useCallback(() => {
    if (!selectedTemplate || !selectedProcess) return;
    const rows = (tableState[selectedTemplate.id] ?? blankRows(selectedTemplate))
      .filter((row) => row.some((value) => value.trim()));

    downloadWordDocument({
      fileName: `${safeFileName(projectName)}-${safeFileName(selectedTemplate.title)}.docx`,
      title: selectedTemplate.title,
      projectName,
      areaName: area.title,
      processName: selectedProcess.title,
      fields: selectedTemplate.kind === "form"
        ? (selectedTemplate.fields ?? []).map((field) => ({
            label: field.label,
            value: formState[selectedTemplate.id]?.[field.id] ?? "",
          }))
        : undefined,
      table: selectedTemplate.kind === "table"
        ? { headers: selectedTemplate.columns ?? [], rows }
        : undefined,
    });
    setExportStatus(`已生成《${selectedTemplate.title}》Word`);
    window.setTimeout(() => setExportStatus(null), 3200);
  }, [area.title, formState, projectName, selectedProcess, selectedTemplate, tableState]);

  useEffect(() => {
    const handleHeaderExport = () => exportCurrent();
    window.addEventListener("pm-atlas-export-word", handleHeaderExport);
    return () => window.removeEventListener("pm-atlas-export-word", handleHeaderExport);
  }, [exportCurrent]);

  if (!selectedTemplate) return null;

  return (
    <section className="document-workspace-section" id={`${areaId}-document-workspace`}>
      <div className="knowledge-section-heading document-workspace-heading">
        <div>
          <span className="section-index">Excel 模板库 · {templates.length} 份</span>
          <h2>{area.title}文档填写工作台</h2>
        </div>
        <p>选择模板后直接填写；灰色示例只作填写提示，不会自动写入当前项目。</p>
      </div>

      <div className="document-workspace-layout">
        <aside className="document-template-shelf" aria-label={`${area.title}文档模板`}>
          <header>
            <span>文档目录</span>
            <strong>{templates.length} 份模板</strong>
            <small>点击模板名称开始填写</small>
          </header>
          <div className="document-template-groups">
            {templates.map((template) => {
              const itemCount = template.kind === "form"
                ? template.fields?.length ?? 0
                : template.columns?.length ?? 0;
              return (
                <button
                  key={template.id}
                  className={selectedTemplate.id === template.id ? "active" : ""}
                  aria-pressed={selectedTemplate.id === template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <span>{template.kind === "form" ? "表单" : "动态表"}</span>
                  <strong>{template.title}</strong>
                  <small>{itemCount} {template.kind === "form" ? "个字段" : "列"}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="document-editor-panel">
          <header className="document-editor-header">
            <div>
              <span className="section-index">{selectedProcess.group}过程组 · {selectedProcess.title}</span>
              <h3>{selectedTemplate.title}</h3>
              <p>来源：{selectedTemplate.sourceWorkbook}</p>
            </div>
            <div className="document-editor-progress">
              <span>填写进度</span>
              <strong>{completion.complete}<small> / {completion.total || (selectedTemplate.kind === "table" ? "待新增" : 0)}</small></strong>
            </div>
          </header>

          {selectedTemplate.kind === "form" ? (
            <div className="document-form-grid">
              {(selectedTemplate.fields ?? []).map((field, index) => (
                <label className={field.placeholder.length > 160 ? "document-field document-field-wide" : "document-field"} key={field.id}>
                  <span><i>{String(index + 1).padStart(2, "0")}</i>{field.label}</span>
                  <textarea
                    rows={field.placeholder.length > 160 ? 6 : 4}
                    value={currentForm[field.id] ?? ""}
                    placeholder={field.placeholder || `填写${field.label}`}
                    onChange={(event) => updateField(field.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="document-table-editor">
              <div className="document-table-toolbar">
                <div><strong>动态行</strong><span>已添加 {currentRows.length} 行；空行不会导出</span></div>
                <button className="button button-small" onClick={addRow}>＋ 添加一行</button>
              </div>
              <div className="document-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>行</th>
                      {(selectedTemplate.columns ?? []).map((column) => <th key={column}>{column}</th>)}
                      <th><span className="sr-only">操作</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row, rowIndex) => (
                      <tr key={`${selectedTemplate.id}-row-${rowIndex}`}>
                        <th>{String(rowIndex + 1).padStart(2, "0")}</th>
                        {(selectedTemplate.columns ?? []).map((column, columnIndex) => (
                          <td key={`${column}-${columnIndex}`}>
                            <textarea
                              rows={2}
                              aria-label={`第 ${rowIndex + 1} 行，${column}`}
                              value={row[columnIndex] ?? ""}
                              placeholder={selectedTemplate.sampleRows?.[rowIndex]?.[columnIndex] ?? `填写${column}`}
                              onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                            />
                          </td>
                        ))}
                        <td><button className="document-row-remove" aria-label={`删除第 ${rowIndex + 1} 行`} onClick={() => removeRow(rowIndex)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <footer className="document-editor-actions">
            <div>
              <strong>{projectName}</strong>
              <span>当前内容仅保存在本次浏览会话</span>
            </div>
            <button className="button button-dark" onClick={exportCurrent}>导出《{selectedTemplate.title}》Word <span>↓</span></button>
          </footer>
          {exportStatus && <div className="document-export-status" role="status">✓ {exportStatus}</div>}
        </article>
      </div>
    </section>
  );
}
