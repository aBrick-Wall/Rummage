import { useState } from 'react'
import type { SourceConnection } from '@shared/domain'
import { AddStashControl } from '../components/AddStashControl'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyStash } from '../components/EmptyStash'
import { Modal } from '../components/Modal'
import { ScanBanner } from '../components/ScanBanner'
import { SectionHeader } from '../components/SectionHeader'
import { StatusIndicator } from '../components/StatusIndicator'
import { formatDate } from '../lib/format'
import { useStash } from '../lib/StashContext'
import './SourcesScreen.css'

export function SourcesScreen() {
  const { connections, progress, rescan, remove } = useStash()
  const [pendingRemoval, setPendingRemoval] = useState<SourceConnection | null>(null)

  const confirmRemoval = async () => {
    const target = pendingRemoval
    setPendingRemoval(null)
    if (target) await remove(target.id)
  }

  return (
    <>
      <SectionHeader
        level={1}
        title="Sources"
        subtitle="Where your stash comes from. Only folders you choose are ever scanned, and only for video files."
        action={connections.length > 0 ? <AddStashControl /> : undefined}
      />
      <ScanBanner progress={progress} connections={connections} />
      {connections.length === 0 ? (
        <EmptyStash />
      ) : (
        <ul className="rm-sources">
          {connections.map((connection) => (
            <li key={connection.id}>
              <Card className="rm-source">
                <div className="rm-source__main">
                  <h2 className="rm-source__name">{connection.name}</h2>
                  <p className="rm-source__location">{connection.location}</p>
                  <p className="rm-source__meta">
                    {connection.itemCount} {connection.itemCount === 1 ? 'video' : 'videos'}
                    {connection.lastScannedAt
                      ? ` · Last scanned ${formatDate(connection.lastScannedAt)}`
                      : ' · Not scanned yet'}
                  </p>
                </div>
                <StatusIndicator status={connection.status} detail={connection.statusDetail} />
                <div className="rm-source__actions">
                  <Button
                    icon="refresh"
                    onClick={() => void rescan(connection.id)}
                    disabled={connection.status === 'scanning'}
                    aria-label={`Rescan ${connection.name}`}
                  >
                    Rescan
                  </Button>
                  <Button
                    variant="danger"
                    icon="trash"
                    onClick={() => setPendingRemoval(connection)}
                    aria-label={`Remove ${connection.name}`}
                  >
                    Remove
                  </Button>
                </div>
                {connection.statusDetail && connection.status !== 'connected' ? (
                  <p className="rm-source__detail">{connection.statusDetail}</p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={pendingRemoval !== null}
        title="Remove from Your Stash?"
        onClose={() => setPendingRemoval(null)}
        actions={
          <>
            <Button data-autofocus onClick={() => setPendingRemoval(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => void confirmRemoval()}>
              Remove
            </Button>
          </>
        }
      >
        <p>
          Rummage will forget “{pendingRemoval?.name}” and its index. Your actual files are never
          touched.
        </p>
      </Modal>
    </>
  )
}
