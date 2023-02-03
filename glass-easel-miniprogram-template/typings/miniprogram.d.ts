import type { PageConstructor, ComponentConstructor } from 'glass-easel-miniprogram-adapter'

declare global {
  const Page: PageConstructor
  const Component: ComponentConstructor
}
