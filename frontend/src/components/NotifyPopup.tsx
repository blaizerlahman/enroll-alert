'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { auth } from '@/lib/firebase'

type Props = {
  open: boolean
  onOpenChange: (b: boolean) => void
  courseId: string
  sectionNum: string
  openSeats: number 
}

export default function NotifyPopup({
  open,
  onOpenChange,
  courseId,
  sectionNum,
  openSeats,
}: Props) {

  const closed = openSeats === 0

  const [mode, setMode] = useState<'any' | 'threshold'>(
    closed ? 'any' : 'threshold',
  )
  const [threshold, setThreshold] = useState('1')

  useEffect(() => {
    if (open) {
      setMode(closed ? 'any' : 'threshold')
      setThreshold('1')
    }
  }, [open, closed])

  const submit = async () => {
    if (mode === 'threshold' && Number(threshold) > openSeats) {
      toast.error(
        'Seats must be less than or equal to current open seats.'
      )
      return
    }

    try {
      const token = await auth.currentUser?.getIdToken()
      const body = {
        token,
        courseId,
        sectionNum,
        alertType: mode,
        seatThreshold: mode === 'threshold' ? Number(threshold) : null,
      }

      const res = await fetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        toast.success('Notification saved!')
        onOpenChange(false)
      } else {
        throw new Error()
      }
    } catch {
      toast.error('Could not save alert')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notify me when:</DialogTitle>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(val) => setMode(val as any)}>
          {closed && (
            <div className="flex items-center gap-2">
              <RadioGroupItem value="any" id="any" />
              <label htmlFor="any">Any seat opens</label>
            </div>
          )}

          
          {!closed && (
            <div className="flex items-center gap-2">
              <RadioGroupItem value="threshold" id="th" />
              <label htmlFor="th" className="flex items-center gap-2">
                Alert when ≤
                <Input
                  type="number"
                  min="1"
                  max={openSeats}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={mode !== 'threshold'}
                  className="w-16"
                />
                seats open
              </label>
            </div>
          )}
        </RadioGroup>

        <Button className="w-full" onClick={submit}>
          Save alert
        </Button>
      </DialogContent>
    </Dialog>
  )
}

