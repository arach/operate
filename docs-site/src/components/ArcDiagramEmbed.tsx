import { useEffect, useRef, useState } from 'react'
import { ArcDiagram } from '@arach/arc'
import type { ArcDiagramData } from '@arach/arc'

type ArcDiagramEmbedProps = {
  title: string
  caption?: string
  data: ArcDiagramData
}


export default function ArcDiagramEmbed({ title, caption, data }: ArcDiagramEmbedProps) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const [isLocal, setIsLocal] = useState(false)
  const [viewport, setViewport] = useState<{ width: number; height: number } | undefined>(undefined)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateMode = () => {
      const nextMode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
      setMode(nextMode)
    }

    updateMode()
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    setIsLocal(local)

    const observer = new MutationObserver(updateMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => observer.disconnect()
  }, [])

  // Measure viewport
  useEffect(() => {
    if (!isLocal || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    setViewport({ width: Math.round(rect.width), height: Math.round(rect.height) })
  }, [isLocal])

  return (
    <section className="arc-embed" data-pagefind-ignore>
      <div className="arc-embed-head">
        <p className="arc-embed-kicker">{isLocal ? 'Editable diagram — drag nodes to reposition' : 'Interactive diagram'}</p>
        <h2>{title}</h2>
        {caption ? <p className="arc-embed-caption">{caption}</p> : null}
      </div>
      <div className="arc-embed-canvas" ref={canvasRef}>
        <ArcDiagram data={data} mode={mode} theme="cool" interactive={true} showAutoLayout={true} editable={isLocal} editorUrl={isLocal ? 'http://localhost:5188/editor' : undefined} editorMeta={viewport ? { viewport, theme: 'cool', mode } : undefined} className="arc-diagram-root" />
      </div>

      <style>{`
        .arc-embed {
          margin: 18px 0 30px;
          border-radius: 18px;
          border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
          background: color-mix(in srgb, var(--color-surface) 86%, transparent);
          padding: 16px;
          box-shadow: var(--shadow-soft);
        }

        .arc-embed-head {
          margin-bottom: 12px;
        }

        .arc-embed-kicker {
          margin: 0;
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-accent);
        }

        .arc-embed-head h2 {
          margin: 8px 0 0;
          font-size: 1.35rem;
          border: none;
          padding: 0;
        }

        .arc-embed-caption {
          margin: 6px 0 0;
          color: var(--color-text-muted);
          font-size: 13px;
          line-height: 1.6;
        }

        .arc-embed-canvas {
          border-radius: 14px;
          overflow: auto;
          background: color-mix(in srgb, var(--color-surface-muted) 72%, transparent);
          -webkit-overflow-scrolling: touch;
          padding: 10px;
        }

        :global(.arc-diagram-root) {
          min-width: max-content;
        }
      `}</style>
    </section>
  )
}
