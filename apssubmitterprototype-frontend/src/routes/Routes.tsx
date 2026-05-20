import React from 'react'
import { Route, Routes as RouterRoutes } from 'react-router-dom'
import { NotFound } from '../components/error/NotFound'
import { SequenceSubmitter } from '../components/pages/SequenceSubmitter'

export const Routes = (): React.JSX.Element => {
  return (
    <RouterRoutes>
      <Route path='/' element={<SequenceSubmitter />} />
      <Route path='*' element={<NotFound />} />
    </RouterRoutes>
  )
}
