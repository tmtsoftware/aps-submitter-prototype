import React, { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'

export const RedirectToLogin = (): React.JSX.Element => {
  const { login } = useAuth()

  useEffect(login, [login])

  return <div>Loading...</div>
}
