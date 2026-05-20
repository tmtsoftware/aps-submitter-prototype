import {
  AuthContextProvider,
  LocationService,
  loadGlobalConfig
} from '@tmtsoftware/esw-ts'
import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import { MenuBar } from './components/menu/MenuBar'
import { AppConfig } from './config/AppConfig'
import { LocationServiceProvider } from './contexts/LocationServiceContext'
import { useQuery } from './hooks/useQuery'
import { Routes } from './routes/Routes'
import '@ant-design/v5-patch-for-react-19'

const basename =
  import.meta.env.NODE_ENV === 'production'
    ? `/${AppConfig.applicationName}`
    : ''

export const App = (): React.JSX.Element => {
  const { data: initialised, error } = useQuery(() =>
    loadGlobalConfig().then(() => true)
  )
  const locationService = LocationService()

  if (error) return <div> Failed to load global config </div>
  return initialised ? (
    <LocationServiceProvider locationService={locationService}>
      <Router basename={basename}>
        <AuthContextProvider>
          <MenuBar />
          <Routes />
        </AuthContextProvider>
      </Router>
    </LocationServiceProvider>
  ) : (
    <div>Loading....</div>
  )
}
