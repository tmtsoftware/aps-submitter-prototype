import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HttpLocation } from '@tmtsoftware/esw-ts'
import { HttpConnection, Prefix } from '@tmtsoftware/esw-ts'
import { expect } from 'chai'
import React from 'react'
import {
  anything,
  capture,
  deepEqual,
  verify,
  when
} from '@johanblumenberg/ts-mockito'
import { SequenceSubmitter } from '../../src/components/pages/SequenceSubmitter'
import {
  locationServiceMock,
  mockFetch,
  renderWithRouter
} from '../utils/test-utils'
import '@ant-design/v5-patch-for-react-19'

describe('SequenceSubmitter', () => {
  const connection = HttpConnection(
    Prefix.fromString('APS.apssubmitterprototype'),
    'Service'
  )

  const httpLocation: HttpLocation = {
    _type: 'HttpLocation',
    uri: 'some-backend-url/',
    connection,
    metadata: {}
  }

  when(locationServiceMock.find(deepEqual(connection))).thenResolve(
    httpLocation
  )

  it('should load a sequence from the backend when Load Template is clicked', async () => {
    const configPath = '/aps/sequences/testmode.json'
    const sequenceJson = { commands: [] }
    const response = new Response(JSON.stringify(sequenceJson))
    const fetch = mockFetch()
    when(fetch(anything(), anything())).thenResolve(response)

    renderWithRouter(<SequenceSubmitter />)

    const input = (await screen.findByPlaceholderText(
      '/aps/sequences/testmode.json'
    )) as HTMLInputElement

    const user = userEvent.setup()
    await user.type(input, configPath)

    const loadButton = await screen.findByRole('button', {
      name: /load template/i
    })
    await waitFor(() => user.click(loadButton))

    verify(locationServiceMock.find(deepEqual(connection))).called()
    const [firstArg, secondArg] = capture(fetch).last()
    expect(firstArg).to.equal(httpLocation.uri + 'sequence/load')

    const expectedReq = {
      method: 'POST',
      body: JSON.stringify({ configPath }),
      headers: { 'Content-Type': 'application/json' }
    }
    expect(JSON.stringify(secondArg)).to.equal(JSON.stringify(expectedReq))
  })
})
