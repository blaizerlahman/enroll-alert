// components/Navbar.tsx
"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Navbar({
  search,
  setSearch,
  isSignedIn = false,
}: {
  search: string
  setSearch: (val: string) => void
  isSignedIn?: boolean
}) {

  return (

    <header className="fixed top-0 w-full px-6 py-4 flex items-center justify-between bg-white border-b shadow-md z-50">

      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-gray-300 rounded-full" />
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
          <div className="w-10 h-10 bg-gray-300 rounded-full" /> // profile pic placeholder
        ) : (
          <Button variant="outline">Sign In</Button>
        )}
      </div>
    </header>
  )
}

