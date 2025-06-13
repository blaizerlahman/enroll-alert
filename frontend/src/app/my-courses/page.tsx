'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { toast } from 'sonner'
import Navbar from '@/components/Navbar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Alert = {
  section_num: string
  section_type: string
  open_seats: number
  capacity: number
  enrolled: number
  waitlist_capacity: number
  waitlist_open_spots: number
  alert_type: 'any' | 'threshold'
  seat_threshold: number | null
}

type MyCourse = {
  course_id: string
  course_name: string
  course_title: string
  total_open: number
  total_enr: number
  total_cap: number
  total_wl_open: number
  total_wl_cap: number
  alerts: Alert[]
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<MyCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState<{
    courseId: string
    sectionNum: string
  } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace('/courses')
        return
      }
      const token = await u.getIdToken()
      const res = await fetch('/api/my-courses', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      setCourses(Array.isArray(data) ? data : [])
      setLoading(false)
    })
    return unsub
  }, [router])

  const handleDelete = async () => {
    if (!confirmTarget) return

    const user = auth.currentUser
    const token = await user.getIdToken()

    const res = await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        courseId: confirmTarget.courseId,
        sectionNum: [confirmTarget.sectionNum],
      }),
    })
    if (res.ok) {
      toast.success('Notification removed')
      // update local state
      setCourses((prev) =>
        prev
          .map((course) =>
            course.course_id === confirmTarget.courseId
              ? {
                  ...course,
                  alerts: course.alerts.filter(
                    (a) => a.section_num !== confirmTarget.sectionNum
                  ),
                }
              : course
          )
          .filter((course) => course.alerts.length > 0)
      )
    } else {
      toast.error('Failed to remove alert.')
    }
    setConfirmOpen(false)
    setConfirmTarget(null)
  }

  if (loading) return null

  if (courses.length === 0)
    return (
      <>
        <Navbar isSignedIn />
        <main className="pt-24 px-6 flex justify-center">
          <p className="text-muted-foreground italic text-center text-lg">
            No alerts saved yet.
          </p>
        </main>
      </>
    )

  return (
    <>
      <Navbar isSignedIn />

      <main className="pt-24 px-6 space-y-4">
        {courses.map((course) => (
          <Card key={course.course_id}>
            <CardHeader className="flex justify-between">
              <CardTitle className="text-lg">
                {course.course_name} –{' '}
                <span className="font-normal text-muted-foreground">
                  {course.course_title}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm">
                Enrolled {course.total_enr}/{course.total_cap} · Open{' '}
                {course.total_open} · Waitlist {course.total_wl_open}/
                {course.total_wl_cap}
              </p>

              <ul className="space-y-2">
                {course.alerts.map((a) => (
                  <li
                    key={`${a.section_type}-${a.section_num}`}
                    className="flex items-center justify-between"
                  >
                    <div>
                      {a.section_type} {a.section_num} — Seats open:{' '}
                      <strong>{a.open_seats}</strong> · Alert type:{' '}
                      <strong>
                        {a.alert_type === 'any'
                          ? 'any seat'
                          : `≤ ${a.seat_threshold}`}
                      </strong>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setConfirmTarget({
                          courseId: course.course_id,
                          sectionNum: a.section_num,
                        })
                        setConfirmOpen(true)
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm removal</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            You will no longer receive notifications for section{' '}
            <strong>{confirmTarget?.sectionNum}</strong>. Are you sure you want
            to remove it?
          </p>
          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

