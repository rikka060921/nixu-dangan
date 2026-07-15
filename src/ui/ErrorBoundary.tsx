import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { clearSession } from '../game/storage'

interface ErrorBoundaryState {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Reverse Archive render failure', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="fatal-screen">
        <section className="panel" role="alert">
          <p className="eyebrow">ARCHIVE RECOVERY</p>
          <h1>档案渲染中断</h1>
          <p>当前调查遇到无法恢复的显示错误。你可以先重新加载；若错误持续，再清除本地调查存档。元进度不会被清除。</p>
          <div>
            <button type="button" onClick={() => window.location.reload()}>重新加载</button>
            <button type="button" onClick={() => { clearSession(); window.location.reload() }}>清除调查存档并重启</button>
          </div>
        </section>
      </main>
    )
  }
}
