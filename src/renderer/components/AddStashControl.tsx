import { useState } from 'react'
import { useStash } from '../lib/StashContext'
import { Button } from './Button'
import { Modal } from './Modal'

export interface AddStashControlProps {
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'lg'
}

/**
 * "Add Your Stash": asks the main process to open a native folder picker (the renderer never
 * handles a path) and explains duplicate/invalid selections in a dialog.
 */
export function AddStashControl({ variant = 'primary', size = 'md' }: AddStashControlProps) {
  const { addStash } = useStash()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      const result = await addStash()
      if (result.outcome === 'duplicate') {
        setNotice({
          title: 'Already in Your Stash',
          message: `"${result.connection.name}" is already connected. Use Rescan on the Sources page to look for new files.`
        })
      } else if (result.outcome === 'error') {
        setNotice({ title: "That one didn't work", message: result.message })
      }
    } catch {
      setNotice({
        title: "That one didn't work",
        message: 'Rummage could not open the folder picker.'
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant={variant} size={size} icon="plus" onClick={() => void run()} disabled={busy}>
        Add Your Stash
      </Button>
      <Modal open={notice !== null} title={notice?.title ?? ''} onClose={() => setNotice(null)}>
        <p>{notice?.message}</p>
      </Modal>
    </>
  )
}
