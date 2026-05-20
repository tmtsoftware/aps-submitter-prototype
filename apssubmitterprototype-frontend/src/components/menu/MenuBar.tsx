import { Menu } from 'antd'
import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export const MenuBar = (): React.JSX.Element => {
  const { auth, login, logout } = useAuth()
  const isAuthenticated = auth?.isAuthenticated() ?? false

  const items = [
    {
      key: 'home',
      label: <Link to='/'>Sequence Submitter</Link>
    },
    isAuthenticated
      ? {
          key: 'logout',
          label: 'Logout',
          onClick: logout
        }
      : {
          key: 'login',
          label: 'Login',
          onClick: login
        }
  ]

  return <Menu mode='horizontal' items={items} />
}
