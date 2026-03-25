import { NextResponse } from 'next/server'
import { getCourseSubsections } from '@/lib/db'
import { CURR_TERM } from '@/lib/terms'

export const dynamic = 'force-dynamic'

interface Row {
  lecture_num: string
  professor: string
  capacity: number
  enrolled: number
  open_seats: number
  waitlist_capacity: number
  waitlist_open_spots: number
  course_status: string
  dis_section_num: string | null
  dis_section_type: string | null
  dis_capacity: number | null
  dis_enrolled: number | null
  dis_open_seats: number | null
  dis_waitlist_capacity: number | null
  dis_waitlist_open_spots: number | null
  dis_course_status: string | null
}

type Discussion = {
  section_num: string
  section_type: string
  capacity: number
  enrolled: number
  open_seats: number
  waitlist_capacity: number
  waitlist_open_spots: number
  course_status: string
}

type Lecture = {
  lecture_num: string
  professor: string
  capacity: number
  enrolled: number
  open_seats: number
  waitlist_capacity: number
  waitlist_open_spots: number
  course_status: string
  discussions: Discussion[]
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await ctx.params

    const term = parseInt(new URL(req.url).searchParams.get('term') ?? String(CURR_TERM), 10)
    const rows = (await getCourseSubsections(courseId, term)) as Row[]

    const map = new Map<string, Lecture>()
    
    // avoiding duplicate subsections
    const seenDiscussions = new Set<string>()

    rows.forEach((r) => {
      // ensure one lecture per lecture_num 
      if (!map.has(r.lecture_num)) {
        map.set(r.lecture_num, {
          lecture_num: r.lecture_num,
          professor: r.professor,
          capacity: r.capacity,
          enrolled: r.enrolled,
          open_seats: r.open_seats,
          waitlist_capacity: r.waitlist_capacity,
          waitlist_open_spots: r.waitlist_open_spots,
          course_status: r.course_status,
          discussions: [],
        })
      }

      // push child discussion/lab/sem if present 
      if (r.dis_section_num) {
        if (!seenDiscussions.has(r.dis_section_num)) {
          seenDiscussions.add(r.dis_section_num)
          map.get(r.lecture_num)!.discussions.push({
            section_num: r.dis_section_num,
            section_type: r.dis_section_type!,
            capacity: r.dis_capacity!,
            enrolled: r.dis_enrolled!,
            open_seats: r.dis_open_seats!,
            waitlist_capacity: r.dis_waitlist_capacity!,
            waitlist_open_spots: r.dis_waitlist_open_spots!,
            course_status: r.dis_course_status ?? 'CLOSED',
          })
        }
      }
    })

    // ordered by lecture number 
    return NextResponse.json([...map.values()])
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to fetch course sections' },
      { status: 500 },
    )
  }
}

