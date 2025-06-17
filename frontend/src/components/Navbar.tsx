"use client"

import { useState, useEffect } from 'react'
import Image from "next/image" 
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

type Props = {
  search?: string
  setSearch?: (val: string) => void
  isSignedIn?: boolean
  setShowAuth?: (b: boolean) => void
}

export default function Navbar({
  search = '',
  setSearch,
  isSignedIn,
  setShowAuth,
}: Props) {

  const [liveSearch, setLiveSearch] = useState(search)

  useEffect(() => {
    setLiveSearch(search)
  }, [search])

  // set delay during search to slow API calls
  useEffect(() => {
    if (!setSearch) return
    const timer = setTimeout(() => {
      setSearch(liveSearch)
    }, 200)
    return () => clearTimeout(timer)
  }, [liveSearch, setSearch])

  return (
    <header className="fixed top-0 w-full px-6 py-4 flex items-center justify-between bg-white border-b shadow-md z-50">
      <Link href="/courses" className="flex items-center space-x-4">
        <Image
          src="/enrollalert_logo.png"
          alt="EnrollAlert logo"
          width={60}
          height={60}
        />
        <span className="text-xl font-semibold">EnrollAlert</span>
      </Link>

      {setSearch && (
        <div className="flex-1 mx-6 max-w-xl">
          <Input
            type="text"
            placeholder="Search…"
            value={liveSearch}
            onChange={(e) => setLiveSearch(e.target.value)}
          />
        </div>
      )}

      <nav className="ml-4 flex items-center gap-4">
        <Link href="/about" className="hover:underline">
          About
        </Link>

        {isSignedIn && <Link href="/my-courses" className="hover:underline">
          My Courses
        </Link>}

        {isSignedIn ? (
          <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
            Sign Out
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setShowAuth?.(true)}>
            Sign In
          </Button>
        )}
      </nav>
    </header>
  )
}

