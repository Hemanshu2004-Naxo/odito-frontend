import { describe, test, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { fetchAuditPdf, filenameFromDisposition, messageForFailure, saveBlob, PdfDownloadError } from './pdfDownload';
import { useExportPDF } from '../hooks/useExportPDF';

const pdfResponse = (over = {}) => {
  const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
  return {
    ok: true, status: 200, blob: async () => blob,
    ...over,
    headers: new Headers({ 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="odito-full-audit-acme-2026-01-01.pdf"', 'x-report-pages': '9', ...(over.headers || {}) }),
  };
};
const errResponse = (status, body) => ({
  ok: false, status,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
});
const opts = (fetchImpl) => ({ baseURL: 'http://api.test/api', getToken: () => 'tok', fetchImpl });

describe('fetchAuditPdf', () => {
  test('one authenticated GET to the backend download endpoint; returns the PDF blob and header filename', async () => {
    const f = vi.fn(async () => pdfResponse());
    const out = await fetchAuditPdf('abc123', opts(f));
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://api.test/api/pdf/abc123/download');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(out.filename).toBe('odito-full-audit-acme-2026-01-01.pdf');
    expect(out.blob.size).toBeGreaterThan(0);
    expect(out.pages).toBe(9);
  });

  test('passes the optional audit number and rejects invalid ones without a request', async () => {
    const f = vi.fn(async () => pdfResponse());
    await fetchAuditPdf('abc', { ...opts(f), auditNumber: 2 });
    expect(f.mock.calls[0][0]).toBe('http://api.test/api/pdf/abc/download?auditNumber=2');
    for (const bad of [0, -1, 1.5, 'x']) await expect(fetchAuditPdf('abc', { ...opts(f), auditNumber: bad })).rejects.toMatchObject({ code: 'INVALID_AUDIT_NUMBER' });
    await expect(fetchAuditPdf('all', opts(f))).rejects.toMatchObject({ code: 'INVALID_PROJECT' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  test.each([
    [401, null, /session has expired/],
    [403, null, /do not have access/],
    [404, 'AUDIT_NOT_FOUND', /audit could not be found/],
    [404, 'PROJECT_NOT_FOUND', /project could not be found/],
    [404, null, /not available on the server/],
    [503, null, /busy or unavailable/],
    [504, null, /took too long/],
    [500, null, /could not be generated/],
  ])('HTTP %s (%s) gives an actionable message', async (status, code, re) => {
    const f = vi.fn(async () => errResponse(status, { success: false, error: { code, message: null } }));
    await expect(fetchAuditPdf('abc', opts(f))).rejects.toThrow(re);
  });

  test('the backend\'s own message is shown for 400/503 when provided', async () => {
    const f = vi.fn(async () => errResponse(503, { success: false, error: { code: 'RENDERER_BUSY', message: 'The PDF service is busy. Please try again in a moment.' } }));
    await expect(fetchAuditPdf('abc', opts(f))).rejects.toThrow(/busy/);
  });

  test('a 200 that is not a PDF (e.g. an HTML login page) is rejected, never downloaded', async () => {
    const f = vi.fn(async () => pdfResponse({ headers: { 'content-type': 'text/html' } }));
    await expect(fetchAuditPdf('abc', opts(f))).rejects.toMatchObject({ code: 'NOT_A_PDF' });
  });

  test('an empty PDF body is rejected', async () => {
    const f = vi.fn(async () => pdfResponse({ blob: async () => new Blob([], { type: 'application/pdf' }) }));
    await expect(fetchAuditPdf('abc', opts(f))).rejects.toMatchObject({ code: 'EMPTY_PDF' });
  });

  test('network failure is a friendly error; AbortError passes through unchanged', async () => {
    await expect(fetchAuditPdf('abc', opts(async () => { throw new TypeError('Failed to fetch'); }))).rejects.toMatchObject({ code: 'NETWORK' });
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(fetchAuditPdf('abc', opts(async () => { throw abort; }))).rejects.toBe(abort);
  });
});

describe('filenames and saving', () => {
  test('filenames come from Content-Disposition but only safe characters survive', () => {
    expect(filenameFromDisposition('attachment; filename="odito-full-audit-x-2026-01-01.pdf"')).toBe('odito-full-audit-x-2026-01-01.pdf');
    expect(filenameFromDisposition('attachment; filename="../../evil\\name.pdf"')).toBe('evilname.pdf');
    expect(filenameFromDisposition('attachment; filename="notpdf.exe"')).toBe('odito-full-audit.pdf');
    expect(filenameFromDisposition(null)).toBe('odito-full-audit.pdf');
  });

  test('saveBlob clicks a temporary link with the filename and revokes the object URL afterwards', () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const el = { href: '', download: '', style: {}, click, remove: vi.fn() };
    const doc = { createElement: () => el, body: { appendChild: vi.fn() } };
    const urlApi = { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() };
    saveBlob(new Blob(['x']), 'a.pdf', { doc, urlApi });
    expect(el.download).toBe('a.pdf');
    expect(el.href).toBe('blob:x');
    expect(click).toHaveBeenCalledTimes(1);
    expect(el.remove).toHaveBeenCalled();
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
  });

  test('messageForFailure covers unknown statuses', () => {
    expect(messageForFailure(null, null, null)).toMatch(/failed/);
    expect(new PdfDownloadError('m', { code: 'C', status: 1 }).code).toBe('C');
  });
});

describe('useExportPDF', () => {
  const setup = (fetchImpl, save = vi.fn()) => ({ save, ...renderHook(() => useExportPDF({ baseURL: 'http://api.test/api', fetchImpl, save })) });

  test('success: loading toggles, the PDF is saved with the server filename, state is restored', async () => {
    let resolve;
    const f = vi.fn(() => new Promise((r) => { resolve = r; }));
    localStorage.setItem('token', 't');
    const { result, save } = setup(f);
    let p;
    act(() => { p = result.current.exportPDF('proj1', 'seo'); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    await act(async () => { resolve(pdfResponse()); await p; });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toBe('odito-full-audit-acme-2026-01-01.pdf');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('duplicate clicks while exporting send one request and one download', async () => {
    let resolve;
    const f = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { result, save } = setup(f);
    let p1; let p2; let p3;
    act(() => { p1 = result.current.exportPDF('proj1'); p2 = result.current.exportPDF('proj1'); p3 = result.current.exportPDF('proj1'); });
    await act(async () => { resolve(pdfResponse()); await Promise.all([p1, p2, p3]); });
    expect(f).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('failure: error message set, nothing saved, button state restored, and a retry works', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(errResponse(503, { success: false, error: { code: 'RENDERER_BUSY', message: 'The PDF service is busy. Please try again in a moment.' } }))
      .mockResolvedValueOnce(pdfResponse());
    const { result, save } = setup(f);
    await act(async () => { await expect(result.current.exportPDF('proj1')).rejects.toThrow(/busy/); });
    expect(result.current.error).toMatch(/busy/);
    expect(result.current.loading).toBe(false);
    expect(save).not.toHaveBeenCalled();
    await act(async () => { await result.current.exportPDF('proj1'); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  test('cancel aborts the request, saves nothing, reports no error and restores state', async () => {
    const f = vi.fn((url, init) => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }));
    const { result, save } = setup(f);
    let p;
    act(() => { p = result.current.exportPDF('proj1'); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    act(() => result.current.cancelExport());
    let out;
    await act(async () => { out = await p; });
    expect(out).toMatchObject({ cancelled: true });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('the selected audit number is sent; an invalid project id never reaches the network', async () => {
    const f = vi.fn(async () => pdfResponse());
    const { result } = setup(f);
    await act(async () => { await result.current.exportPDF('proj1', 'seo', { auditNumber: 3 }); });
    expect(f.mock.calls[0][0]).toContain('/pdf/proj1/download?auditNumber=3');
    await act(async () => { await expect(result.current.exportPDF('all')).rejects.toThrow(/Select a project/); });
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('the Full Audit export no longer uses client-side page capture', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hook = fs.readFileSync(path.resolve(process.cwd(), 'hooks/useExportPDF.js'), 'utf8');
    const service = fs.readFileSync(path.resolve(process.cwd(), 'services/pdfGeneratorService.js'), 'utf8');
    expect(hook).not.toMatch(/html2canvas|jspdf|pdfRenderer|pdfGeneratorService|reportPages/i);
    expect(service).not.toMatch(/reportPages|getReportPages|generatePDF\b/);
    expect(service).toMatch(/generateHomepageAuditPDF/); // Homepage Audit PDF is untouched
  });
});
