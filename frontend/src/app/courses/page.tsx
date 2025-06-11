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
import NotifyPopup from '@/components/NotifyPopup'

type Course = {
  course_id: string
  course_name: string
  course_title: string
  subject_id: number
  total_enrolled: number
  total_capacity: number
  total_open_seats: number
  total_waitlist_capacity: number
  total_waitlist_open: number
  has_subsections: boolean
}

type Discussion = {
  section_num: string
  section_type: 'DIS' | 'LAB' | 'SEM'
  capacity: number
  enrolled: number
  open_seats: number
  waitlist_capacity: number
  waitlist_open_spots: number
}

type Lecture = {
  lecture_num: string
  professor: string
  capacity: number
  enrolled: number
  open_seats: number
  waitlist_capacity: number
  waitlist_open_spots: number
  discussions: Discussion[]
}

export default function CoursesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  const [courses, setCourses] = useState<Course[]>([])
  const [sections, setSections] = useState<Record<string, Lecture[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [search, setSearch] = useState('')
  const [breadths, setBreadths] = useState<string[]>([])
  const [selectedBreadths, setSelectedBreadths] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)

  const [prevFilters, setPrevFilters] = useState({
    search: '',
    subjectFilter: null as string | null,
    selectedBreadths: [] as string[],
  })

  const [notifyTarget, setNotifyTarget] =
    useState<{ courseId: string; section: string; openSeats: number } | null>(
      null,
    )

  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const perPage = 20

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

    fetch(`/api/courses?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCourses(
            filtersChanged || page === 1 ? data : (prev) => [...prev, ...data],
          )
          setPrevFilters({ search, subjectFilter, selectedBreadths })
        } else {
          console.error('Course fetch error:', data)
          setCourses([])
        }
      })
  }, [search, subjectFilter, selectedBreadths, page])

  useEffect(() => {
    fetch('/api/breadths').then((r) => r.json()).then(setBreadths)
  }, [])
  useEffect(() => {
    fetch('/api/subjects').then((r) => r.json()).then(setSubjects)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, subjectFilter, selectedBreadths])

  const toggleBreadth = (b: string) => {
    setSelectedBreadths((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b],
    )
  }

  const toggle = async (courseId: string) => {
    if (expanded[courseId]) {
      setExpanded((p) => ({ ...p, [courseId]: false }))
      return
    }
    if (!sections[courseId]) {
      const res = await fetch(`/api/sections/${courseId}`)
      const data = (await res.json()) as Lecture[]
      setSections((prev) => ({ ...prev, [courseId]: data }))
    }
    setExpanded((p) => ({ ...p, [courseId]: true }))
  }

  return (
    <div>

      {notifyTarget && (
        <NotifyPopup
          open={!!notifyTarget}
          onOpenChange={() => setNotifyTarget(null)}
          courseId={notifyTarget.courseId}
          sectionNum={notifyTarget.section}
          openSeats={notifyTarget.openSeats}
        />
      )}

      <Navbar
        search={search}
        setSearch={setSearch}
        isSignedIn={!!user}
        setShowAuth={setShowAuth}
      />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <main className="pt-24 px-6 space-y-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start">
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
            const isOpen = course.total_open_seats > 0
            return (
              <Card key={`${course.course_id}-${idx}`}>
                <CardHeader className="flex justify-between items-start sm:items-center">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <CardTitle className="text-lg">
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
                          : 'border-red-600 text-red-600'
                      }`}
                    >
                      {isOpen ? 'Open' : 'Closed'}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(course.course_id)}
                  >
                    {expanded[course.course_id] ? 'Hide Sections' : 'Show Sections'}
                  </Button>
                </CardHeader>

                <CardContent className="space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-3">
                    <span className="inline-flex items-center rounded-full border-2 px-3 py-1 text-base font-medium">
                      Currently Enrolled:&nbsp;{course.total_enrolled}/{course.total_capacity}
                    </span>
                    <span className="inline-flex items-center rounded-full border-2 px-3 py-1 text-base font-medium">
                      Open Seats:&nbsp;{course.total_open_seats}
                    </span>
                    <span className="inline-flex items-center rounded-full border-2 px-3 py-1 text-base font-medium">
                      Waitlist:&nbsp;{course.total_waitlist_open}/{course.total_waitlist_capacity}
                    </span>
                  </div>  

                  {expanded[course.course_id] &&
                    sections[course.course_id] && (
                      <div className="space-y-3 mt-3">
                        {sections[course.course_id].map((lec) => (
                          <div key={lec.lecture_num}>

                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                LEC&nbsp;{lec.lecture_num}
                                {lec.professor && lec.professor !== ' ' && ` — ${lec.professor}`}
                              </span>

                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium
                                  ${lec.open_seats > 0
                                    ? 'border-green-600 text-green-600'
                                    : 'border-red-600 text-red-600'
                                  }`}
                              >
                                {lec.open_seats > 0 ? 'Open' : 'Closed'}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setNotifyTarget({ 
                                    courseId: course.course_id, 
                                    section: lec.lecture_num,
                                    openSeats: lec.open_seats,
                                  })
                                }
                                className="h-6 px-2 py-0 text-xs font-semibold border-blue-600 bg-blue-600/10 text-blue-700 hover:bg-blue-600/20"
                              >
                                Notify&nbsp;Me
                              </Button>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Enrolled {lec.enrolled}/{lec.capacity}
                              &nbsp;·&nbsp;Open {lec.open_seats}
                              &nbsp;·&nbsp;Waitlist{' '}
                              {lec.waitlist_open_spots}/{lec.waitlist_capacity}
                            </p>

                            {lec.discussions.length > 0 && (
                              <ul className="ml-4 list-disc">
                                {lec.discussions.map((d) => (
                                  <li key={d.section_num}>
                                    {d.section_type}&nbsp;{d.section_num}
                                    &nbsp;—&nbsp;Open Seats:&nbsp;
                                    <span className="font-bold">{d.open_seats}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            )
          })
        )}

        {courses.length === page * perPage && (
          <Button onClick={() => setPage((p) => p + 1)}>Load More</Button>
        )}
      </main>
    </div>
  )
}

