import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { AuthContext } from '@tmtsoftware/esw-ts'
import type { Auth, TestUtils, LocationService } from '@tmtsoftware/esw-ts'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { instance, imock, mock } from '@johanblumenberg/ts-mockito'
import { LocationServiceProvider } from '../../src/contexts/LocationServiceContext'
import '@ant-design/v5-patch-for-react-19'

class MockedFetch {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore

  fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {}
}

export const mockFetch = (): typeof window.fetch => {
  const mockedFetch = mock(MockedFetch)
  window.fetch = instance(mockedFetch).fetch
  return mockedFetch.fetch
}

export const locationServiceMock = imock<LocationService>()
export const locationServiceInstance = instance(locationServiceMock)

const getMockAuth = (loggedIn: boolean): Auth => {
  let loggedInValue = loggedIn
  return {
    hasRealmRole: () => true,
    hasResourceRole: () => false,
    isAuthenticated: () => loggedInValue,
    logout: () => {
      loggedInValue = false
      return Promise.resolve() as Promise<void>
    },
    token: () => 'token string',
    tokenParsed: () =>
      ({
        preferred_username: loggedIn ? 'esw-user' : undefined
      }) as TestUtils.KeycloakTokenParsed,
    realmAccess: () => [''] as unknown as TestUtils.KeycloakRoles,
    resourceAccess: () => [''] as unknown as TestUtils.KeycloakResourceAccess,
    loadUserProfile: () =>
      Promise.resolve({}) as Promise<TestUtils.KeycloakProfile>
  }
}

const renderWithAuth = (ui: React.ReactElement): RenderResult => {
  const authContext = (
    <AuthContext.Provider
      value={{
        auth: getMockAuth(true),
        login: () => ({}),
        logout: () => ({})
      }}>
      {ui}
    </AuthContext.Provider>
  )
  return render(authContext)
}

const renderWithLocationServiceContext = (ui: React.ReactElement) => {
  return renderWithAuth(
    <LocationServiceProvider locationService={locationServiceInstance}>
      {ui}
    </LocationServiceProvider>
  )
}

export const renderWithRouter = (ui: React.ReactElement): RenderResult => {
  return renderWithLocationServiceContext(<BrowserRouter>{ui}</BrowserRouter>)
}
