import {
  ComponentId,
  Prefix,
  Sequence,
  SequencerService
} from '@tmtsoftware/esw-ts'
import { Button, Card, Input, Space, Typography, Alert } from 'antd'
import React, { useState } from 'react'
import { loadSequence } from '../../utils/api'
import { getBackendUrl } from '../../utils/resolveBackend'
import { useLocationService } from '../../contexts/LocationServiceContext'
import { useAuth } from '../../hooks/useAuth'

const { Title, Text } = Typography
const { TextArea } = Input

export const SequenceSubmitter = (): React.JSX.Element => {
  const locationService = useLocationService()
  const { auth } = useAuth()

  const [configPath, setConfigPath] = useState<string>('')
  const [sequenceJson, setSequenceJson] = useState<unknown | undefined>(undefined)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)
  const [submitResult, setSubmitResult] = useState<string | undefined>(undefined)

  const handleLoadTemplate = async () => {
    if (!configPath.trim()) return
    setLoadStatus('loading')
    setLoadError(undefined)
    setSequenceJson(undefined)
    setSubmitStatus('idle')
    setSubmitResult(undefined)
    try {
      const baseUrl = await getBackendUrl(locationService)
      if (!baseUrl) throw new Error('Backend not available')
      const json = await loadSequence(baseUrl, configPath.trim())
      setSequenceJson(json)
      setLoadStatus('success')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
      setLoadStatus('error')
    }
  }

  const handleSubmitSequence = async () => {
    if (!sequenceJson) return
    setSubmitStatus('loading')
    setSubmitError(undefined)
    setSubmitResult(undefined)
    
    
    
    try {
      const componentId = new ComponentId(
        new Prefix('APS', 'APS_software_only_mode'),
        'Sequencer'
      )
      const sequencerService = await SequencerService(componentId, {
        tokenFactory: () => auth?.token()
      })
      const sequence = Sequence.from(sequenceJson)
      const result = await sequencerService.submitAndWait(sequence, 60)
      setSubmitResult(JSON.stringify(result, null, 2))
      setSubmitStatus('success')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
      setSubmitStatus('error')
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>APS Sequence Submitter</Title>

      <Card title='Load Sequence Template' style={{ marginBottom: '1.5rem' }}>
        <Space direction='vertical' style={{ width: '100%' }}>
          <Text>Config Service Path</Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder='/aps/sequences/testmode.json'
              value={configPath}
              onChange={(e) => setConfigPath(e.target.value)}
              onPressEnter={handleLoadTemplate}
              disabled={loadStatus === 'loading'}
            />
            <Button
              type='primary'
              onClick={handleLoadTemplate}
              loading={loadStatus === 'loading'}
              disabled={!configPath.trim()}
            >
              Load Template
            </Button>
          </Space.Compact>
          {loadStatus === 'error' && loadError && (
            <Alert type='error' message={loadError} showIcon />
          )}
        </Space>
      </Card>

      {sequenceJson && (
        <Card
          title='Loaded Sequence'
          style={{ marginBottom: '1.5rem' }}
          extra={
            <Button
              type='primary'
              onClick={handleSubmitSequence}
              loading={submitStatus === 'loading'}
            >
              Submit Sequence
            </Button>
          }
        >
          <TextArea
            readOnly
            rows={12}
            value={JSON.stringify(sequenceJson, null, 2)}
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
          {submitStatus === 'error' && submitError && (
            <Alert type='error' message={submitError} showIcon style={{ marginTop: '1rem' }} />
          )}
          {submitStatus === 'success' && submitResult && (
            <Alert
              type='success'
              message='Sequence submitted successfully'
              description={<pre style={{ margin: 0, fontSize: '12px' }}>{submitResult}</pre>}
              showIcon
              style={{ marginTop: '1rem' }}
            />
          )}
        </Card>
      )}
    </div>
  )
}
