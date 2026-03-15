import type { ArcDiagramData } from '@arach/arc'

const diagram: ArcDiagramData = {
  id: 'OPERATE.CONTROL.001',
  layout: { width: 720, height: 280 },
  nodes: {
    clients: { x: 20, y: 112, size: 'xs' },
    api: { x: 90, y: 95, size: 'm' },
    routing: { x: 290, y: 30, size: 's' },
    dispatch: { x: 290, y: 130, size: 's' },
    inventory: { x: 290, y: 220, size: 's' },
    arts: { x: 540, y: 30, size: 's' },
    tmux: { x: 540, y: 130, size: 's' },
  },
  nodeData: {
    clients: { icon: 'Laptop', name: 'Clients', color: 'zinc' },
    api: { icon: 'Server', name: 'Control Plane', subtitle: 'API surface', color: 'blue' },
    routing: { icon: 'Route', name: 'Routing', subtitle: 'target selection', color: 'violet' },
    dispatch: { icon: 'Send', name: 'Dispatch', subtitle: 'cmd + agent', color: 'emerald' },
    inventory: { icon: 'Radar', name: 'Inventory', subtitle: 'hosts + runtimes', color: 'zinc' },
    arts: { icon: 'Monitor', name: 'Remote Host', subtitle: 'runtime exec', color: 'zinc' },
    tmux: { icon: 'Rows3', name: 'tmux', subtitle: 'agent context', color: 'zinc' },
  },
  connectors: [
    { from: 'clients', to: 'api', fromAnchor: 'right', toAnchor: 'left', style: 'request' },
    { from: 'api', to: 'routing', fromAnchor: 'topRight', toAnchor: 'left', style: 'decision' },
    { from: 'api', to: 'dispatch', fromAnchor: 'right', toAnchor: 'left', style: 'dispatch' },
    { from: 'api', to: 'inventory', fromAnchor: 'bottomRight', toAnchor: 'left', style: 'read' },
    { from: 'routing', to: 'dispatch', fromAnchor: 'bottom', toAnchor: 'top', style: 'target' },
    { from: 'dispatch', to: 'arts', fromAnchor: 'right', toAnchor: 'left', style: 'remote' },
    { from: 'dispatch', to: 'tmux', fromAnchor: 'bottomRight', toAnchor: 'left', style: 'session' },
  ],
  connectorStyles: {
    request: { color: 'zinc', strokeWidth: 2 },
    read: { color: 'zinc', strokeWidth: 2, label: 'inventory', dashed: true },
    decision: { color: 'violet', strokeWidth: 2, label: 'route' },
    dispatch: { color: 'blue', strokeWidth: 2, label: 'dispatch' },
    target: { color: 'emerald', strokeWidth: 2, dashed: true },
    remote: { color: 'blue', strokeWidth: 2, label: 'remote' },
    session: { color: 'zinc', strokeWidth: 2, label: 'session', dashed: true },
  },
}

export default diagram
