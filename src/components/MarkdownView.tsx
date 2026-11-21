import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  let key = 0;

  while (match !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#0F172A]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIdx = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

export function MarkdownView({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown table block
    if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const parseRow = (rowLine: string) =>
        rowLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
      const headers = parseRow(tableLines[0]);
      const bodyRows = tableLines.slice(2).map(parseRow);
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="border-b border-slate-200 px-3 py-2 font-semibold">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={key++} className="mt-4 mb-1.5 font-display text-[14px] font-semibold text-slate-900">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      i += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={key++} className="mt-4 mb-2 font-display text-[15px] font-semibold text-slate-900">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      i += 1;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2 key={key++} className="mt-4 mb-2 font-display text-[16px] font-bold text-slate-900">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="my-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    blocks.push(
      <p key={key++} className="my-2 text-[14px] leading-relaxed text-slate-700">
        {renderInline(trimmed)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-1">{blocks}</div>;
}
