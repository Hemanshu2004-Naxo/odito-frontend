"use client"

import { memo, useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Pill } from "../parts"
import { describeQuestionError } from "../format"

const MIN = 15
const MAX = 300

/**
 * One question. Editable ONLY while the set is a draft (`editable`); approved and archived sets render read-only, matching the server,
 * which refuses to edit them. Memoised and fed stable callbacks, so toggling one question does not re-render the other 40.
 *
 * `onToggle(id, enabled)` / `onSave(id, text)` return a promise that rejects with the API error; the row shows the server's message and
 * keeps what the user typed, so a refused edit is never silently lost.
 */
function QuestionRow({ question, editable, onToggle, onSave }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(question.text)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const trimmed = text.trim()
  const tooShort = trimmed.length < MIN
  const tooLong = trimmed.length > MAX
  const unchanged = trimmed === question.text

  const run = async (fn) => {
    if (busy) return
    setBusy(true); setError(null)
    try { await fn(); return true } catch (e) { setError(describeQuestionError(e)); return false } finally { setBusy(false) }
  }

  const save = async () => {
    if (tooShort || tooLong || unchanged) return
    const ok = await run(() => onSave(question.id, trimmed))
    if (ok) setEditing(false)
  }

  return (
    <li className={`py-3 ${question.enabled ? "" : "opacity-60"}`} data-testid={`question-${question.id}`}>
      <div className="flex items-start gap-3">
        {editable ? (
          <Switch
            checked={question.enabled} disabled={busy} aria-label={`${question.enabled ? "Disable" : "Enable"} question: ${question.text}`}
            onCheckedChange={(v) => run(() => onToggle(question.id, v))} className="mt-0.5"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div>
              <label htmlFor={`edit-${question.id}`} className="sr-only">Edit question</label>
              <Textarea id={`edit-${question.id}`} value={text} rows={3} onChange={(e) => setText(e.target.value)} aria-invalid={tooShort || tooLong ? true : undefined} />
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{tooShort ? `At least ${MIN} characters.` : tooLong ? `At most ${MAX} characters.` : "The server checks the wording before saving."}</span>
                <span className="tabular-nums">{trimmed.length}/{MAX}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={save} disabled={busy || tooShort || tooLong || unchanged}>{busy ? "Saving…" : "Save"}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditing(false); setText(question.text); setError(null) }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">{question.text}</p>
          )}

          {!editing ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {question.source === "user" ? <Pill tone="neutral">Edited by you</Pill> : null}
              {question.source === "openai" ? <Pill>Reworded by OpenAI</Pill> : null}
              {!question.enabled ? <Pill>Off</Pill> : null}
              {question.service ? <span>Service: {question.service}</span> : null}
              {question.location ? <span>Location: {question.location}</span> : null}
              {question.selectionReason ? <span className="truncate" title={question.selectionReason}>{question.selectionReason}</span> : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        {editable && !editing ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit question: ${question.text}`} disabled={busy} onClick={() => { setText(question.text); setEditing(true) }}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export default memo(QuestionRow)
