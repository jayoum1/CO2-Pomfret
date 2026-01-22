'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Modal component with keyboard support and backdrop click
 * Based on analysis document pattern
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement

    document.addEventListener('keydown', handleEscape)
    
    // Focus trap - focus first focusable element
    const firstFocusable = modalRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement
    firstFocusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleEscape)
      // Restore previous focus
      previousFocusRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      
      {/* Modal Content */}
      <div
        ref={modalRef}
        className={`relative glass dark-card rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || true) && (
          <div className="flex items-center justify-between mb-4">
            {title && (
              <h2 id="modal-title" className="text-xl font-semibold gradient-text-subtle">
                {title}
              </h2>
            )}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-lg text-[#4ade80]/70 hover:text-[#4ade80] hover:bg-[#1e293b]/50 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="text-[#4ade80]/80">
          {children}
        </div>
      </div>
    </div>
  )
}
