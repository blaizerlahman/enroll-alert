import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

let cachedAuth: Auth | null = null

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })

  cachedAuth = getAuth(app)
  return cachedAuth
}

