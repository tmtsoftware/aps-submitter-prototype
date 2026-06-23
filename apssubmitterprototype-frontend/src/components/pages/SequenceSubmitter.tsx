import {
  ComponentId,
  Prefix,
  Sequence,
  SequencerService
} from '@tmtsoftware/esw-ts'
import { Button, Input, Tabs, Typography, Alert, Badge, Tag } from 'antd'
import React, { useState, useRef, useEffect } from 'react'
import { loadSequence } from '../../utils/api'
import { getBackendUrl } from '../../utils/resolveBackend'
import { useLocationService } from '../../contexts/LocationServiceContext'
import { useAuth } from '../../hooks/useAuth'
import { useProcedureEvents } from '../../hooks/useProcedureEvents'
import { usePublishUserPromptResponse } from '../../hooks/usePublishUserPromptResponse'
import { useMessages } from '../../hooks/useMessages'
import type { ProcedureEventType } from '../../models/ProcedureEvent'
import type {
  DecisionResponse,
  ErrorResponse,
  OriginatingPromptType
} from '../../models/UserPromptResponseEvent'
import exposurePlaceholderImg from '../../assets/images/psh_exposure_placeholder.png'

const { Text } = Typography
const { TextArea } = Input

// ─── Constants ────────────────────────────────────────────────────────────────

const OBSERVING_MODE = 'APS Standalone'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tagColor = (type: ProcedureEventType): string => {
  switch (type) {
    case 'INFO_MESSAGE': return 'blue'
    case 'WARN_MESSAGE': return 'orange'
    case 'USER_PROMPT':  return 'purple'
    case 'VIZ_DISPLAY':  return 'cyan'
  }
}

const eventTypeLabel = (type: ProcedureEventType): string => {
  switch (type) {
    case 'INFO_MESSAGE': return 'INFO'
    case 'WARN_MESSAGE': return 'WARN'
    case 'USER_PROMPT':  return 'PROMPT'
    case 'VIZ_DISPLAY':  return 'VIZ'
  }
}

// Extracts sequencer letter from source prefix e.g.
// "APS.apsPeasSequencerA_SoftwareOnlyMode" → "A"
const sequencerLabel = (source: string): string => {
  const match = source.match(/apsPeasSequencer([A-Z])/i)
  return match ? match[1].toUpperCase() : '?'
}

const SEQ_COLORS: Record<string, { color: string; background: string; border: string }> = {
  A: { color: '#1677ff', background: '#e6f4ff', border: '#91caff' },
  B: { color: '#52c41a', background: '#f6ffed', border: '#b7eb8f' },
  C: { color: '#722ed1', background: '#f9f0ff', border: '#d3adf7' },
  D: { color: '#fa8c16', background: '#fff7e6', border: '#ffd591' },
  '?': { color: '#888',   background: '#f5f5f5', border: '#d9d9d9' },
}

const seqTagStyle = (label: string): React.CSSProperties => {
  const c = SEQ_COLORS[label] ?? SEQ_COLORS['?']
  return {
    display: 'inline-block',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '1px 6px',
    border: `1px solid ${c.border}`,
    borderRadius: 2,
    background: c.background,
    color: c.color,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    flexShrink: 0,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusPillProps {
  label: string
  value: string
  color?: string
}

const StatusPill = ({ label, value, color }: StatusPillProps) => (
  <div style={styles.statusPill}>
    <span style={styles.statusPillLabel}>{label}</span>
    <span style={{ ...styles.statusPillValue, color: color ?? '#5de0e0' }}>{value}</span>
  </div>
)

interface BenchFieldProps {
  label: string
  value: string
}

const BenchField = ({ label, value }: BenchFieldProps) => (
  <div style={styles.benchField}>
    <span style={styles.benchFieldLabel}>{label}</span>
    <span style={styles.benchFieldValue}>{value}</span>
  </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────

export const SequenceSubmitter = (): React.JSX.Element => {
  const locationService = useLocationService()
  const { auth, login, logout } = useAuth()
  const isAuthenticated = auth?.isAuthenticated() ?? false

  const [configPath, setConfigPath] = useState<string>('')
  const [sequenceJson, setSequenceJson] = useState<unknown | undefined>(undefined)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<string>('setup')
  const [benchTab, setBenchTab] = useState<'LOWFS' | 'PSH' | 'PIT' | 'APT'>('PSH')
  const [progress, setProgress] = useState<number>(0)
  const [procedureNumber] = useState<number>(1)
  const [exposureIteration] = useState<number>(0)

  const { events, error: eventError, clear: clearEvents } = useProcedureEvents(true)
  const { publishResponse } = usePublishUserPromptResponse()
  const { getMessage } = useMessages()
  const eventLogRef = useRef<HTMLDivElement>(null)

  // Tracks user responses to USER_PROMPT dialogs, keyed by the originating
  // event's messageUuid (unique per prompt invocation - messageId itself is
  // a stable, reused, human-readable string and is NOT a safe key here).
  // Records the button label shown to the operator and tracks publish
  // failures separately so the UI can offer a retry without losing the fact
  // that the operator already clicked.
  const [promptResponses, setPromptResponses] = useState<Record<string, string>>({})
  const [promptPublishErrors, setPromptPublishErrors] = useState<Record<string, string>>({})

  const handlePromptResponse = async (
    sourcePrefix: string,
    originatingPromptType: OriginatingPromptType,
    originatingMessageId: string,
    originatingMessageUuid: string,
    label: string,
    decisionResponse: DecisionResponse,
    errorResponse: ErrorResponse
  ) => {
    setPromptResponses(prev => ({ ...prev, [originatingMessageUuid]: label }))
    setPromptPublishErrors(prev => {
      const { [originatingMessageUuid]: _removed, ...rest } = prev
      return rest
    })
    try {
      await publishResponse(sourcePrefix, {
        originatingPromptType,
        originatingMessageId,
        originatingMessageUuid,
        decisionResponse,
        errorResponse
      })
    } catch (e) {
      // Publish failed - clear the recorded response so the buttons
      // reappear, and surface the error so the operator can retry.
      setPromptResponses(prev => {
        const { [originatingMessageUuid]: _removed, ...rest } = prev
        return rest
      })
      setPromptPublishErrors(prev => ({
        ...prev,
        [originatingMessageUuid]: e instanceof Error ? e.message : String(e)
      }))
    }
  }

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight
    }
  }, [events])

  // Derive procedure state for status bar
  const procedureState: string = (() => {
    switch (submitStatus) {
      case 'loading': return 'Running'
      case 'success': return 'Completed'
      case 'error':   return 'Error'
      default:        return 'Ready'
    }
  })()

  const procedureStateColor: string = (() => {
    switch (submitStatus) {
      case 'loading': return '#5de0e0'
      case 'success': return '#52c41a'
      case 'error':   return '#ff4d4f'
      default:        return '#aaa'
    }
  })()

  // ── Handlers — verbatim from working GitHub version ────────────────────────

  const handleLoadTemplate = async () => {
    if (!configPath.trim()) return
    setLoadStatus('loading')
    setLoadError(undefined)
    setSequenceJson(undefined)
    setSubmitStatus('idle')
    setSubmitError(undefined)
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
    setProgress(0)

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
      if (result._type === 'Completed') {
        setSubmitStatus('success')
        setProgress(100)
      } else {
        setSubmitStatus('error')
        setSubmitError(`Sequencer response: ${result._type}`)
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
      setSubmitStatus('error')
    }
  }

  const handleAbort = () => {
    setSubmitStatus('idle')
    setProgress(0)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>

      {/* ── Top status bar (dark) ── */}
      <div style={styles.topBar}>
        <div style={styles.topBarBrand}>
          <span style={styles.brandName}>APS PEAS</span>
        </div>
        <div style={styles.statusPills}>
          <StatusPill label="Observing Mode" value={OBSERVING_MODE} />
          <StatusPill label="Procedure State" value={procedureState} color={procedureStateColor} />
          <StatusPill label="PIT Loop" value="Running" />
          <StatusPill label="APS-ICS" value="Ready" color="#52c41a" />
          <StatusPill label="M1CS" value="Simulator" color="#aaa" />
          <StatusPill label="TCS" value="Simulator" color="#aaa" />
          <StatusPill label="TCS State" value="Guiding" color="#52c41a" />
        </div>
        <div style={styles.topBarAuth}>
          {isAuthenticated ? (
            <>
              <span style={styles.authUser}>{auth?.tokenParsed()?.preferred_username}</span>
              <button style={styles.authBtn} onClick={logout}>Logout</button>
            </>
          ) : (
            <button style={styles.authBtn} onClick={login}>Login</button>
          )}
        </div>
      </div>

      {/* ── Main layout (light) ── */}
      <div style={styles.mainLayout}>

        {/* ── Left sidebar ── */}
        <div style={styles.sidebar}>

          {/* Status and Control */}
          <div style={styles.sidePanel}>
            <div style={styles.sidePanelTitle}>Status and Control</div>
            <div style={styles.sidePanelBody}>
              <BenchField label="Procedure #" value={String(procedureNumber)} />
              <BenchField label="Exposure Iteration" value={String(exposureIteration)} />

              <div style={styles.progressContainer}>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>
                <span style={styles.progressLabel}>{progress}%</span>
              </div>

              <div style={styles.controlButtons}>
                <Button
                  type="primary"
                  onClick={handleSubmitSequence}
                  loading={submitStatus === 'loading'}
                  disabled={!sequenceJson}
                  size="small"
                >
                  Start
                </Button>
                <Button
                  danger
                  onClick={handleAbort}
                  disabled={submitStatus !== 'loading'}
                  size="small"
                >
                  Abort
                </Button>
              </div>

              <div style={styles.sequencerViewLink} onClick={() => setActiveTab('setup')}>
                ← Sequencer Setup
              </div>

              {submitError && (
                <Alert type="error" message={submitError} showIcon style={{ marginTop: 6, fontSize: 11 }} />
              )}
              {submitStatus === 'success' && (
                <Alert type="success" message="Sequence completed" showIcon style={{ marginTop: 6, fontSize: 11 }} />
              )}
            </div>
          </div>

          {/* Bench & Controller State */}
          <div style={{ ...styles.sidePanel, marginTop: 10 }}>
            <div style={styles.sidePanelTitle}>APS Bench and Controller State</div>
            <div style={styles.sidePanelBody}>
              <div style={styles.benchTabs}>
                {(['LOWFS', 'PSH', 'PIT', 'APT'] as const).map(t => (
                  <button
                    key={t}
                    style={{ ...styles.benchTabBtn, ...(benchTab === t ? styles.benchTabActive : {}) }}
                    onClick={() => setBenchTab(t)}
                  >{t}</button>
                ))}
              </div>
              <BenchField label="Pupil Mask" value="4 (Phasing)" />
              <BenchField label="Filter" value="3 (891)" />
              <BenchField label="Focus Stage" value="0.035 (um)" />
              <BenchField label="CCD Power" value="ON" />
              <BenchField label="CCD Gain" value="Low: (0.66 e-/ct)" />
              <BenchField label="CCD Temp" value="57" />
              <div style={styles.benchDivider} />
              <BenchField label="Ref. Beam" value="Off" />
              <BenchField label="K-Mirror Phi" value="256.57 (deg)" />
              <BenchField label="Steering Mirror X" value="2.43 (um)" />
              <BenchField label="Steering Mirror Y" value="-0.97 (um)" />
              <BenchField label="Enclosure Temp" value="7.4 (C)" />
              <BenchField label="Enclosure Humidity" value="14.7%" />
              <BenchField label="Controller Temp" value="-5.4 (C)" />
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={styles.content}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            tabBarStyle={{ paddingLeft: 16, marginBottom: 0, background: '#fff', borderBottom: '1px solid #e0e0e0' }}
            items={[
              {
                key: 'setup',
                label: 'Setup',
                children: (
                  <div style={styles.tabPanel}>
                    <div style={styles.setupCard}>
                      <div style={styles.setupCardTitle}>Load Sequence Template</div>
                      <div style={styles.setupRow}>
                        <label style={styles.setupLabel}>Config Path</label>
                        <Input
                          placeholder="/aps/sequences/testmode.json"
                          value={configPath}
                          onChange={e => setConfigPath(e.target.value)}
                          onPressEnter={handleLoadTemplate}
                          disabled={loadStatus === 'loading'}
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                        />
                        <Button
                          type="primary"
                          onClick={handleLoadTemplate}
                          loading={loadStatus === 'loading'}
                          disabled={!configPath.trim()}
                        >
                          Load
                        </Button>
                      </div>
                      {loadError && <Alert type="error" message={loadError} showIcon style={{ marginTop: 10 }} />}
                      {eventError && <Alert type="error" message={`Event subscription: ${eventError}`} showIcon style={{ marginTop: 10 }} />}
                      {loadStatus === 'success' && sequenceJson && (
                        <div style={styles.setupJsonSection}>
                          <div style={styles.setupJsonLabel}>Loaded Sequence</div>
                          <TextArea
                            readOnly
                            rows={16}
                            value={JSON.stringify(sequenceJson, null, 2)}
                            style={{ fontFamily: 'monospace', fontSize: 11 }}
                          />
                          <Button
                            type="primary"
                            onClick={() => setActiveTab('run')}
                            style={{ marginTop: 12 }}
                          >
                            Go to Run Procedure →
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              },
              {
                key: 'run',
                label: 'Run Procedure',
                disabled: !sequenceJson,
                children: (
                  <div style={styles.runLayout}>

                    {/* Event log */}
                    <div style={styles.eventPanel}>
                      <div style={styles.eventPanelTitle}>
                        <span>Procedure Log</span>
                        {submitStatus === 'loading' && (
                          <Badge status="processing" text="live" style={{ marginLeft: 8, fontSize: 11 }} />
                        )}
                        {events.length > 0 && (
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                            ({events.length})
                          </Text>
                        )}
                      </div>
                      <div style={styles.eventLog} ref={eventLogRef}>
                        {events.length === 0 ? (
                          <div style={styles.eventEmpty}>
                            {submitStatus === 'idle'
                              ? 'Press Start to begin the procedure.'
                              : 'Waiting for procedure events…'}
                          </div>
                        ) : (
                          events.map((event, i) => (
                            event.type === 'USER_PROMPT' ? (
                              <div key={i} style={styles.promptCard}>
                                <div style={styles.promptHeader}>
                                  <span style={styles.promptWarningIcon}>
                                    {event.dialogKey === 'DECISION' ? '?' : '⚠'}
                                  </span>
                                  <span style={styles.promptTitle}>
                                    {event.dialogKey === 'DECISION' ? 'DECISION REQUIRED' : 'WARNING'}
                                  </span>
                                  <span style={seqTagStyle(sequencerLabel(event.source))}>{sequencerLabel(event.source)}</span>
                                </div>
                                <div style={styles.promptBody}>
                                  <Text style={{ fontSize: 13 }}>{getMessage(event.messageId)}</Text>
                                </div>
                                {promptResponses[event.messageUuid] ? (
                                  <div style={styles.promptResolved}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      Operator responded: <strong>"{promptResponses[event.messageUuid]}"</strong>
                                    </Text>
                                  </div>
                                ) : event.dialogKey === 'DECISION' ? (
                                  <div style={styles.promptButtons}>
                                    <Button size="small" onClick={() => handlePromptResponse(
                                      event.source, 'DECISION', event.messageId, event.messageUuid, 'Yes', 'YES', 'N/A'
                                    )}>Yes</Button>
                                    <Button size="small" onClick={() => handlePromptResponse(
                                      event.source, 'DECISION', event.messageId, event.messageUuid, 'No', 'NO', 'N/A'
                                    )}>No</Button>
                                    <Button size="small" danger onClick={() => handlePromptResponse(
                                      event.source, 'DECISION', event.messageId, event.messageUuid, 'Abort', 'ABORT', 'N/A'
                                    )}>Abort</Button>
                                  </div>
                                ) : (
                                  <div style={styles.promptButtons}>
                                    <Button size="small" onClick={() => handlePromptResponse(
                                      event.source, 'WARNING', event.messageId, event.messageUuid, 'Continue', 'N/A', 'CONTINUE'
                                    )}>Continue</Button>
                                    <Button size="small" onClick={() => handlePromptResponse(
                                      event.source, 'WARNING', event.messageId, event.messageUuid, 'Retry', 'N/A', 'RETRY'
                                    )}>Retry</Button>
                                    <Button size="small" danger onClick={() => handlePromptResponse(
                                      event.source, 'WARNING', event.messageId, event.messageUuid, 'Abort', 'N/A', 'ABORT'
                                    )}>Abort</Button>
                                  </div>
                                )}
                                {promptPublishErrors[event.messageUuid] && (
                                  <div style={styles.promptResolved}>
                                    <Text type="danger" style={{ fontSize: 11 }}>
                                      Failed to send response: {promptPublishErrors[event.messageUuid]}
                                    </Text>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div key={i} style={styles.eventRow}>
                                <Text type="secondary" style={styles.eventTime}>
                                  {event.eventTime.includes('T')
                                    ? event.eventTime.split('T')[1].slice(0, 12)
                                    : event.eventTime}
                                </Text>
                                <Tag color={tagColor(event.type)} style={{ margin: 0, fontSize: 9 }}>
                                  {eventTypeLabel(event.type)}
                                </Tag>
                                <span style={seqTagStyle(sequencerLabel(event.source))}>
                                  {sequencerLabel(event.source)}
                                </span>
                                <Text style={{ fontSize: 11 }}>{getMessage(event.messageId)}</Text>
                              </div>
                            )
                          ))
                        )}
                      </div>
                    </div>

                    {/* Exposure display */}
                    <div style={styles.exposurePanel}>
                      <Tabs
                        size="small"
                        tabBarStyle={{ paddingLeft: 8, marginBottom: 0, background: '#fafafa', borderBottom: '1px solid #e0e0e0' }}
                        items={['Exposure', 'Centroids', 'Centroid Offsets'].map(t => ({
                          key: t, label: t, children: null
                        }))}
                      />
                      <div style={styles.exposureImageArea}>
                        <div style={styles.exposureFilename}>18JUL2034_PSH_BBP_001_1B.FTS</div>
                        <div style={{ ...styles.exposureImageWrap, position: 'relative' }}>
                          <img
                            src={exposurePlaceholderImg}
                            alt="PSH exposure"
                            style={styles.exposureImage}
                          />
                          <div style={styles.expandIcon} title="Expand to full screen">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              {/* top-left */}
                              <polyline points="7,2 2,2 2,7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"/>
                              {/* top-right */}
                              <polyline points="13,2 18,2 18,7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"/>
                              {/* bottom-left */}
                              <polyline points="2,13 2,18 7,18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"/>
                              {/* bottom-right */}
                              <polyline points="18,13 18,18 13,18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div style={styles.exposureFooter}>
                        <span style={styles.exposureFooterText}>pos: (–, –)</span>
                        <span style={styles.exposureFooterText}>Median Peak Intensity: –</span>
                      </div>
                    </div>

                  </div>
                )
              }
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#f5f5f5',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    fontSize: 13,
    overflow: 'hidden',
    color: '#222',
  },

  // ── Top bar (dark) ──
  topBar: {
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #111820 0%, #0d1520 100%)',
    borderBottom: '1px solid #1e2d3d',
    padding: '0 20px',
    height: 52,
    flexShrink: 0,
    gap: 24,
  },
  topBarBrand: {
    flexShrink: 0,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#ffffff',
    textTransform: 'uppercase' as const,
  },
  statusPills: {
    display: 'flex',
    flex: 1,
    borderLeft: '1px solid #1e2d3d',
    paddingLeft: 24,
  },
  statusPill: {
    display: 'flex',
    flexDirection: 'column' as const,
    paddingRight: 24,
    borderRight: '1px solid #1e2d3d',
    marginRight: 24,
    lineHeight: 1.3,
  },
  statusPillLabel: {
    fontSize: 10,
    color: '#8baabf',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight: 600,
  },
  statusPillValue: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    marginTop: 1,
  },
  topBarAuth: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    borderLeft: '1px solid #1e2d3d',
    paddingLeft: 20,
  },
  authUser: {
    fontSize: 12,
    color: '#8baabf',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  authBtn: {
    padding: '4px 14px',
    background: 'transparent',
    border: '1px solid #2e4a62',
    borderRadius: 3,
    color: '#8baabf',
    fontSize: 12,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },

  // ── Layout ──
  mainLayout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },

  // ── Sidebar (light) ──
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: '#fff',
    borderRight: '1px solid #e0e0e0',
    overflowY: 'auto' as const,
    padding: '12px 10px',
  },
  sidePanel: {
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sidePanelTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#666',
    padding: '6px 10px',
    background: '#fafafa',
    borderBottom: '1px solid #e0e0e0',
  },
  sidePanelBody: {
    padding: '8px 10px',
  },
  benchField: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '3px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  benchFieldLabel: {
    fontSize: 11,
    color: '#888',
    flexShrink: 0,
    marginRight: 6,
  },
  benchFieldValue: {
    fontSize: 11,
    color: '#333',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    textAlign: 'right' as const,
  },
  benchDivider: {
    borderTop: '1px solid #e0e0e0',
    margin: '6px 0',
  },
  benchTabs: {
    display: 'flex',
    gap: 3,
    marginBottom: 8,
  },
  benchTabBtn: {
    flex: 1,
    padding: '3px 0',
    fontSize: 10,
    fontWeight: 600,
    background: '#f5f5f5',
    border: '1px solid #d9d9d9',
    color: '#888',
    borderRadius: 3,
    cursor: 'pointer',
  },
  benchTabActive: {
    background: '#e6f4ff',
    borderColor: '#1677ff',
    color: '#1677ff',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '8px 0',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    background: '#f0f0f0',
    borderRadius: 3,
    border: '1px solid #d9d9d9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1677ff 0%, #69b1ff 100%)',
    borderRadius: 3,
    transition: 'width 0.4s ease',
  },
  progressLabel: {
    fontSize: 11,
    color: '#888',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    width: 32,
    textAlign: 'right' as const,
  },
  controlButtons: {
    display: 'flex',
    gap: 6,
    margin: '8px 0',
  },
  sequencerViewLink: {
    fontSize: 11,
    color: '#1677ff',
    cursor: 'pointer',
    marginTop: 4,
  },

  // ── Content ──
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    background: '#f5f5f5',
  },
  tabPanel: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 20,
  },

  // ── Setup tab ──
  setupCard: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: 20,
    maxWidth: 680,
  },
  setupCardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: '1px solid #f0f0f0',
  },
  setupRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  setupLabel: {
    fontSize: 13,
    color: '#555',
    flexShrink: 0,
    width: 80,
  },
  setupJsonSection: {
    marginTop: 18,
    borderTop: '1px solid #f0f0f0',
    paddingTop: 14,
  },
  setupJsonLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: 600,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  // ── Run tab ──
  runLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    height: 'calc(100vh - 52px - 44px)',
  },

  // Event log
  eventPanel: {
    width: 450,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    borderRight: '1px solid #e0e0e0',
    background: '#fff',
  },
  eventPanelTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#888',
    padding: '8px 14px',
    borderBottom: '1px solid #f0f0f0',
    background: '#fafafa',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  eventLog: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  eventEmpty: {
    padding: '20px 14px',
    color: '#bbb',
    fontSize: 12,
    fontStyle: 'italic',
  },
  eventRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    padding: '4px 14px',
    borderBottom: '1px solid #fafafa',
  },
  eventTime: {
    fontSize: 10,
    whiteSpace: 'nowrap' as const,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    flexShrink: 0,
  },

  // USER_PROMPT inline dialog
  promptCard: {
    margin: '8px 14px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fff',
    overflow: 'hidden',
  },
  promptHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
  },
  promptWarningIcon: {
    fontSize: 16,
    color: '#faad14',
  },
  promptTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#888',
    textTransform: 'uppercase' as const,
    flex: 1,
  },
  promptBody: {
    padding: '10px 12px',
  },
  promptButtons: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid #f0f0f0',
    background: '#fafafa',
  },
  promptResolved: {
    padding: '6px 12px',
    borderTop: '1px solid #f0f0f0',
    background: '#fafafa',
  },

  // Exposure panel
  exposurePanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    background: '#f5f5f5',
  },
  exposureImageArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#f5f5f5',
    overflow: 'hidden',
    padding: '0 12px',
  },
  exposureFilename: {
    textAlign: 'center' as const,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    color: '#444',
    padding: '8px 0 6px',
    background: '#f5f5f5',
    flexShrink: 0,
  },
  expandIcon: {
    position: 'absolute' as const,
    bottom: 10,
    right: 10,
    cursor: 'pointer',
    opacity: 0.75,
  },
  exposureImageWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: '#000',
    borderRadius: 2,
  },
  exposureImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain' as const,
  },
  exposureFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#f5f5f5',
    flexShrink: 0,
    marginBottom: 12,
  },
  exposureFooterText: {
    fontSize: 11,
    color: '#888',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
}
