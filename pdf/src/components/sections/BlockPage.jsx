'use client';

import React from 'react';
import { PageHeader, PageFooter, SectionHeader } from '../layout';
import { PAGE_HEIGHT } from '../../pageSize';

const frame = {
  width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
  flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
  margin: '0 auto', fontFamily: "'DM Sans', sans-serif",
};

/** Group consecutive row blocks of the same table so each renders as one <table>. */
function groupBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.kind === 'row' && last && last.kind === 'table' && last.table === b.table) last.rows.push(b);
    else if (b.kind === 'row') out.push({ kind: 'table', table: b.table, columns: b.columns, continued: b.continuedTable, rows: [b] });
    else out.push(b);
  }
  return out;
}

function TableGroup({ g, continuesNext }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {g.continued && (
        <div style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px' }}>Table continued from the previous page</div>
      )}
      <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            {g.columns.map((c) => <col key={c.key} style={{ width: `${c.width * 100}%` }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: '#111827' }}>
              {g.columns.map((c) => (
                <th key={c.key} style={{ padding: '11px 14px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA', pageBreakInside: 'avoid' }}>
                {r.cells.map((c, j) => (
                  <td key={j} style={{ padding: '10px 14px', color: '#374151', verticalAlign: 'top', wordBreak: 'break-word' }}>
                    {c.node ?? c.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {continuesNext && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6, textAlign: 'right' }}>Continued on the next page</div>}
    </div>
  );
}

/**
 * One report page made of blocks. `intro` (fixed content already budgeted by
 * the caller) renders on the first page of a section only.
 */
export default function BlockPage({ num, title, subtitle, isFirst, intro, page, pageNo }) {
  const groups = groupBlocks(page.blocks);
  return (
    <div style={frame}>
      <PageHeader page={pageNo} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num={num} title={isFirst ? title : `${title} (continued)`} subtitle={isFirst ? subtitle : undefined} />
        {isFirst && intro}
        {groups.map((g, i) => {
          if (g.kind === 'heading') {
            return (
              <h3 key={i} style={{
                fontSize: g.level === 3 ? 17 : 14, fontWeight: 700, margin: g.level === 3 ? '8px 0 12px' : '4px 0 8px',
                fontFamily: "'Inter', sans-serif", color: '#111827',
              }}>{g.text}</h3>
            );
          }
          if (g.kind === 'text') {
            return <p key={i} style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, margin: '0 0 12px' }}>{g.text}</p>;
          }
          const isLastGroup = i === groups.length - 1;
          return <TableGroup key={i} g={g} continuesNext={isLastGroup && page.continuesTable === g.table} />;
        })}
      </div>
      <PageFooter page={pageNo} />
    </div>
  );
}
