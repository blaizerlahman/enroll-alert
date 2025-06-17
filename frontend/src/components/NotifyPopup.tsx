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
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { auth } from '@/lib/firebase'

export type Subsection = { section_num: string; open_seats: number }

type Props = {
  open: boolean
  onOpenChange: (b: boolean) => void
  courseId: string
  sectionNum: string
  openSeats: number
  subsections: Subsection[]
}

export default function NotifyPopup({
  open,
  onOpenChange,
  courseId,
  sectionNum,
  openSeats,
  subsections,
}: Props) {
  const closedSubs = subsections.filter(s => s.open_seats === 0)
  const alreadyOpen = subsections.filter(s => s.open_seats > 0)
  const hasClosed = closedSubs.length > 0
  const hasOpen = alreadyOpen.length > 0

  const [mode, setMode] = useState<'any' | 'threshold'>('any')
  const [threshold, setThreshold] = useState('1')
  const [multiSubs, setMultiSubs] = useState<string[]>([])
  const [singleSub, setSingleSub] = useState('')

  const allChecked = multiSubs.length === closedSubs.length && hasClosed
  const chosenOpenSeats =
    alreadyOpen.find(s => s.section_num === singleSub)?.open_seats ?? 0

  useEffect(() => {
    if (open) {
      setMode(hasClosed ? 'any' : 'threshold')
      setThreshold('1')
      setMultiSubs([])
      setSingleSub('')
    }
  }, [open, hasClosed])

  useEffect(() => {
    if (!hasClosed && !hasOpen) return
    if (mode === 'any' && !hasClosed) setMode('threshold')
    if (mode === 'threshold' && !hasOpen) setMode('any')
  }, [mode, hasClosed, hasOpen])

  const multiBtn = multiSubs.length ? multiSubs.join(', ') : 'Select sections'
  const singleBtn = singleSub || 'Select section'

  const submit = async () => {
    if (!auth.currentUser) {
      toast.error('You must be signed in to save alerts.')
      return
    }
    if (mode === 'any' && subsections.length > 0 && multiSubs.length === 0) {
      toast.error('Select at least one subsection.')
      return
    }
    if (mode === 'threshold') {
      if (subsections.length > 0) {
        if (!singleSub) {
          toast.error('Select a subsection.')
          return
        }
        if (+threshold > chosenOpenSeats) {
          toast.error('Threshold exceeds current open seats.')
          return
        }
      } else {
        if (+threshold > openSeats) {
          toast.error('Threshold exceeds current open seats.')
          return
        }
      }
    }

    try {
      const token = await auth.currentUser.getIdToken()

      // create request body that contains section alert info
      const body = {
        token,
        courseId,
        sectionNum:
          subsections.length === 0
            ? [sectionNum]
            : mode === 'any'
            ? multiSubs
            : [singleSub],
        alertType: mode,
        seatThreshold: mode === 'threshold' ? +threshold : null,
      }

      // get response body from notifications API call
      const response = await fetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      // return success if alert successfully saved or error otherwise
      if (response.ok) {
        toast.success('Alert saved!')
        onOpenChange(false)
      } else if (response.status === 409) {
        toast.error(data.error)
      } else if (response.status === 410) {
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
          <DialogTitle>Notify me:</DialogTitle>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={v => setMode(v as 'any' | 'threshold')}
          className="space-y-4"
        >
          {subsections.length === 0 ? (
            openSeats === 0 ? (
              <div className="flex items-center gap-2">
                <RadioGroupItem id="any-lecture" value="any" />
                <label htmlFor="any-lecture">
                  When any seats open in {sectionNum}
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <RadioGroupItem id="th-lecture" value="threshold" />
                <label htmlFor="th-lecture" className="flex items-center gap-2">
                  When&nbsp;≤
                  <Input
                    type="number"
                    min="1"
                    max={openSeats}
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    className="w-16"
                    disabled={mode !== 'threshold'}
                  />
                  seats open in {sectionNum}
                </label>
              </div>
            )
          ) : (
            <>
              {hasClosed && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="any" value="any" />
                  <label htmlFor="any" className="flex items-center gap-2">
                    When any seats open in
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-40 truncate text-left"
                        >
                          {multiBtn}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0">
                        <Command>
                          <CommandList>
                            <CommandItem>
                              <Checkbox
                                id="all-sections"
                                checked={allChecked}
                                onCheckedChange={checked =>
                                  setMultiSubs(
                                    checked
                                      ? closedSubs.map(s => s.section_num)
                                      : []
                                  )
                                }
                              />
                              <Label
                                htmlFor="all-sections"
                                className="font-semibold"
                              >
                                All sections
                              </Label>
                            </CommandItem>
                            {closedSubs.map(s => (
                              <CommandItem key={s.section_num}>
                                <Checkbox
                                  id={s.section_num}
                                  checked={multiSubs.includes(s.section_num)}
                                  onCheckedChange={() =>
                                    setMultiSubs(prev => {
                                      const next = prev.includes(s.section_num)
                                        ? prev.filter(x => x !== s.section_num)
                                        : [...prev, s.section_num]
                                      return next
                                    })
                                  }
                                />
                                <Label htmlFor={s.section_num}>
                                  {s.section_num}
                                </Label>
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </label>
                </div>
              )}
              {hasOpen && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="th" value="threshold" />
                  <label htmlFor="th" className="flex items-center gap-2">
                    When&nbsp;≤
                    <Input
                      type="number"
                      min="1"
                      max={chosenOpenSeats || 1}
                      value={threshold}
                      onChange={e => setThreshold(e.target.value)}
                      className="w-16"
                      disabled={mode !== 'threshold'}
                    />
                    seats open in
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-40 truncate text-left"
                        >
                          {singleBtn}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandList>
                            {alreadyOpen.map(s => (
                              <CommandItem
                                key={s.section_num}
                                onSelect={() => setSingleSub(s.section_num)}
                              >
                                {s.section_num} ({s.open_seats})
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </label>
                </div>
              )}
            </>
          )}
        </RadioGroup>

        <Button className="w-full mt-6" onClick={submit}>
          Save alert
        </Button>
      </DialogContent>
    </Dialog>
  )
}

