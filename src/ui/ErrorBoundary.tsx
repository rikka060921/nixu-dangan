import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { clearSessionV1 } from '../v1/storage'

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
          <p>当前双线档案遇到无法恢复的显示错误。你可以先重新加载；若错误持续，再清除本地断点。统计与设置不会被清除。</p>
          <div>
            <button type="button" onClick={() => window.location.reload()}>重新加载</button>
            <button type="button" onClick={() => { clearSessionV1(); window.location.reload() }}>清除双线断点并重启</button>
          </div>
        </section>
      </main>
    )
  }
}
