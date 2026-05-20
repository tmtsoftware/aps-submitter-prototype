import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { RedirectToLogin } from './RedirectToLogin'

export type ProtectedRouteProps = {
  children: React.ReactNode
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { auth } = useAuth()
  if (!auth) return <div>Loading</div>
  const isAuthenticated = auth?.isAuthenticated() ?? false
  return isAuthenticated ? children : <RedirectToLogin />
}
