'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Menu } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

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
  const pathname = usePathname()
  const [showSearchBar, setShowSearchBar] = useState(false)

  useEffect(() => {
    if (setSearch) {
      const t = setTimeout(() => setShowSearchBar(true), 200)
      return () => clearTimeout(t)
    }
  }, [setSearch])

  useEffect(() => setLiveSearch(search), [search])

  useEffect(() => {
    if (!setSearch) return
    const t = setTimeout(() => setSearch(liveSearch), 200)
    return () => clearTimeout(t)
  }, [liveSearch, setSearch])

  return (
    <header className="fixed top-0 z-50 w-full bg-white px-6 py-4 flex items-center justify-between border-b shadow-md">
      <Link href="/courses" className="flex items-center space-x-0 sm:space-x-4">
        <Image src="/enrollalert_logo.png" alt="EnrollAlert logo" width={60} height={60} />
        <span className="hidden sm:inline text-xl font-semibold">EnrollAlert</span>
      </Link>

      {setSearch && showSearchBar && (
        <div className="mx-6 flex-1 max-w-xl">
          <Input
            type="text"
            placeholder="Search…"
            value={liveSearch}
            onChange={(e) => setLiveSearch(e.target.value)}
          />
        </div>
      )}

      <nav className="hidden sm:flex ml-4 items-center gap-4">
        {pathname !== '/courses' && (
          <Link href="/courses" className="hover:underline">
            Course Search
          </Link>
        )}
        <Link href="/about" className="hover:underline">
          About
        </Link>
        {isSignedIn && (
          <Link href="/my-courses" className="hover:underline">
            My Courses
          </Link>
        )}
        {isSignedIn ? (
          <Button
            variant="outline"
            size="sm"
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            onClick={() => signOut(auth)}
          >
            Sign Out
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setShowAuth?.(true)}>
            Sign In
          </Button>
        )}
      </nav>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="sm:hidden">
            <Menu className="size-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="sm:hidden w-44 p-0">
          <nav className="flex flex-col py-1">
            <Link href="/about" className="px-4 py-2 hover:bg-gray-100">
              About
            </Link>
            {isSignedIn && (
              <>
                <Link href="/my-courses" className="px-4 py-2 hover:bg-gray-100">
                  My Courses
                </Link>
                <button
                  onClick={() => signOut(auth)}
                  className="text-left px-4 py-2 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </>
            )}
            {!isSignedIn && (
              <button
                onClick={() => setShowAuth?.(true)}
                className="text-left px-4 py-2 hover:bg-gray-100"
              >
                Sign In
              </button>
            )}
          </nav>
        </PopoverContent>
      </Popover>
    </header>
  )
}

