'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import Navbar from '@/components/Navbar'
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
        {courses.map((c) => (
          <Card key={c.course_id}>
            <CardHeader className="flex justify-between">
              <CardTitle className="text-lg">
                {c.course_name} –&nbsp;
                <span className="font-normal text-muted-foreground">
                  {c.course_title}
                </span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled
                className={`h-6 px-2 py-0 text-xs ${
                  c.total_open > 0
                    ? 'border-green-600 text-green-600'
                    : 'border-red-600 text-red-600'
                }`}
              >
                {c.total_open > 0 ? 'Open' : 'Closed'}
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm">
                Enrolled {c.total_enr}/{c.total_cap} · Open&nbsp;
                {c.total_open} · Waitlist&nbsp;
                {c.total_wl_open}/{c.total_wl_cap}
              </p>

              <ul className="space-y-1">
                {c.alerts.map((a) => (
                  <li
                    key={`${a.section_type}-${a.section_num}`}
                    className="flex flex-col"
                  >
                    <div>
                      {a.section_type} {a.section_num} — Seats open:{' '}
                      <strong>{a.open_seats}</strong>
                    </div>

                    <div className="pl-[5.1rem]">
                      Alert type:&nbsp;
                      <strong>
                        {a.alert_type === 'any'
                          ? 'any seat'
                          : `≤ ${a.seat_threshold}`}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </main>
    </>
  )
}

