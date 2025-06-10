'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import AuthModal from '@/components/AuthModal'

import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Command, CommandInput, CommandItem, CommandEmpty,
  CommandGroup, CommandList
} from '@/components/ui/command'
import {
  Popover, PopoverTrigger, PopoverContent
} from '@/components/ui/popover'
import {
  Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})

  const [search, setSearch]                     = useState('')
  const [breadths, setBreadths]                 = useState<string[]>([])
  const [selectedBreadths, setSelectedBreadths] = useState<string[]>([])
  const [subjects, setSubjects]                 = useState<string[]>([])
  const [subjectFilter, setSubjectFilter]       = useState<string | null>(null)

  const [prevFilters, setPrevFilters] = useState({
    search: '', subjectFilter: null as string | null, selectedBreadths: [] as string[]
  })

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
    if (search)          params.set('search', search)
    if (subjectFilter)   params.set('subject', subjectFilter)
    if (selectedBreadths.length) params.set('breadths', selectedBreadths.join(','))
    params.set('page', page.toString())
    params.set('perPage', perPage.toString())

    fetch(`/api/courses?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCourses(filtersChanged || page === 1 ? data : prev => [...prev, ...data])
          setPrevFilters({ search, subjectFilter, selectedBreadths })
        } else {
          console.error('Course fetch error:', data)
          setCourses([])
        }
      })
  }, [search, subjectFilter, selectedBreadths, page])

  useEffect(() => { fetch('/api/breadths').then(r => r.json()).then(setBreadths) }, [])
  useEffect(() => { fetch('/api/subjects').then(r => r.json()).then(setSubjects) }, [])

  useEffect(() => { setPage(1) }, [search, subjectFilter, selectedBreadths])

  function toggleBreadth(b: string) {
    setSelectedBreadths(prev =>
      prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  }

  async function toggle(courseId: string) {
    if (expanded[courseId]) {
      setExpanded(prev => ({ ...prev, [courseId]: false }))
      return
    }

    if (!sections[courseId]) {
      const res  = await fetch(`/api/sections/${courseId}`)
      const data = await res.json() as Lecture[]
      setSections(prev => ({ ...prev, [courseId]: data }))
    }
    setExpanded(prev => ({ ...prev, [courseId]: true }))
  }

  return (
    <div>
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
                    onSelect={() => { setSubjectFilter(null); setOpen(false) }}
                  >
                    All Subjects
                  </CommandItem>
                  {subjects.map((s) => (
                    <CommandItem
                      key={s}
                      value={s}
                      onSelect={() => { setSubjectFilter(s); setOpen(false) }}
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
          {breadths.map(b => (
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
          courses.map((course, idx) => (
            <Card key={`${course.course_id}-${idx}`}>
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="text-lg">
                  {course.course_name}&nbsp;–&nbsp;
                  <span className="font-normal text-muted-foreground">
                    {course.course_title}
                  </span>
                </CardTitle>

                {course.has_subsections && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(course.course_id)}
                  >
                    {expanded[course.course_id] ? 'Hide Sections' : 'Show Sections'}
                  </Button>
                )}
              </CardHeader>

              <CardContent className="space-y-1">
                <p>Enrolled: {course.total_enrolled} / {course.total_capacity}</p>
                <p>Open Seats: {course.total_open_seats}</p>
                <p>Waitlist: {course.total_waitlist_open} / {course.total_waitlist_capacity}</p>

                {expanded[course.course_id] && sections[course.course_id] && (
                  <div className="space-y-3 mt-3">
                    {sections[course.course_id].map(lec => (
                      <div key={lec.lecture_num}>
                        {/* Lecture header ------------------------- */}
                        <div className="font-semibold">
                          LEC&nbsp;{lec.lecture_num}
                          {lec.professor && ` — ${lec.professor}`}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Enrolled {lec.enrolled}/{lec.capacity}&nbsp;·&nbsp;
                          Open {lec.open_seats}&nbsp;·&nbsp;
                          Waitlist {lec.waitlist_open_spots}/{lec.waitlist_capacity}
                        </p>

                        {/* Discussions --------------------------- */}
                        {lec.discussions.length > 0 ? (
                          <ul className="ml-4 list-disc">
                            {lec.discussions.map(d => (
                              <li key={d.section_num}>
                                {d.section_type}&nbsp;{d.section_num}&nbsp;—&nbsp;
                                open&nbsp;{d.open_seats}/{d.capacity}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ml-4 italic text-sm text-muted-foreground">
                            No discussion / lab / seminar sections
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {courses.length === page * perPage && (
          <Button onClick={() => setPage(p => p + 1)}>Load More</Button>
        )}
      </main>
    </div>
  )
}

