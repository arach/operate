import type { ArcDiagramData } from '@arach/arc'

const diagram: ArcDiagramData = {
  id: 'OPERATE.FLOW.001',
  layout: { width: 980, height: 420 },
  nodes: {
    request: { x: 40, y: 160, size: 'm' },
    dispatch: { x: 250, y: 160, size: 'm' },
    job: { x: 500, y: 90, size: 'm' },
    session: { x: 500, y: 250, size: 'm' },
    worker: { x: 740, y: 90, size: 'm' },
    tmux: { x: 740, y: 250, size: 'm' },
    capture: { x: 890, y: 250, size: 's' },
  },
  nodeData: {
    request: { icon: 'Inbox', name: 'Request', subtitle: 'cmd | agent', color: 'violet' },
    dispatch: { icon: 'Server', name: 'Dispatch', subtitle: 'mode switch', color: 'blue' },
    job: { icon: 'Clock3', name: 'Job', subtitle: 'queued→done', color: 'amber' },
    session: { icon: 'Square', name: 'Session', subtitle: 'name + host', color: 'emerald' },
    worker: { icon: 'Play', name: 'Worker', subtitle: 'exec runtime', color: 'sky' },
    tmux: { icon: 'Rows3', name: 'tmux', subtitle: 'send/capture', color: 'violet' },
    capture: { icon: 'FileCode', name: 'Output', subtitle: 'pane lines', color: 'zinc' },
  },
  connectors: [
    { from: 'request', to: 'dispatch', fromAnchor: 'right', toAnchor: 'left', style: 'ingress' },
    { from: 'dispatch', to: 'job', fromAnchor: 'right', toAnchor: 'left', style: 'command' },
    { from: 'dispatch', to: 'session', fromAnchor: 'bottomRight', toAnchor: 'left', style: 'agent' },
    { from: 'job', to: 'worker', fromAnchor: 'right', toAnchor: 'left', style: 'run' },
    { from: 'session', to: 'tmux', fromAnchor: 'right', toAnchor: 'left', style: 'run' },
    { from: 'tmux', to: 'capture', fromAnchor: 'right', toAnchor: 'left', style: 'capture' },
  ],
  connectorStyles: {
    ingress: { color: 'violet', strokeWidth: 2, label: 'POST' },
    command: { color: 'amber', strokeWidth: 2, label: 'mode=command' },
    agent: { color: 'emerald', strokeWidth: 2, label: 'mode=agent' },
    run: { color: 'sky', strokeWidth: 2, label: 'remote exec' },
    capture: { color: 'zinc', strokeWidth: 2, label: '/capture' },
  },
}

export default diagram
