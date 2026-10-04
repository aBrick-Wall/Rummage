import type { ChangeEvent, KeyboardEvent, Ref } from 'react'
import { Icon } from './Icon'
import './SearchField.css'

export interface SearchFieldProps {
  value: string
  onChange(value: string): void
  onEscape?(): void
  /** Visually hidden label; also the accessible name of the search region. */
  label?: string
  placeholder?: string
  ref?: Ref<HTMLInputElement>
}

/** Rummage's search box. Searching is "rummaging", and the copy says so. */
export function SearchField({
  value,
  onChange,
  onEscape,
  label = 'Rummage',
  placeholder = 'Rummage for something to watch…',
  ref
}: SearchFieldProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && (value !== '' || onEscape)) {
      event.preventDefault()
      onChange('')
      onEscape?.()
    }
  }

  return (
    <div className="rm-search" role="search">
      <label className="rm-visually-hidden" htmlFor="rm-search-input">
        {label}
      </label>
      <Icon name="search" className="rm-search__icon" size="1.375rem" />
      <input
        ref={ref}
        id="rm-search-input"
        className="rm-search__input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {value !== '' ? (
        <button
          type="button"
          className="rm-search__clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <Icon name="close" />
        </button>
      ) : null}
    </div>
  )
}
