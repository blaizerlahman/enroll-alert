'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Command, CommandItem, CommandList } from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { auth } from '@/lib/firebase'

export type Subsection = { section_num: string; course_status?: 'OPEN'|'WAITLISTED'|'CLOSED' }

type Props = {
  open: boolean
  onOpenChange: (b: boolean) => void
  courseId: string
  sectionNum: string
  subsections?: Subsection[]
  lectureStatus?: 'OPEN'|'WAITLISTED'|'CLOSED'
}

export default function NotifyPopup({
  open,
  onOpenChange,
  courseId,
  sectionNum,
  subsections = [],
  lectureStatus,
}: Props) {
  const closedSubs  = subsections.filter(s => s.course_status !== 'OPEN')
  const hasClosed   = closedSubs.length > 0

  const [mode, setMode] = useState<'any'>('any')
  const [multiSubs,   setMultiSubs] = useState<string[]>([])
  const allChecked = multiSubs.length === closedSubs.length && hasClosed

  useEffect(() => {
    if (open) {
      setMultiSubs([])
      setMode('any')
    }
  }, [open])

  const submit = async () => {
    if (!auth.currentUser) {
      toast.error('You must be signed in to save alerts.')
      return
    }

    if (subsections.length === 0) {
      if (lectureStatus === 'OPEN') {
        toast.error('This section must be CLOSED or WAITLISTED to save an alert.')
        return
      }
    } else {
      if (multiSubs.length === 0) {
        toast.error('Select at least one closed/waitlisted subsection.')
        return
      }
    }

    try {
      const token = await auth.currentUser.getIdToken()

      const body  = {
        token,
        courseId,
        sectionNum:
          subsections.length === 0
            ? [sectionNum]
            : multiSubs,
        alertType:     'any',
      }

      const response  = await fetch('/api/notifications', {
        method: 'POST',
        body:   JSON.stringify(body),
        headers:{ 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Alert saved!')
        onOpenChange(false)
      } else if (response.status === 409 || response.status === 410) {
        toast.error(data.error)
      } else {
        throw new Error()
      }
    } catch {
      toast.error('Could not save alert.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-center">Notify me:</DialogTitle>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={() => setMode('any')}
          className="space-y-4"
        >
          {subsections.length === 0 ? (
            lectureStatus !== 'OPEN' ? (
              <label className="inline-flex items-center gap-2">
                <RadioGroupItem id="any-lecture" value="any" />
                When any seats open in&nbsp;<strong>{sectionNum}</strong>
              </label>
            ) : (
              <p className="text-center py-6 text-sm text-muted-foreground">
                Alerts can only be saved when the section is currently <strong>CLOSED/WAITLISTED</strong>. This section is currently <strong>{lectureStatus ?? 'UNKNOWN'}</strong>.
              </p>
            )
          ) : (
            <>
              {hasClosed ? (
                <label className="flex flex-col sm:flex-row items-center gap-2 text-center">
                  <div className="inline-flex items-center gap-2">
                    <RadioGroupItem id="any" value="any" />
                    When any seats open in
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mx-auto sm:mx-0 mt-2 sm:mt-0 w-36 truncate text-left"
                      >
                        {multiSubs.length ? multiSubs.join(', ') : 'Select sections'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-0">
                      <Command>
                        <CommandList>
                          <CommandItem>
                            <Checkbox
                              id="all-sections"
                              checked={allChecked}
                              onCheckedChange={c =>
                                setMultiSubs(
                                  c ? closedSubs.map(s => s.section_num) : [],
                                )
                              }
                            />
                            <Label htmlFor="all-sections" className="font-semibold">
                              All closed sections
                            </Label>
                          </CommandItem>
                          {closedSubs.map(s => (
                            <CommandItem key={s.section_num}>
                              <Checkbox
                                id={s.section_num}
                                checked={multiSubs.includes(s.section_num)}
                                onCheckedChange={() =>
                                  setMultiSubs(prev =>
                                    prev.includes(s.section_num)
                                      ? prev.filter(x => x !== s.section_num)
                                      : [...prev, s.section_num],
                                  )
                                }
                              />
                              <Label htmlFor={s.section_num}>{s.section_num}</Label>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </label>
              ) : (
                <p className="text-sm text-muted-foreground">
                  There are no closed subsections to watch for this lecture.
                </p>
              )}
            </>
          )}
        </RadioGroup>

        <Button
          variant="outline"
          className="w-full sm:w-60 mx-auto block border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white mt-6"
          onClick={submit}
          disabled={
            (subsections.length === 0 && lectureStatus === 'OPEN') ||
            (subsections.length > 0 && multiSubs.length === 0)
          }
        >
          Save alert
        </Button>
      </DialogContent>
    </Dialog>
  )
}
