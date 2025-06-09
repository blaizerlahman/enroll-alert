// components/AuthProviderWrapper.tsx
"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"

export default function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return unsubscribe
  }, [])

  return (
    <>
      <Navbar isSignedIn={!!user} />
      {children}
    </>
  )
}

