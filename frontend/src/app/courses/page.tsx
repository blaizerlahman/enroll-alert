'use client'

import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import {
  Command,
  CommandInput,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  CommandList
} from "@/components/ui/command"

import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover"

import { Button } from "@/components/ui/button"

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

import Navbar from "@/components/Navbar"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sections, setSections] = useState<Record<string, any[]>>({})
  const [breadths, setBreadths] = useState<string[]>([])
  const [selectedBreadths, setSelectedBreadths] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const [prevFilters, setPrevFilters] = useState({
    search: '',
    subjectFilter: null as string | null,
    selectedBreadths: [] as string[],
  })
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const perPage = 20

  useEffect(() => {
    const filtersChanged =
      search !== prevFilters.search ||
      subjectFilter !== prevFilters.subjectFilter ||
      selectedBreadths.join(',') !== prevFilters.selectedBreadths.join(',')

    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (subjectFilter) params.set('subject', subjectFilter)
    if (selectedBreadths.length > 0) params.set('breadths', selectedBreadths.join(','))
    params.set('page', page.toString())
    params.set('perPage', perPage.toString())

    fetch(`/api/courses?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          if (filtersChanged || page === 1) {
            setCourses(data)
          } else {
            setCourses(prev => [...prev, ...data])
          }

          setPrevFilters({ search, subjectFilter, selectedBreadths })
        } else {
          console.error('Course fetch error:', data)
          setCourses([])
        }
      })
  }, [search, subjectFilter, selectedBreadths, page])


  useEffect(() => {
    fetch('/api/breadths')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) { 
          console.log("Loaded breadths:", data)
          setBreadths(data)
        }
        else console.error('Breadths API error:', data)
      })
  }, [])

  useEffect(() => {
    fetch('/api/subjects')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSubjects(data)
        else console.error('Subjects API error:', data)
      })
  }, [])


  // reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, subjectFilter, selectedBreadths])


  function toggleBreadth(breadth: string) {
  setSelectedBreadths(prev =>
    prev.includes(breadth)
      ? prev.filter(b => b !== breadth)
      : [...prev, breadth]
    )
  }

  const toggle = async (courseId: string) => {
    if (expanded[courseId]) {
      setExpanded(prev => ({ ...prev, [courseId]: false }))
    } else {
      if (!sections[courseId]) {
        const res = await fetch(`/api/discussions/${courseId}`)
        const data = await res.json()
        setSections(prev => ({ ...prev, [courseId]: data }))
      }
      setExpanded(prev => ({ ...prev, [courseId]: true }))
    }
  }


  return (

    <div>
      <Navbar search={search} setSearch={setSearch} isSignedIn={false /* or true if authenticated */} />

      <main className="pt-24 px-6 space-y-4">
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start">
              {subjectFilter ?? "Select Subject"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search subject..." />
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
                  {subjects.map((subject) => (
                    <CommandItem
                      key={subject}
                      value={subject}
                      onSelect={(currentValue) => {
                        setSubjectFilter(currentValue)
                        setOpen(false)
                      }}
                    >
                      {subject}
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
          courses.map((course, index) => (
            <Card key={`${course.course_id}-${index}`}>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">
                  {course.course_name} – <span className="font-normal text-muted-foreground">{course.course_title}</span>
                </CardTitle>
                {course.has_subsections && (
                  <Button variant="outline" size="sm" onClick={() => toggle(course.course_id)}>
                    {expanded[course.course_id] ? 'Hide Sections' : 'Show Sections'}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-1">
                <p>Enrolled: {course.total_enrolled} / {course.total_capacity}</p>
                <p>Open Seats: {course.total_open_seats}</p>
                <p>Waitlist: {course.total_waitlist_open} / {course.total_waitlist_capacity}</p>
                {expanded[course.course_id] && (
                  <ul className="ml-4 mt-2 list-disc">
                    {Array.isArray(sections[course.course_id]) && sections[course.course_id].length > 0 ? (
                      sections[course.course_id].map((sec, idx) => (
                        <li key={idx}>
                          {sec.section_type} {sec.section_num} — Open Seats: {sec.open_seats}
                        </li>
                      ))
                    ) : (
                      <li>No subsections available</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {courses.length === page * perPage && (
          <Button onClick={() => setPage(p => p + 1)}>
            Load More
          </Button>
        )}
      </main>
    </div>
  )
}

