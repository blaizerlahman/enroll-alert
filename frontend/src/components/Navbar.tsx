import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Image from "next/image"

export default function Navbar({
  search,
  setSearch,
  isSignedIn,
  setShowAuth,
}: {
  search: string
  setSearch: (val: string) => void
  isSignedIn?: boolean
}) {
  return (
    <header className="fixed top-0 w-full px-6 py-4 flex items-center justify-between bg-white border-b shadow-md z-50">
      <div className="flex items-center space-x-4">
        <Image
          src="/enrollalert_logo.png"
          alt="EnrollAlert logo"
          width={60}
          height={60}
        />
        <span className="text-xl font-semibold">EnrollAlert</span>
      </div>

      <div className="flex-1 mx-6 max-w-xl">
        <Input
          type="text"
          placeholder="Search by course name, subject, or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="ml-4">
        {isSignedIn ? (
          <Image
            src="/default_profile.png"
            alt="Profile Picture"
            width={40}
            height={40}
            className ="rounded-full"
          />
        ) : (
          <Button variant="outline" onClick={() => setShowAuth(true)}>Sign In</Button>
        )}
      </div>
    </header>
  )
}

