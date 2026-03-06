# 自定义模板引擎

## 模板引擎简介

模板引擎是负责处理模板内容、并在模板上执行数据绑定更新的模块。

glass-easel 的默认模板引擎是 `glassEasel.glassEaselTemplate` ，但也可以通过在组件 options 中指定 `templateEngine` 来使用自定义的模板引擎。

自定义模板引擎必须实现 TypeScript 接口 `glassEasel.templateEngine.TemplateEngine` 。

> 💡 在实现模板引擎前，请先确保你了解 [节点树](../tree/node_tree.md) 相关概念。

## 模板引擎接口

自定义模板引擎涉及以下三个层级的接口：

### `TemplateEngine`

`glassEasel.templateEngine.TemplateEngine` 接口需要实现一个 `create` 方法。该方法在组件定义准备（prepare）时调用一次，接受 `behavior`（组件行为对象）和 `componentOptions`（标准化后的组件选项）作为参数，返回一个 `glassEasel.templateEngine.Template` 对象。

### `Template`

`glassEasel.templateEngine.Template` 接口需要实现一个 `createInstance` 方法。该方法在每个组件实例创建时调用一次，接受当前组件实例和一个 `createShadowRoot` 回调作为参数，返回一个 `glassEasel.templateEngine.TemplateInstance` 对象。

### `TemplateInstance`

`glassEasel.templateEngine.TemplateInstance` 需要提供以下成员：

- `shadowRoot` ：组件的 Shadow Root 节点，通过调用 `createShadowRoot(component)` 回调获得。
- `initValues(data)` ：在组件创建时调用，用于根据初始数据构建节点树。
- `updateValues(data, changes)` ：在组件数据更新时调用，用于根据变更内容执行数据绑定更新。

实现模板引擎时，常常需要用到 [节点树变更](../tree/node_tree_modification.md) 接口来操作 Shadow Root 下的子节点。

## 自定义模板引擎示例

以下示例展示了一个自定义模板引擎的基本实现结构：

```typescript
import type {
  GeneralBehavior,
  GeneralComponent,
  NormalizedComponentOptions,
  ShadowRoot,
  templateEngine,
} from 'glass-easel'

class MyTemplateEngine implements templateEngine.TemplateEngine {
  static create(rootBehavior: GeneralBehavior, options: NormalizedComponentOptions) {
    behavior.getTemplate() // 组件的 template 字段内容
    return new MyTemplateEngine()
  }

  createInstance(
    component: GeneralComponent,
    createShadowRoot: (component: GeneralComponent) => ShadowRoot
  ): templateEngine.TemplateInstance {
    const instance: templateEngine.TemplateInstance = {
      shadowRoot: createShadowRoot(component),
      initValues: (data) => {
        // 组件被创建，初始数据是 data
      },
      updateValues: (data, changes) => {
        // 组件更新，新的数据是 data ，变更内容描述在 changes 中
      },
    }
  }
}

export const myComponent = componentSpace.define()
  .options({
    templateEngine: MyTemplateEngine,
  })
  .template(
    '', // 这部分内容由 MyTemplateEngine 来处理
  )
  .registerComponent()
```

### 示例：用 TemplateEngine 实现 root-portal 功能

root-portal 允许组件将其子节点"传送"到节点树的根部，而不是渲染在当前组件的 Shadow Tree 内部。这在实现弹窗、悬浮菜单等需要脱离局部布局的场景中非常有用。

以下示例通过自定义模板引擎实现了这一效果：在组件的 Shadow Tree 中创建一个 slot 来接收子节点，然后将 slot 挂载到根节点下，从而使子节点在视觉上"跳出"了当前组件。

```typescript
import {
  Element,
  type GeneralBehavior,
  type GeneralComponent,
  type NormalizedComponentOptions,
  type ShadowRoot,
  type templateEngine,
} from 'glass-easel'

// The template config specifying the target container for the portal
type PortalTemplateDef = {
  targetContainer: Element
}

class PortalTemplate implements templateEngine.Template {
  private targetContainer: Element

  constructor(targetContainer: Element) {
    this.targetContainer = targetContainer
  }

  createInstance(
    component: GeneralComponent,
    createShadowRoot: (component: GeneralComponent) => ShadowRoot,
  ): templateEngine.TemplateInstance {
    const shadowRoot = createShadowRoot(component)
    const targetContainer = this.targetContainer

    // Create a slot in the shadow root to receive child nodes
    const slot = shadowRoot.createVirtualNode('slot')
    Element.setSlotName(slot)
    slot.destroyBackendElementOnRemoval()

    // Create a wrapper node in the shadow root that will be mounted to the target container
    const wrapper = shadowRoot.createNativeNode('div')
    wrapper.destroyBackendElementOnRemoval()

    return {
      shadowRoot,
      initValues: (_data) => {
        // Append the slot to the wrapper and the wrapper to the target container.
        // This makes child nodes of the component "teleport" to the target container.
        wrapper.appendChild(slot)
        targetContainer.appendChild(wrapper)
      },
      updateValues: (_data, _changes) => {
        // No data bindings to update in this simple portal
      },
    }
  }
}

class PortalTemplateEngine implements templateEngine.TemplateEngine {
  create(
    behavior: GeneralBehavior,
    _options: NormalizedComponentOptions,
  ): templateEngine.Template {
    const templateDef = behavior.getTemplate() as PortalTemplateDef
    return new PortalTemplate(templateDef.targetContainer)
  }
}

// Usage:
// Assume `rootContainer` is a node at the root level of the page.
export const myPortal = componentSpace.define()
  .options({
    templateEngine: new PortalTemplateEngine(),
  })
  .template({
    targetContainer: rootContainer, // the portal target
  })
  .registerComponent()
```

使用该组件时，`<my-portal>` 的子节点会被渲染到 `rootContainer` 下，而非 `<my-portal>` 自身所在的位置。

### 示例：用 TemplateEngine 实现自定义模板引擎

以下示例展示如何使用 TemplateEngine 实现自定义模板引擎。template 接收一个 JSX 风格的渲染函数，模板引擎在 `initValues` 中根据初始数据构建节点树，在 `updateValues` 中根据数据变更更新节点。

```typescript
import {
  Element,
  type GeneralBehavior,
  type GeneralComponent,
  type NormalizedComponentOptions,
  type ShadowRoot,
  type templateEngine,
} from 'glass-easel'

// A simple JSX-like virtual node descriptor
type VNode =
  | string
  | {
      tag: string
      props?: Record<string, unknown>
      children?: VNode[]
    }

// A JSX-like render function that receives data and returns a VNode tree
type RenderFn = (data: Record<string, unknown>) => VNode

class JsxTemplate implements templateEngine.Template {
  private renderFn: RenderFn

  constructor(renderFn: RenderFn) {
    this.renderFn = renderFn
  }

  createInstance(
    component: GeneralComponent,
    createShadowRoot: (component: GeneralComponent) => ShadowRoot,
  ): templateEngine.TemplateInstance {
    const shadowRoot = createShadowRoot(component)
    const renderFn = this.renderFn

    // Build real nodes from a VNode tree
    const buildNode = (vnode: VNode): Element | null => {
      if (typeof vnode === 'string') {
        const textNode = shadowRoot.createTextNode(vnode)
        textNode.destroyBackendElementOnRemoval()
        return textNode as unknown as Element
      }

      const elem = shadowRoot.createNativeNode(vnode.tag)
      elem.destroyBackendElementOnRemoval()

      // Apply props as attributes
      if (vnode.props) {
        for (const [key, value] of Object.entries(vnode.props)) {
          if (key === 'class') {
            elem.setNodeClass(String(value))
          } else if (key === 'style') {
            elem.setNodeStyle(String(value))
          } else {
            elem.updateAttribute(key, value)
          }
        }
      }

      // Recursively build children
      if (vnode.children) {
        for (const child of vnode.children) {
          const childNode = buildNode(child)
          if (childNode) {
            elem.appendChild(childNode)
          }
        }
      }

      return elem
    }

    // Rebuild the entire shadow tree from data
    const renderAll = (data: Record<string, unknown>) => {
      // Clear existing children
      shadowRoot.removeChildren(0, shadowRoot.childNodes.length)
      // Build new tree
      const vnode = renderFn(data)
      const rootNode = buildNode(vnode)
      if (rootNode) {
        shadowRoot.appendChild(rootNode)
      }
    }

    return {
      shadowRoot,
      initValues: (data) => {
        renderAll(data as Record<string, unknown>)
      },
      updateValues: (data, _changes) => {
        // For simplicity, re-render the entire tree on every update.
        // A production implementation should diff the VNode trees for efficiency.
        renderAll(data as Record<string, unknown>)
      },
    }
  }
}

class JsxTemplateEngine implements templateEngine.TemplateEngine {
  create(
    behavior: GeneralBehavior,
    _options: NormalizedComponentOptions,
  ): templateEngine.Template {
    const renderFn = behavior.getTemplate() as RenderFn
    return new JsxTemplate(renderFn)
  }
}

// Usage:
export const myComponent = componentSpace.define()
  .options({
    templateEngine: new JsxTemplateEngine(),
  })
  .template(
    // A JSX-like render function as the template
    (data: Record<string, unknown>) => ({
      tag: 'div',
      props: { class: 'container' },
      children: [
        {
          tag: 'span',
          props: { class: 'greeting' },
          children: [String(data.message || 'Hello World')],
        },
        {
          tag: 'div',
          props: { class: 'content' },
          children: [String(data.content || '')],
        },
      ],
    }),
  )
  .data(() => ({
    message: 'Hello!',
    content: 'This is rendered by a custom JSX template engine.',
  }))
  .registerComponent()
```

> 💡 上面的示例为了简洁，在 `updateValues` 中采用了全量重建节点树的方式。在生产环境中，建议实现 VNode diff 算法来最小化 DOM 操作，以获得更好的性能。
