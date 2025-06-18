"use client"
import { ReactNode, useState, useEffect } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import AuthModal from "@/components/AuthModal"

type Props = { children: ReactNode }

export default function AuthProviderWrapper({ children }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  return (
    <>
      <Navbar isSignedIn={!!user} setShowAuth={setShowAuth} />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {children}
    </>
  )
}

