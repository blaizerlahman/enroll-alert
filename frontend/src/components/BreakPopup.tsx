'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function BreakPopup() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const closed = localStorage.getItem('enrollalert:breakClosed')
    if (!closed) setOpen(true)
  }, [])

  const close = () => {
    localStorage.setItem('enrollalert:breakClosed', '1')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else setOpen(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex flex-col items-center gap-4">
          <Image
            src="/enrollalert_logo_transparent.png"
            alt="EnrollAlert logo"
            width={84}
            height={84}
          />
          <DialogTitle className="text-center text-2xl font-bold text-red-700">
            EnrollAlert is currently on break
          </DialogTitle>
        </DialogHeader>

        <p className="py-4 text-center text-m text-muted-foreground">
          EnrollAlert is on break until enrollment for the Spring 2025 semester begins.
          Check back in soon!
        </p>
      </DialogContent>
    </Dialog>
  )
}

