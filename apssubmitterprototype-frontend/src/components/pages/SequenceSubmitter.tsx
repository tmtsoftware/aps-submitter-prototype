import {
  ComponentId,
  Prefix,
  Sequence,
  SequencerService
} from '@tmtsoftware/esw-ts'
import { Button, Card, Input, Space, Typography, Alert, Badge, Tag, Tabs } from 'antd'
import React, { useState } from 'react'
import { loadSequence } from '../../utils/api'
import { getBackendUrl } from '../../utils/resolveBackend'
import { useLocationService } from '../../contexts/LocationServiceContext'
import { useAuth } from '../../hooks/useAuth'
import { useProcedureEvents } from '../../hooks/useProcedureEvents'
import type { ProcedureEventType } from '../../models/ProcedureEvent'

const { Title, Text } = Typography
const { TextArea } = Input

const tagColor = (type: ProcedureEventType): string => {
  switch (type) {
    case 'INFO_MESSAGE':  return 'blue'
    case 'WARN_MESSAGE':  return 'orange'
    case 'USER_PROMPT':   return 'purple'
    case 'VIZ_DISPLAY':  return 'cyan'
  }
}

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
  const [activeTab, setActiveTab] = useState<string>('setup')

  const { events, error: eventError, clear: clearEvents } = useProcedureEvents(true)

  const handleLoadTemplate = async () => {
    if (!configPath.trim()) return
    setLoadStatus('loading')
    setLoadError(undefined)
    setSequenceJson(undefined)
    setSubmitStatus('idle')
    setSubmitResult(undefined)
    clearEvents()
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
    clearEvents()
    setSubmitStatus('loading')
    setSubmitError(undefined)
    setSubmitResult(undefined)

    try {
      const componentId = new ComponentId(
        new Prefix('APS', 'apsPeasSequencerA_SoftwareOnlyMode'),
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

  const setupTab = (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Card title='Load Sequence Template'>
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
          extra={
            <Button
              type='primary'
              onClick={() => setActiveTab('run')}
            >
              Go to Run Procedure →
            </Button>
          }
        >
          <TextArea
            readOnly
            rows={16}
            value={JSON.stringify(sequenceJson, null, 2)}
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
        </Card>
      )}
    </Space>
  )

  const runTab = (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Card
        title='Submit Sequence'
        extra={
          <Button
            type='primary'
            onClick={handleSubmitSequence}
            loading={submitStatus === 'loading'}
            disabled={!sequenceJson}
          >
            Submit Sequence
          </Button>
        }
      >
        {submitStatus === 'idle' && (
          <Text type='secondary'>Load a sequence in Setup Procedure, then click Submit Sequence.</Text>
        )}
        {submitStatus === 'loading' && (
          <Text type='secondary'>Sequence running...</Text>
        )}
        {submitStatus === 'error' && submitError && (
          <Alert type='error' message={submitError} showIcon />
        )}
        {submitStatus === 'success' && submitResult && (
          <Alert
            type='success'
            message='Sequence submitted successfully'
            description={<pre style={{ margin: 0, fontSize: '12px' }}>{submitResult}</pre>}
            showIcon
          />
        )}
      </Card>

      <Card
        title={
          <Space>
            Procedure Events
            {submitStatus === 'loading' && (
              <Badge status='processing' text='live' />
            )}
            {events.length > 0 && (
              <Text type='secondary' style={{ fontSize: '12px' }}>
                ({events.length} received)
              </Text>
            )}
          </Space>
        }
      >
        {eventError && (
          <Alert type='error' message={eventError} showIcon style={{ marginBottom: '0.75rem' }} />
        )}
        {events.length === 0 ? (
          <Text type='secondary'>Waiting for procedure events...</Text>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {events.map((event, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              >
                <Text type='secondary' style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                  {event.eventTime}
                </Text>
                <Tag color={tagColor(event.type)} style={{ margin: 0 }}>
                  {event.type}
                </Tag>
                <Text type='secondary' style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                  [{event.source}]
                </Text>
                <Text>{event.messageId}</Text>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Space>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <Title level={2}>APS Sequence Submitter</Title>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'setup',
            label: 'Setup Procedure',
            children: setupTab
          },
          {
            key: 'run',
            label: 'Run Procedure',
            disabled: !sequenceJson,
            children: runTab
          }
        ]}
      />
    </div>
  )
}
