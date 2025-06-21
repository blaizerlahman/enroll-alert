// components/AuthModal.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { auth } from "@/lib/firebase"
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

type Mode = "signin" | "signup" | "reset"

export default function AuthModal({ onClose }: { onClose: () => void }) {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<Mode>("signin")
  const [error, setError] = useState("")
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (backdropRef.current === e.target) onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const handleSubmit = async () => {
    setError("")
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password)
        onClose()
      } else if (mode === "signup") {

        const credentials = await createUserWithEmailAndPassword(auth, email, password)
        const token = await.cred.user.getIdToken()
      
        // call endpoint to send welcome email
        fetch("/api/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        })
        onClose()

      } else {
        await sendPasswordResetEmail(auth, email)
        toast.success("Password reset email sent!")
        setMode("signin")
      }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err)
      if (mode === "reset") {
        setError("Failed to send reset email.")
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Incorrect e-mail or password.")
      } else {
        setError("Authentication error. Please try again.")
      }
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={backdropRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-lg w-full max-w-sm shadow-lg p-6 relative z-10"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-xl font-semibold mb-4 text-center">
            {mode === "signin"
              ? "Sign In"
              : mode === "signup"
              ? "Create Account"
              : "Reset Password"}
          </h2>

          <div className="space-y-3">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
            {mode !== "reset" && (
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
              />
            )}

            <Button onClick={handleSubmit} className="w-full">
              {mode === "signin"
                ? "Sign In"
                : mode === "signup"
                ? "Sign Up"
                : "Send reset link"}
            </Button>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="text-center text-sm text-muted-foreground">
              {mode === "signin" && (
                <>
                  Don’t have an account?{" "}
                  <button className="underline" onClick={() => setMode("signup")}>
                    Sign up
                  </button>
                  {" • "}
                  <button className="underline" onClick={() => setMode("reset")}>
                    Forgot password?
                  </button>
                </>
              )}
              {mode === "signup" && (
                <>
                  Already have an account?{" "}
                  <button className="underline" onClick={() => setMode("signin")}>
                    Sign in
                  </button>
                </>
              )}
              {mode === "reset" && (
                <>
                  Remembered your password?{" "}
                  <button className="underline" onClick={() => setMode("signin")}>
                    Back to sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

