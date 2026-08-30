'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
    if (savedTheme !== 'dark') {
      // Async update to avoid cascading render lint violation
      const timer = setTimeout(() => setTheme(savedTheme), 0)
      return () => clearTimeout(timer)
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    localStorage.setItem('payload-theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    document.cookie = `payload-theme=${nextTheme}; path=/; max-age=31536000`
  }

  return (
    <button
      type="button"
      className="theme-toggle-pill"
      onClick={toggleTheme}
      aria-label={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`}
      title={`当前为${theme === 'dark' ? '暗色' : '浅色'}模式，点击切换主题`}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={14} className="theme-icon-sun" />
          <span>亮色</span>
        </>
      ) : (
        <>
          <Moon size={14} className="theme-icon-moon" />
          <span>暗色</span>
        </>
      )}
    </button>
  )
}
