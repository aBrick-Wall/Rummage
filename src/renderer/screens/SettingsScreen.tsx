import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/domain'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { Mascot } from '../components/Mascot'
import { SectionHeader } from '../components/SectionHeader'
import { useApi } from '../lib/StashContext'
import './SettingsScreen.css'

export function SettingsScreen() {
  const api = useApi()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void api.app.getInfo().then((value) => {
      if (!cancelled) setInfo(value)
    })
    return () => {
      cancelled = true
    }
  }, [api])

  return (
    <>
      <SectionHeader level={1} title="Settings" />
      <div className="rm-settings">
        <Card className="rm-settings__card">
          <h2 className="rm-settings__heading">Tools</h2>
          <p className="rm-muted">
            Rummage uses ffprobe to read duration, codecs and resolution. It looks for the file
            named by the RUMMAGE_FFPROBE_PATH environment variable, then for one bundled with the
            app, then on your PATH.
          </p>
          <ul className="rm-settings__tools">
            {info?.tools.map((tool) => (
              <li key={tool.name}>
                <strong>{tool.name}</strong>
                <Badge tone={tool.available ? 'success' : 'warning'}>
                  {tool.available ? 'Found' : 'Not found'}
                </Badge>
                {tool.detail ? <span className="rm-muted">{tool.detail}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="rm-settings__card rm-settings__about">
          <Mascot width="14rem" label="The Dumpsterlight raccoon watching TV" />
          <div>
            <h2 className="rm-settings__heading">About Rummage</h2>
            <p>Version {info?.version ?? '…'}</p>
            <p className="rm-muted">by Dumpsterlight Digital · Raccoonware</p>
            <p className="rm-muted rm-settings__fineprint">
              Rummage plays media you own or have permission to access. It doesn&rsquo;t download
              videos.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
