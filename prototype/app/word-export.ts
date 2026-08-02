export type WordField = { label: string; value: string };
export type WordTable = { headers: string[]; rows: string[][] };

export type WordDocumentData = {
  fileName: string;
  title: string;
  projectName: string;
  areaName: string;
  processName: string;
  fields?: WordField[];
  table?: WordTable;
};

const encoder = new TextEncoder();

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, content.length);
    writeUint32(localView, 22, content.length);
    writeUint16(localView, 26, name.length);
    writeUint16(localView, 28, 0);
    localChunks.push(localHeader, name, content);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, content.length);
    writeUint32(centralView, 24, content.length);
    writeUint16(centralView, 28, name.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralChunks.push(centralHeader, name);

    localOffset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  return concatBytes([...localChunks, centralDirectory, end]);
}

function paragraph(text: string, style?: "Title" | "Heading1" | "Meta") {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  const lines = text.split("\n");
  const runs = lines.map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`).join("");
  return `<w:p>${styleXml}${runs}</w:p>`;
}

function tableCell(text: string, width: number, header = false) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:fill="EDEDED"/>' : ""}</w:tcPr><w:p><w:r>${header ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(text || " ")}</w:t></w:r></w:p></w:tc>`;
}

function wordTable(headers: string[], rows: string[][], usableWidth: number) {
  const width = Math.floor(usableWidth / Math.max(headers.length, 1));
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7B7B7"/><w:left w:val="single" w:sz="4" w:color="B7B7B7"/><w:bottom w:val="single" w:sz="4" w:color="B7B7B7"/><w:right w:val="single" w:sz="4" w:color="B7B7B7"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders>';
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((item) => tableCell(item, width, true)).join("")}</w:tr>`;
  const bodyRows = rows.map((row) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${headers.map((_, index) => tableCell(row[index] ?? "", width)).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${usableWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${headers.map(() => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>`;
}

export function buildWordDocument(data: WordDocumentData) {
  const tableColumns = data.table?.headers.length ?? 0;
  const landscape = tableColumns > 6;
  const largeLandscape = tableColumns > 10;
  const pageWidth = largeLandscape ? 23811 : landscape ? 16838 : 11906;
  const pageHeight = largeLandscape ? 16838 : landscape ? 11906 : 16838;
  const pageMargin = largeLandscape ? 900 : 1080;
  const usableWidth = pageWidth - pageMargin * 2;
  const body: string[] = [
    paragraph(data.title, "Title"),
    paragraph(`项目：${data.projectName}`, "Meta"),
    paragraph(`管理领域：${data.areaName}    管理活动：${data.processName}`, "Meta"),
    paragraph(`导出日期：${new Date().toLocaleDateString("zh-CN")}`, "Meta"),
  ];

  if (data.fields?.length) {
    for (const field of data.fields) {
      body.push(paragraph(field.label, "Heading1"));
      body.push(paragraph(field.value || "（待填写）"));
    }
  }

  if (data.table) {
    body.push(paragraph("文档明细", "Heading1"));
    const rows = data.table.rows.length ? data.table.rows : [data.table.headers.map(() => "")];
    body.push(wordTable(data.table.headers, rows, usableWidth));
  }

  body.push(`<w:sectPr><w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${pageMargin}" w:right="${pageMargin}" w:bottom="${pageMargin}" w:left="${pageMargin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}</w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial Unicode MS" w:hAnsi="Arial Unicode MS" w:eastAsia="Arial Unicode MS" w:cs="Arial Unicode MS"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="70"/></w:pPr><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const documentRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(data.title)}</dc:title><dc:creator>PM Atlas</dc:creator><cp:lastModifiedBy>PM Atlas</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PM Atlas</Application></Properties>`;

  return zipStore([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: relationships },
    { name: "docProps/core.xml", content: core },
    { name: "docProps/app.xml", content: app },
    { name: "word/document.xml", content: documentXml },
    { name: "word/styles.xml", content: stylesXml },
    { name: "word/_rels/document.xml.rels", content: documentRelationships },
  ]);
}

export function downloadWordDocument(data: WordDocumentData) {
  const bytes = buildWordDocument(data);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = data.fileName.endsWith(".docx") ? data.fileName : `${data.fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
