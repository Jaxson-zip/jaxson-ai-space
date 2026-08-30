'use client'

import React from 'react'
import { MessageSquare, LayoutGrid, Sparkles } from 'lucide-react'

interface DesignSwitcherProps {
  currentMode: 'agent' | 'bento'
  onModeChange: (mode: 'agent' | 'bento') => void
}

export function DesignSwitcher({ currentMode, onModeChange }: DesignSwitcherProps) {
  return (
    <aside className="design-switcher-bar" aria-label="设计方案预览切换器">
      <div className="design-switcher-inner">
        <span className="switcher-label">
          <Sparkles size={14} className="status-dot" />
          <span>切换方案体验：</span>
        </span>

        <div className="switcher-buttons" role="group" aria-label="方案选择">
          <button
            type="button"
            className={`switcher-btn ${currentMode === 'agent' ? 'active' : ''}`}
            onClick={() => onModeChange('agent')}
            aria-pressed={currentMode === 'agent'}
          >
            <MessageSquare size={14} />
            <span>方案 A：AI 对话沉浸流 (豆包/GPT 风格)</span>
          </button>

          <button
            type="button"
            className={`switcher-btn ${currentMode === 'bento' ? 'active' : ''}`}
            onClick={() => onModeChange('bento')}
            aria-pressed={currentMode === 'bento'}
          >
            <LayoutGrid size={14} />
            <span>方案 B：Bento 科技双栏仪表盘 (Linear 风格)</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
