import type { ArcDiagramData } from '@arach/arc'

const diagram: ArcDiagramData = {
  id: 'OPERATE.ROUTE.001',
  layout: { width: 780, height: 320 },
  nodes: {
    request: { x: 24, y: 110, size: 'm' },
    inventory: { x: 214, y: 32, size: 'm' },
    planner: { x: 214, y: 186, size: 'm' },
    selected: { x: 464, y: 96, size: 'm' },
    alternatives: { x: 464, y: 222, size: 'm' },
    dispatch: { x: 642, y: 96, size: 'm' },
  },
  nodeData: {
    request: { icon: 'SlidersHorizontal', name: 'Intent', subtitle: 'hints + prefs', color: 'zinc' },
    inventory: { icon: 'Radar', name: 'Targets', subtitle: 'filtered by runtime', color: 'zinc' },
    planner: { icon: 'Route', name: 'Selector', subtitle: 'best fit + alternatives', color: 'violet' },
    selected: { icon: 'CheckCircle2', name: 'Selected', subtitle: 'host/runtime pair', color: 'emerald' },
    alternatives: { icon: 'ListOrdered', name: 'Alternatives', subtitle: 'ranked + reasons', color: 'zinc' },
    dispatch: { icon: 'Send', name: 'Dispatch', subtitle: 'use selected target', color: 'blue' },
  },
  connectors: [
    { from: 'request', to: 'planner', fromAnchor: 'right', toAnchor: 'left', style: 'input' },
    { from: 'inventory', to: 'planner', fromAnchor: 'bottom', toAnchor: 'top', style: 'input' },
    { from: 'planner', to: 'selected', fromAnchor: 'right', toAnchor: 'left', style: 'pick' },
    { from: 'planner', to: 'alternatives', fromAnchor: 'bottomRight', toAnchor: 'left', style: 'explain' },
    { from: 'selected', to: 'dispatch', fromAnchor: 'right', toAnchor: 'left', style: 'dispatch' },
  ],
  connectorStyles: {
    input: { color: 'zinc', strokeWidth: 2, label: 'input', dashed: true },
    pick: { color: 'emerald', strokeWidth: 2, label: 'select' },
    explain: { color: 'zinc', strokeWidth: 2, label: 'return reasons', dashed: true },
    dispatch: { color: 'blue', strokeWidth: 2, label: 'use target' },
  },
}

export default diagram
