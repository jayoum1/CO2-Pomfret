'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { debounce, normalizeString } from '@/utils/performance'

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  debounceMs?: number
  className?: string
  ariaLabel?: string
}

/**
 * Real-time search input with debouncing
 * Based on analysis document pattern
 */
export default function SearchInput({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  className = '',
  ariaLabel = 'Search',
}: SearchInputProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search function
  const debouncedSearch = useRef(
    debounce((normalizedQuery: string) => {
      onSearch(normalizedQuery)
    }, debounceMs)
  ).current

  useEffect(() => {
    const normalized = normalizeString(query)
    debouncedSearch(normalized)
  }, [query, debouncedSearch])

  const handleClear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Search className="w-4 h-4 text-[#4ade80]/50" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full pl-10 pr-10 py-2 glass border border-[#334155]/50 rounded-lg text-[#4ade80] placeholder:text-[#4ade80]/30 focus:ring-2 focus:ring-[#4ade80]/50 focus:border-[#4ade80]/50 transition-all"
      />
      {query && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ade80]/50 hover:text-[#4ade80] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
