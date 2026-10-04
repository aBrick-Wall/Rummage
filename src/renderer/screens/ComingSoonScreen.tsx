import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { Icon, type IconName } from '../components/Icon'

const COPY = {
  'free-finds': {
    icon: 'finds',
    title: 'Free Finds',
    description:
      'Free, legitimate online video will turn up here someday. Nothing to rummage through yet.'
  },
  'watch-pile': {
    icon: 'pile',
    title: 'Watch Pile',
    description: 'A place to set things aside for later. Not built yet.'
  }
} as const satisfies Record<string, { icon: IconName; title: string; description: string }>

export function ComingSoonScreen({ section }: { section: keyof typeof COPY }) {
  const copy = COPY[section]
  return (
    <EmptyState
      illustration={<Icon name={copy.icon} size="3.5rem" />}
      title={copy.title}
      description={copy.description}
      footnote={<Badge tone="neutral">Coming later</Badge>}
    />
  )
}
