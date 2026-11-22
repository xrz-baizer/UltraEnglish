import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
export interface Note {
  id: string
  text: string
  label: string
  from?: number
  to?: number
}
interface Props {
  audioId: string
  segmentId: string
  selection: { from: number; to: number } | null
  onNotesChange?: (notes: Note[]) => void
  editorRequest: number
  fontSize?: number
  selectedText: string
}
export function AudioNotes({
  audioId,
  segmentId,
  selection,
  selectedText,
  onNotesChange,
  editorRequest,
  fontSize = 13
}: Props) {
  const { t } = useTranslation()
  const noteTextSize = `calc(${fontSize + 2}px * var(--font-scale, 1))`
  const key = `audio-notes:${audioId}:${segmentId}`
  const [notes, setNotes] = useState<Note[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  useEffect(() => {
    if (editorRequest > 0) setEditorOpen(true)
  }, [editorRequest])
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  useEffect(() => {
    if (!editorOpen) return
    const input = inputRef.current
    input?.focus({preventScroll:true})
    const scroller = input?.closest<HTMLElement>('.sentence-scroll')
    if (input && scroller) {
      const field=input.getBoundingClientRect(), viewport=scroller.getBoundingClientRect()
      if (field.top<viewport.top || field.bottom>viewport.bottom) scroller.scrollTop+=field.top-viewport.top-12
    }
  }, [editorOpen, editorRequest, editing?.id])
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) setNotes(JSON.parse(saved))
      else {
        const prefix = `audio-note:${audioId}:${segmentId}`
        const legacy: Note[] = []
        for (let index = 0; index < localStorage.length; index++) {
          const oldKey = localStorage.key(index)!
          if (oldKey !== prefix && !oldKey.startsWith(prefix + ':words:'))
            continue
          const text = localStorage.getItem(oldKey)
          if (!text) continue
          const match = oldKey.match(/:words:(\d+)-(\d+)$/)
          legacy.push({
            id: oldKey,
            text,
            label: match
              ? `${t('audio.wordNote')} ${Number(match[1]) + 1}–${Number(match[2]) + 1}`
              : t('audio.note'),
            ...(match ? { from: Number(match[1]), to: Number(match[2]) } : {})
          })
        }
        setNotes(legacy)
      }
    } catch {
      toast.error(t('audio.noteLoadFailed'))
    }
    setEditorOpen(false)
    setDraft('')
    setEditing(null)
    setFocused(false)
  }, [key, audioId, segmentId, t])
  useEffect(() => {
    onNotesChange?.(notes)
  }, [notes, onNotesChange])
  const persist = (next: Note[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setNotes(next)
      return true
    } catch {
      toast.error(t('audio.noteSaveFailed'))
      return false
    }
  }
  const save = () => {
    if (!draft.trim()) return
    const item: Note = editing
      ? { ...editing, text: draft.trim() }
      : {
          id: crypto.randomUUID(),
          text: draft.trim(),
          label: selection ? selectedText : '',
          ...(selection
            ? {
                from: Math.min(selection.from, selection.to),
                to: Math.max(selection.from, selection.to)
              }
            : {})
        }
    if (
      persist(
        editing
          ? notes.map((note) => (note.id === item.id ? item : note))
          : [...notes, item]
      )
    ) {
      setEditorOpen(false)
      setDraft('')
      setEditing(null)
      setFocused(false)
      toast.success(t('audio.noteSaved'))
    }
  }
  return (
    <section className="audio-notes space-y-3 border-t pt-4">
      {editorOpen && (
        <label className="block text-sm">
          {editing ? editing.label : selection ? selectedText : ''}
          <textarea
            ref={inputRef}
            aria-label={t('audio.noteDraft')}
            className="glass-field note-draft mt-2 min-h-20 w-full rounded-lg border p-3"
            style={{ fontSize: noteTextSize }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
      )}
      {editorOpen && (focused || !!draft.trim() || editing) && (
        <div className="flex justify-end gap-2">
          {editorOpen && (
            <button
              className="secondary-button"
              onClick={() => {
                setEditorOpen(false)
                setEditing(null)
                setDraft('')
              }}
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            className="primary-button"
            disabled={!draft.trim()}
            onClick={save}
          >
            {t('audio.saveNote')}
          </button>
        </div>
      )}
      {notes.map((note) => (
        <article
          key={note.id}
          className="rounded-xl border bg-background/60 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <strong className="text-sm text-primary-ink">
              {note.from !== undefined ? note.label : ''}
            </strong>
            <div className="flex gap-3 text-xs">
              <button
                onClick={() => {
                  setEditorOpen(true)
                  setEditing(note)
                  setDraft(note.text)
                }}
              >
                {t('audio.editNote')}
              </button>
              <button
                onClick={() =>
                  persist(notes.filter((item) => item.id !== note.id))
                }
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
          <p
            className="mt-2 whitespace-pre-wrap break-words"
            style={{ fontSize: noteTextSize }}
          >
            {note.text}
          </p>
        </article>
      ))}
    </section>
  )
}
