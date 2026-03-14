import * as docsJsonModule from '../../docs.json'

export type NavItem = {
  title: string
  href: string
}

export type NavGroup = {
  id: string
  title: string
  items: NavItem[]
}

type DocsJsonItem = {
  id: string
  title: string
}

type DocsJsonGroup = {
  id: string
  title: string
  items: DocsJsonItem[]
}

type DocsJsonShape = {
  name: string
  groups: DocsJsonGroup[]
}

const docsData = ('default' in docsJsonModule ? docsJsonModule.default : docsJsonModule) as DocsJsonShape

export const navGroups: NavGroup[] = docsData.groups.map((group) => ({
  id: group.id,
  title: group.title,
  items: group.items.map((item) => ({
    title: item.title,
    href: '/docs/' + item.id,
  })),
}))
