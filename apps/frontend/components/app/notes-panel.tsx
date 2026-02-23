'use client'

import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/components/app/i18n-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getDeleteNoteEndpoint, getNotesEndpoint } from '@/lib/api'
import { parseApiError, readStoredAccessToken } from '@/lib/auth-client'

interface NoteItem {
  id: string
  text: string
  createdAt: string
  updatedAt: string
}

interface NotesListResponse {
  maxLength?: number
  items?: NoteItem[]
}

interface NoteCreateResponse {
  item?: NoteItem
}

const FALLBACK_MAX_LENGTH = 2000

export function NotesPanel() {
  const { locale, t } = useI18n()

  const [notes, setNotes] = useState<NoteItem[]>([])
  const [noteText, setNoteText] = useState('')
  const [maxLength, setMaxLength] = useState(FALLBACK_MAX_LENGTH)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmedNoteLength = useMemo(() => noteText.trim().length, [noteText])

  const formatCreatedAt = useMemo(() => {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }, [locale])

  const loadNotes = useCallback(async () => {
    setIsLoading(true)

    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setErrorMessage(t('dashboard.needAuth'))
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(getNotesEndpoint(), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as NotesListResponse
      setNotes(payload.items ?? [])
      setMaxLength(payload.maxLength && payload.maxLength > 0 ? payload.maxLength : FALLBACK_MAX_LENGTH)
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const canCreateNote = trimmedNoteLength > 0 && trimmedNoteLength <= maxLength && !isCreating

  const createNote = useCallback(async () => {
    if (!canCreateNote) {
      return
    }

    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setErrorMessage(t('dashboard.needAuth'))
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch(getNotesEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: noteText }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as NoteCreateResponse
      const createdItem = payload.item
      if (createdItem?.id && createdItem.createdAt) {
        setNotes(currentNotes => [createdItem, ...currentNotes])
      }

      setNoteText('')
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorMessage(message)
    } finally {
      setIsCreating(false)
    }
  }, [canCreateNote, noteText, t])

  const deleteNote = useCallback(
    async (noteId: string) => {
      const accessToken = readStoredAccessToken()
      if (!accessToken) {
        setErrorMessage(t('dashboard.needAuth'))
        return
      }

      setDeletingNoteId(noteId)

      try {
        const response = await fetch(getDeleteNoteEndpoint(noteId), {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        setNotes(currentNotes => currentNotes.filter(note => note.id !== noteId))
        setErrorMessage(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setErrorMessage(message)
      } finally {
        setDeletingNoteId(null)
      }
    },
    [t],
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('notes.createTitle')}</CardTitle>
          <CardDescription>{t('notes.maxLengthHint', { maxLength: String(maxLength) })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="note-text">{t('notes.noteLabel')}</Label>
            <Textarea
              id="note-text"
              value={noteText}
              onChange={event => setNoteText(event.target.value)}
              maxLength={maxLength}
              placeholder={t('notes.notePlaceholder')}
              rows={4}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {trimmedNoteLength}/{maxLength}
            </p>
            <Button onClick={createNote} disabled={!canCreateNote}>
              {isCreating ? t('notes.saving') : t('notes.add')}
            </Button>
          </div>

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('notes.listTitle')}</CardTitle>
          <CardDescription>{t('notes.listSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('notes.empty')}</p>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <Card key={note.id}>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">{t('notes.createdAt')}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatCreatedAt.format(new Date(note.createdAt))}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">{note.text}</p>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void deleteNote(note.id)}
                        disabled={deletingNoteId === note.id}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingNoteId === note.id ? t('notes.deleting') : t('notes.delete')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
