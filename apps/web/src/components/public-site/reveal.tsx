'use client'

import { useEffect, useRef } from 'react'

type RevealProps = Readonly<{
  children: React.ReactNode
  className?: string
}>

export function Reveal({ children, className = '' }: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current

    if (
      !element ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    element.classList.add('reveal-pending')

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return

        element.classList.remove('reveal-pending')
        element.classList.add('reveal-visible')
        observer.unobserve(element)
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <div className={`reveal ${className}`.trim()} ref={elementRef}>
      {children}
    </div>
  )
}
