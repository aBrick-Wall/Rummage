import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MediaItem, PlaybackSource } from '@shared/domain'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
import { MediaCard } from './MediaCard'
import { Modal } from './Modal'
import { NavigationItem } from './NavigationItem'
import { SearchField } from './SearchField'
import { SectionHeader } from './SectionHeader'
import { StatusIndicator } from './StatusIndicator'
import { VideoPlayer } from './VideoPlayer'

const item: MediaItem = {
  id: 'i1',
  providerId: 'p',
  kind: 'video',
  title: 'Road Trip',
  addedAt: 1,
  durationMs: 65_000,
  artwork: [],
  sources: [
    {
      id: 's1',
      providerId: 'p',
      kind: 'local-file',
      connectionName: 'Movies',
      location: '/m/road.mp4',
      hasTechnicalInfo: true,
      technical: { width: 1920, height: 1080 }
    }
  ]
}

describe('SearchField', () => {
  it('speaks in Rummage terms and reports typing', async () => {
    const onChange = vi.fn()
    render(<SearchField value="" onChange={onChange} />)
    const input = screen.getByRole('searchbox', { name: 'Rummage' })
    expect(input).toHaveAttribute('placeholder', 'Rummage for something to watch…')
    await userEvent.type(input, 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('offers to clear a non-empty query', async () => {
    const onChange = vi.fn()
    render(<SearchField value="trip" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

describe('MediaCard', () => {
  it('is a keyboard-focusable button that selects the item', async () => {
    const onSelect = vi.fn()
    render(<MediaCard item={item} onSelect={onSelect} />)
    const card = screen.getByRole('button', { name: 'Road Trip, 1:05' })
    expect(card).toHaveTextContent('1080p')
    expect(card).toHaveTextContent('Movies')
    await userEvent.tab()
    expect(card).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(item)
  })

  it('shows real artwork when a provider supplies it', () => {
    render(
      <MediaCard
        item={{ ...item, artwork: [{ kind: 'thumbnail', url: 'rummage-media://stream/x' }] }}
        onSelect={() => undefined}
      />
    )
    expect(document.querySelector('img')).toHaveAttribute('src', 'rummage-media://stream/x')
  })
})

describe('StatusIndicator', () => {
  it.each([
    ['connected', 'Connected'],
    ['scanning', 'Scanning'],
    ['offline', 'Offline'],
    ['needs-attention', 'Needs Attention']
  ] as const)('labels %s with text, not just color', (status, label) => {
    render(<StatusIndicator status={status} />)
    expect(screen.getByRole('status', { name: label })).toBeInTheDocument()
    expect(document.querySelector('svg, .rm-spinner')).not.toBeNull()
  })
})

describe('shared components', () => {
  it('Button defaults to type=button and renders an icon', () => {
    render(<Button icon="plus">Add Your Stash</Button>)
    const button = screen.getByRole('button', { name: 'Add Your Stash' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('Card renders as any element', () => {
    render(
      <Card as="section" aria-label="x">
        hi
      </Card>
    )
    expect(screen.getByLabelText('x').tagName).toBe('SECTION')
  })

  it('Badge, SectionHeader, NavigationItem and EmptyState render their content', async () => {
    const onSelect = vi.fn()
    render(
      <>
        <Badge tone="accent">1080p</Badge>
        <SectionHeader level={1} title="Your Stash" subtitle="sub" action={<span>act</span>} />
        <NavigationItem label="Sources" icon="sources" active onSelect={onSelect} />
        <EmptyState
          title="Nothing turned up in that rummage."
          description="Try another title or check your sources."
        />
      </>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Your Stash' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sources' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Sources' }))
    expect(onSelect).toHaveBeenCalled()
    expect(screen.getByText('Nothing turned up in that rummage.')).toBeInTheDocument()
    expect(screen.getByText('1080p')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('traps focus, closes on Escape and restores focus', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <>
        <button type="button">opener</button>
        <Modal open={false} title="Sure?" onClose={onClose}>
          body
        </Modal>
      </>
    )
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()
    rerender(
      <>
        <button type="button">opener</button>
        <Modal open title="Sure?" onClose={onClose}>
          body
        </Modal>
      </>
    )
    const dialog = screen.getByRole('dialog', { name: 'Sure?' })
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.tab()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    rerender(
      <>
        <button type="button">opener</button>
        <Modal open={false} title="Sure?" onClose={onClose}>
          body
        </Modal>
      </>
    )
    expect(opener).toHaveFocus()
  })
})

describe('VideoPlayer', () => {
  const playback: PlaybackSource = {
    providerId: 'p',
    itemId: 'i1',
    sourceId: 's1',
    transport: 'progressive',
    url: 'rummage-media://stream/s1',
    mimeType: 'video/mp4',
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac'
  }

  it('plays supported media using only the provider-supplied URL', () => {
    render(
      <VideoPlayer
        item={item}
        playback={playback}
        onBack={() => undefined}
        canPlayType={() => 'probably'}
      />
    )
    expect(document.querySelector('video')).toHaveAttribute('src', 'rummage-media://stream/s1')
  })

  it('shows a clean unsupported state instead of a player', async () => {
    const onBack = vi.fn()
    render(
      <VideoPlayer
        item={item}
        playback={{
          ...playback,
          container: 'avi',
          mimeType: 'video/x-msvideo',
          videoCodec: 'mpeg4'
        }}
        onBack={onBack}
        canPlayType={() => ''}
      />
    )
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('This one won’t play here — yet.')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('lets the user try anyway, then falls back to the unsupported state when playback errors', async () => {
    const unsupported = { ...playback, container: 'matroska', mimeType: 'video/x-matroska' }
    render(
      <VideoPlayer
        item={item}
        playback={unsupported}
        onBack={() => undefined}
        canPlayType={() => ''}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try playing anyway' }))
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    Object.defineProperty(video, 'error', { value: { code: 4 } })
    video?.dispatchEvent(new Event('error'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try playing anyway' })).toBeNull()
  })

  it('warns when only the audio track is undecodable', () => {
    render(
      <VideoPlayer
        item={item}
        playback={{ ...playback, audioCodec: 'dts' }}
        onBack={() => undefined}
        canPlayType={() => 'probably'}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('DTS')
    expect(document.querySelector('video')).not.toBeNull()
  })
})
