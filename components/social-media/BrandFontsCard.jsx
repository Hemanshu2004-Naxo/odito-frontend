"use client"

import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload, Type } from 'lucide-react'
import { ErrorNote, SECONDARY_BUTTON } from './FormField'
import { useUploadSocialBrandFont, useDeleteSocialBrandFont } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'

export const FONT_ACCEPT = '.ttf,.otf,.woff2'
export const MAX_FONT_MB = 5
const ROLES = [{ id: 'heading', label: 'Heading font' }, { id: 'body', label: 'Body font' }]
const WEIGHTS = [{ id: 'regular', label: 'Regular' }, { id: 'bold', label: 'Bold' }]

/** A file the browser can already tell is not acceptable (the server checks the real bytes, the family name and a test render). */
export function fontFileProblem(file) {
  if (!file) return null
  if (!/\.(ttf|otf|woff2)$/i.test(file.name || '')) return 'Upload a TTF, OTF or WOFF2 font file.'
  if (file.size > MAX_FONT_MB * 1024 * 1024) return `Font files must be ${MAX_FONT_MB} MB or smaller.`
  return null
}

/**
 * The brand's OWN font files, used in every design. Regular and bold for the heading font and the body font. The server reads the family
 * name from the file and test-renders it; a font it cannot draw is refused with the reason. Files stay private (only Odito's renderer
 * reads them). A font NAME without an uploaded file that Odito does not ship is drawn in a fallback font, and designs say so.
 */
export function BrandFontsCard({ projectId, fonts, names = {} }) {
  const upload = useUploadSocialBrandFont(projectId)
  const remove = useDeleteSocialBrandFont(projectId)
  const inputRef = useRef(null)
  const [target, setTarget] = useState(null) // { role, weight }
  const [localError, setLocalError] = useState(null)
  const busy = upload.isPending || remove.isPending
  const serverError = upload.isError ? describeApiError(upload.error, 'The font upload failed.').message : remove.isError ? describeApiError(remove.error, 'Could not remove the font.').message : null

  function pick(role, weight) { setTarget({ role, weight }); setLocalError(null); inputRef.current?.click() }
  function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !target) return
    const problem = fontFileProblem(file)
    setLocalError(problem)
    if (problem) return
    remove.reset()
    upload.mutate({ file, role: target.role, weight: target.weight })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="brand-fonts">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Type className="h-4 w-4 text-slate-500" aria-hidden />Brand fonts</h3>
      <p className="mt-1 text-sm text-slate-500">Upload your own font files and every design uses them. Files stay private to Odito&apos;s design renderer.</p>
      <div className="mt-4 space-y-4">
        {ROLES.map((r) => {
          const uploaded = WEIGHTS.some((w) => fonts?.[r.id]?.[w.id])
          const name = names[r.id]
          return (
            <div key={r.id} data-testid={`brand-font-${r.id}`}>
              <p className="text-sm font-semibold text-slate-800">{r.label}{name ? <span className="ml-2 font-normal text-slate-500">· {name}</span> : null}</p>
              {!uploaded && name && <p className="mt-0.5 text-xs text-amber-700" data-testid={`brand-font-${r.id}-fallback`}>No file uploaded: if Odito does not ship “{name}”, designs use a fallback font and say so.</p>}
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {WEIGHTS.map((w) => {
                  const f = fonts?.[r.id]?.[w.id]
                  const pending = busy && target?.role === r.id && target?.weight === w.id
                  return (
                    <li key={w.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2" data-testid={`brand-font-${r.id}-${w.id}`}>
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-slate-700">{w.label}</span>
                        <span className="block truncate text-xs text-slate-500">{f ? `${f.family} · ${f.format.toUpperCase()} · ${Math.round(f.size / 1024)} KB` : 'Not uploaded'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => pick(r.id, w.id)} disabled={busy} aria-label={`${f ? 'Replace' : 'Upload'} ${r.label.toLowerCase()} ${w.label.toLowerCase()}`} className={SECONDARY_BUTTON}>
                          {pending && upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}{f ? 'Replace' : 'Upload'}
                        </button>
                        {f && (
                          <button type="button" onClick={() => { setTarget({ role: r.id, weight: w.id }); upload.reset(); remove.mutate({ role: r.id, weight: w.id }) }} disabled={busy} aria-label={`Remove ${r.label.toLowerCase()} ${w.label.toLowerCase()}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60">
                            {pending && remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      <input ref={inputRef} type="file" accept={FONT_ACCEPT} onChange={onFile} className="hidden" aria-label="Choose a font file" data-testid="brand-font-input" />
      <p className="mt-3 text-xs text-slate-400">TTF, OTF or WOFF2, up to {MAX_FONT_MB} MB per file. Only upload fonts your licence lets you use in designs.</p>
      <ErrorNote className="mt-3">{localError || serverError}</ErrorNote>
    </div>
  )
}

export default BrandFontsCard
