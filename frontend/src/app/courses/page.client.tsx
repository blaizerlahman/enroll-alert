'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import AuthModal from '@/components/AuthModal'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandInput,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import NotifyPopup, { Subsection } from '@/components/NotifyPopup'
import { TERMS } from '@/lib/terms'

type Course = {
  course_id: string
  course_name: string
  course_title: string
  subject_id: number
  has_subsections: boolean
  course_status?: 'OPEN' | 'WAITLISTED' | 'CLOSED'
  total_sends?: number
  min_time_to_send?: number
  max_time_to_send?: number
  avg_time_to_send?: number
}

type Discussion = {
  section_num: string
  section_type: 'DIS' | 'LAB' | 'SEM'
  course_status?: 'OPEN' | 'WAITLISTED' | 'CLOSED'
}

type Lecture = {
  lecture_num: string
  professor: string
  course_status?: 'OPEN' | 'WAITLISTED' | 'CLOSED'
  discussions: Discussion[]
}

type NotifyTarget = {
  courseId: string
  section: string
  subsections: Subsection[]
  lectureStatus?: 'OPEN' | 'WAITLISTED' | 'CLOSED'
}

export default function CoursesClient({
  initialCourses,
  initialSubjects,
  initialBreadths,
  perPage,
  initialTerm,
} : {
  initialCourses: Course[]
  initialSubjects: string[]
  initialBreadths: string[]
  perPage: number
  initialTerm: number
}) {
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [sections, setSections] = useState<Record<string, Lecture[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [search, setSearch] = useState('')
  const [breadths, setBreadths] = useState<string[]>(initialBreadths)
  const [selectedBreadths, setSelectedBreadths] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>(initialSubjects)
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)

  const [prevFilters, setPrevFilters] = useState({
    search: '',
    subjectFilter: null as string | null,
    selectedBreadths: [] as string[],
  })

  const [notifyTarget, setNotifyTarget] =
    useState<NotifyTarget | null>(null)

  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  const [busy, setBusy] = useState(false)

  const [selectedTerm, setSelectedTerm] = useState<number>(initialTerm)
  const [termOpen, setTermOpen] = useState(false)
  const AVAILABLE_TERMS = [1266, 1272] as const


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u))
    return () => unsub()
  }, [])

  useEffect(() => {

    const filtersChanged =
      search !== prevFilters.search ||
      subjectFilter !== prevFilters.subjectFilter ||
      selectedBreadths.join(',') !== prevFilters.selectedBreadths.join(',')

    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (subjectFilter) params.set('subject', subjectFilter)
    if (selectedBreadths.length)
      params.set('breadths', selectedBreadths.join(','))
    params.set('page', page.toString())
    params.set('perPage', perPage.toString())
    params.set('term', selectedTerm.toString())

    fetch(`/api/courses?${params.toString()}`)
      .then(async r => {
        if (r.status === 503) {
          setBusy(true)
          setTimeout(() => setPage(p => p), 2000)
          return []
        }
        setBusy(false)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setCourses((prev) => {
            const merged = filtersChanged || page === 1 ? data : [...prev, ...data]
            const seen = new Map<string, Course>()

            for (const courseItem of merged) {
              const existing = seen.get(courseItem.course_id)
              if (!existing) {
                seen.set(courseItem.course_id, courseItem)
                continue
              }

              const existingHasStats = existing.total_sends != null
              const currentHasStats = courseItem.total_sends != null

              if (currentHasStats && !existingHasStats) {
                seen.set(courseItem.course_id, courseItem)
              } else if (currentHasStats === existingHasStats && currentHasStats) {
                if ((courseItem.total_sends ?? 0) > (existing.total_sends ?? 0)) {
                  seen.set(courseItem.course_id, courseItem)
                }
              }
            }

            return Array.from(seen.values())
          })
          setHasMore(data.length === perPage)
          setPrevFilters({ search, subjectFilter, selectedBreadths })
        } else {
          console.error('Course fetch error:', data)
          setCourses([])
        }
      })
  }, [search, subjectFilter, selectedBreadths, page, selectedTerm])

  useEffect(() => {
    fetch('/api/breadths').then((r) => r.json()).then(setBreadths)
  }, [])
  useEffect(() => {
    fetch(`/api/subjects?term=${selectedTerm}`).then((r) => r.json()).then(setSubjects)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, subjectFilter, selectedBreadths])

  useEffect(() => {
    setPage(1)
    setSections({})
    setExpanded({})
  }, [selectedTerm])

  const toggleBreadth = (b: string) => {
    setSelectedBreadths((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b],
    )
  }

  const formatDurationFromHours = (hours: number) => {
    const totalMinutes = Math.round(hours * 60)
    const days = Math.floor(totalMinutes / 1440)
    const hoursRemaining = Math.floor((totalMinutes % 1440) / 60)
    const minutes = totalMinutes % 60

    const parts: string[] = []
    if (days > 0) parts.push(`${days}d`)
    if (hoursRemaining > 0) parts.push(`${hoursRemaining}h`)
    parts.push(`${minutes}m`)

    return parts.join(' ')
  }

  const toggle = async (courseId: string) => {
    const cacheKey = `${courseId}-${selectedTerm}`
    if (expanded[cacheKey]) {
      setExpanded((p) => ({ ...p, [cacheKey]: false }))
      return
    }
    if (!sections[cacheKey]) {
      const res = await fetch(`/api/sections/${courseId}?term=${selectedTerm}`)
      const data = (await res.json()) as Lecture[]
      setSections((prev) => ({ ...prev, [cacheKey]: data }))
    }
    setExpanded((p) => ({ ...p, [cacheKey]: true }))
  }

  return (
    <div className="mb-4">
      <h1 className="sr-only">UW-Madison Course Seat Availability and Notifier</h1>
      {notifyTarget && (
        <NotifyPopup
          open={!!notifyTarget}
          onOpenChange={() => setNotifyTarget(null)}
          courseId={notifyTarget.courseId}
          sectionNum={notifyTarget.section}
          subsections={notifyTarget.subsections}
          lectureStatus={notifyTarget.lectureStatus}
          term={selectedTerm}
        />
      )}

      <Navbar
        search={search}
        setSearch={setSearch}
        isSignedIn={!!user}
        setShowAuth={setShowAuth}
      />

      {busy && (
        <p className="text-center text-blue-700 text-sm mb-2">
          Sorry, we are experiencing heavy traffic. We will retry loading your page shortly.
        </p>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <main className="pt-24 px-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Popover open={termOpen} onOpenChange={setTermOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] sm:w-[160px] justify-start">
                {TERMS[selectedTerm] ?? 'Select Term'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[160px] p-0">
              <Command value="">
                <CommandList>
                  <CommandGroup>
                    {AVAILABLE_TERMS.map((t) => (
                      <CommandItem
                        key={t}
                        value={String(t)}
                        onSelect={() => {
                          setSelectedTerm(t)
                          setTermOpen(false)
                        }}
                      >
                        {TERMS[t]}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] sm:w-[200px] justify-start">
                {subjectFilter ?? 'Select Subject'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search subject…" />
                <CommandEmpty>No subjects found.</CommandEmpty>
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setSubjectFilter(null)
                        setOpen(false)
                      }}
                    >
                      All Subjects
                    </CommandItem>
                    {subjects.map((s) => (
                      <CommandItem
                        key={s}
                        value={s}
                        onSelect={() => {
                          setSubjectFilter(s)
                          setOpen(false)
                        }}
                      >
                        {s}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap gap-4">
          {breadths.map((b) => (
            <div key={b} className="flex items-center space-x-2">
              <Checkbox
                id={`breadth-${b}`}
                checked={selectedBreadths.includes(b)}
                onCheckedChange={() => toggleBreadth(b)}
              />
              <Label htmlFor={`breadth-${b}`}>{b}</Label>
            </div>
          ))}
        </div>

        {courses.length === 0 ? (
          <p className="text-muted-foreground text-center italic mt-8">
            No courses found matching your search.
          </p>
        ) : (
          courses.map((course, idx) => {
            const status = course.course_status as 'OPEN' | 'WAITLISTED' | 'CLOSED'
            const isOpen = status === 'OPEN'
            const isWaitlisted = status === 'WAITLISTED'
            return (
              <Card
                key={`${course.course_id}-${idx}`}
                className="border-2 border-red-200"
              >
                <CardHeader className="flex justify-between items-start sm:items-center">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <CardTitle className="text-lg text-red-700">
                      {course.course_name}&nbsp;–&nbsp;
                      <span className="font-normal text-muted-foreground">
                        {course.course_title}
                      </span>
                    </CardTitle>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className={`h-6 px-2 py-0 text-xs ${
                        isOpen
                          ? 'border-green-600 text-green-600'
                          : isWaitlisted
                          ? 'border-yellow-600 text-yellow-600'
                          : 'border-red-600 text-red-600'
                      }`}
                    >
                      {isOpen ? 'Open' : isWaitlisted ? 'Waitlisted' : 'Closed'}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(course.course_id)}
                  >
                    {expanded[`${course.course_id}-${selectedTerm}`] ? 'Hide Sections' : 'Show Sections'}
                  </Button>
                </CardHeader>

                <CardContent className="space-y-1">
                  {expanded[`${course.course_id}-${selectedTerm}`] &&
                    sections[`${course.course_id}-${selectedTerm}`] && (
                      <div className="space-y-3 mt-3">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex-1 space-y-3">
                            {sections[`${course.course_id}-${selectedTerm}`].map((lec) => {
                              const lecStatus = lec.course_status as 'OPEN' | 'WAITLISTED' | 'CLOSED'
                              const lecHasClosedSub = lec.discussions.some(d => (d.course_status === 'CLOSED' || d.course_status === 'WAITLISTED'))
                              const canNotify = lecStatus === 'CLOSED' || lecStatus === 'WAITLISTED' || lecHasClosedSub
                              return (
                                <div key={lec.lecture_num}>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">
                                      LEC&nbsp;{lec.lecture_num}
                                      {lec.professor && lec.professor !== ' ' && ` — ${lec.professor}`}
                                    </span>

                                    <span
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                        lecStatus === 'OPEN'
                                          ? 'border-green-600 text-green-600'
                                          : lecStatus === 'WAITLISTED'
                                          ? 'border-yellow-600 text-yellow-600'
                                          : 'border-red-600 text-red-600'
                                      }`}
                                    >
                                      {lecStatus === 'OPEN' ? 'Open' : lecStatus === 'WAITLISTED' ? 'Waitlisted' : 'Closed'}
                                    </span>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setNotifyTarget({
                                          courseId: course.course_id,
                                          section: lec.lecture_num,
                                          subsections: lec.discussions.map((d) => ({
                                            section_num: d.section_num,
                                            course_status: d.course_status,
                                          })) as Subsection[],
                                          lectureStatus: lec.course_status,
                                        })
                                      }
                                      className={`h-6 px-2 py-0 text-xs font-semibold ${
                                        canNotify ? 'border-blue-600 bg-blue-600/10 text-blue-700 hover:bg-blue-600/20' : 'opacity-50 cursor-not-allowed'
                                      }`}
                                      disabled={!canNotify}
                                    >
                                      Notify&nbsp;Me
                                    </Button>
                                  </div>

                                  {lec.discussions.length > 0 && (
                                    <ul className="ml-4 list-disc">
                                      {lec.discussions.map((d) => {
                                        const dStatus = d.course_status as 'OPEN' | 'WAITLISTED' | 'CLOSED'
                                        return (
                                          <li key={d.section_num}>
                                            {d.section_type}&nbsp;{d.section_num}
                                            &nbsp;—&nbsp;Status:&nbsp;
                                            <span className="font-bold">
                                              {dStatus === 'OPEN' ? 'Open' : dStatus === 'WAITLISTED' ? 'Waitlisted' : 'Closed'}
                                            </span>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {(course.total_sends != null || course.min_time_to_send != null || course.max_time_to_send != null || course.avg_time_to_send != null) && (
                            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:w-64 lg:w-56">
                              {course.total_sends === 0 ? (
                                <p className="italic text-slate-600">
                                  No alerts have been sent for this course yet.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <div className="font-semibold text-slate-900 mb-2">Alert stats:</div>
                                  <div className="flex justify-between">
                                    <span>Total alerts sent:</span>
                                    <span className="font-semibold">{course.total_sends ?? '-'} </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Fastest send time:</span>
                                    <span className="font-semibold">
                                      {course.min_time_to_send != null ? formatDurationFromHours(course.min_time_to_send) : '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Longest send time:</span>
                                    <span className="font-semibold">
                                      {course.max_time_to_send != null ? formatDurationFromHours(course.max_time_to_send) : '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Average send time:</span>
                                    <span className="font-semibold">
                                      {course.avg_time_to_send != null ? formatDurationFromHours(course.avg_time_to_send) : '-'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
            )
          })
        )}

        {hasMore && (
          <Button onClick={() => setPage((p) => p + 1)}>Load More</Button>
        )}
      </main>
    </div>
  )
}
