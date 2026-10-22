import { PAGE_HEIGHT } from './pageSize';

/**
 * Block pagination for the screenshot-based renderer.
 *
 * Each report page is a fixed 960 x PAGE_HEIGHT capture, so content that may
 * run long is described as a list of blocks with estimated heights and split
 * into pages here, instead of being left to overflow and get clipped.
 *
 * Block kinds:
 *   { kind: 'heading', text, level?, h }            keeps with the block after it
 *   { kind: 'text', text, h }
 *   { kind: 'row', table, cells, h }                a table row (see tableRow)
 * Consecutive rows with the same `table` render as one <table>; the header is
 * repeated on each page where the table continues.
 */

export const LAYOUT = Object.freeze({
  pageHeight: PAGE_HEIGHT,
  headerH: 46,
  footerH: 46,
  bodyPadding: 64, // 32px top + 32px bottom
  sectionHeaderH: 105, // SectionHeader incl. margin
  continuedHeaderH: 70,
  tableHeaderH: 44,
  safety: 40, // estimation error margin
  tableWidth: 880,
});

/** Usable body height of an empty page. */
export const BODY_HEIGHT = LAYOUT.pageHeight - LAYOUT.headerH - LAYOUT.footerH - LAYOUT.bodyPadding - LAYOUT.safety;

const CHAR_PX = 7.4; // conservative average glyph width at 13px

/** Estimated wrapped line count for text in a column `px` wide. */
export function lineCount(text, px, charPx = CHAR_PX) {
  if (text === null || text === undefined) return 1;
  const perLine = Math.max(1, Math.floor((px - 28) / charPx));
  return String(text)
    .split('\n')
    .reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0);
}

/**
 * Build a table-row block. `columns` is the table spec ({key,label,width}),
 * widths are fractions summing to ~1. `cells` is an array of
 * { text, node? } (text drives the height estimate; node is what renders).
 */
export function tableRow(table, columns, cells, { minH = 40 } = {}) {
  let lines = 1;
  columns.forEach((c, i) => {
    const text = cells[i]?.text ?? '';
    lines = Math.max(lines, lineCount(text, LAYOUT.tableWidth * c.width));
  });
  return { kind: 'row', table, columns, cells, h: Math.max(minH, 22 + lines * 18) };
}

export const heading = (text, level = 3) => ({ kind: 'heading', text, level, h: level === 3 ? 52 : 40 });
export const textBlock = (text, { px = LAYOUT.tableWidth } = {}) => ({
  kind: 'text', text, h: 12 + lineCount(text, px, 6.6) * 17,
});

/**
 * Split blocks into pages.
 * @param {Array} blocks
 * @param {{firstCapacity:number, capacity?:number}} opts heights available on the
 *   first page (after any fixed content) and on each following page.
 * @returns {{ pages: Array<{blocks:Array, continuedTables:string[], continuesTable:string|null}> }}
 */
export function paginate(blocks, { firstCapacity, capacity = BODY_HEIGHT - LAYOUT.continuedHeaderH } = {}) {
  const pages = [];
  let cur = { blocks: [], used: 0, last: null };
  let cap = Math.max(0, firstCapacity);
  const seenTables = new Set();

  const startNewPage = () => {
    pages.push(cur);
    cur = { blocks: [], used: 0, last: null };
    cap = capacity;
  };
  // Height a block really needs on the current page (row that opens a table adds its header).
  const need = (b, last) => b.h + (b.kind === 'row' && b.table !== last ? LAYOUT.tableHeaderH : 0);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let required = need(b, cur.last);
    // Keep a heading with the content it introduces (and a table's first row with its header).
    if (b.kind === 'heading') {
      const next = blocks[i + 1];
      if (next) required += need(next, b.table ?? null);
    }
    if (cur.blocks.length > 0 && cur.used + required > cap) startNewPage();
    // A single block taller than an empty page is placed anyway (never dropped).
    const opensTable = b.kind === 'row' && b.table !== cur.last;
    cur.used += b.h + (opensTable ? LAYOUT.tableHeaderH : 0);
    cur.blocks.push({ ...b, opensTable, continuedTable: opensTable && seenTables.has(b.table) });
    if (b.kind === 'row') seenTables.add(b.table);
    cur.last = b.kind === 'row' ? b.table : null;
  }
  if (cur.blocks.length > 0 || pages.length === 0) pages.push(cur);

  return {
    pages: pages.map((p, i) => ({
      blocks: p.blocks,
      continuedTables: [...new Set(p.blocks.filter((b) => b.continuedTable).map((b) => b.table))],
      // Rows continue onto the next page when the next page opens with the same table.
      continuesTable:
        i < pages.length - 1 && p.last && pages[i + 1].blocks[0]?.kind === 'row' && pages[i + 1].blocks[0].table === p.last
          ? p.last
          : null,
    })),
  };
}
