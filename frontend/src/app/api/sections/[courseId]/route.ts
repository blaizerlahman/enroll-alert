// app/api/sections/[courseId]/route.ts

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCourseSubsections } from '@/lib/db'  

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await ctx.params

    const rows = await getCourseSubsections(courseId)

    type Discussion = {
      section_num: string
      section_type: string
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

    const map = new Map<string, Lecture>()

    rows.forEach(r => {

      // ensure one lecture per lecture_num
      if (!map.has(r.lecture_num)) {
        map.set(r.lecture_num, {
          lecture_num: r.lecture_num,
          professor:   r.professor,
          capacity:    r.capacity,
          enrolled:    r.enrolled,
          open_seats:  r.open_seats,
          waitlist_capacity:     r.waitlist_capacity,
          waitlist_open_spots:   r.waitlist_open_spots,
          discussions: []
        })
      }

      // push child discussion/lab/sem if present
      if (r.dis_section_num) {
        map.get(r.lecture_num)!.discussions.push({
          section_num:          r.dis_section_num,
          section_type:         r.dis_section_type,
          capacity:             r.dis_capacity,
          enrolled:             r.dis_enrolled,
          open_seats:           r.dis_open_seats,
          waitlist_capacity:    r.dis_waitlist_capacity,
          waitlist_open_spots:  r.dis_waitlist_open_spots
        })
      }
    })

    // ordered by lecture number
    return NextResponse.json([...map.values()]) 
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to fetch course sections' },
      { status: 500 }
    )
  }
}

