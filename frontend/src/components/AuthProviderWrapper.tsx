"use client"
import { useState, useEffect } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import AuthModal from "@/components/AuthModal"

export default function AuthProviderWrapper({ children }) {
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

