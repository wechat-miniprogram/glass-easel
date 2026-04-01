# 外部组件

## 使用外部组件来提升性能

有些时候，出于性能或一些特殊原因，可以使一个组件内部的实现不通过 Shadow Tree 维护，而是直接通过 DOM 接口或 [自定义后端](custom_backend.md) 接口来维护。

在组件中添加 `externalComponent` 选项，就可以使它成为一个外部组件，例如：

```js
componentSpace.define()
  .options({
    externalComponent: true,
  })
  .registerComponent()
```

> 💡 在使用外部组件前，请先确保你了解 [节点树](../tree/node_tree.md) 和 [自定义模板引擎](template_engine.md) 相关概念。

### 功能限制

外部组件通常具有更好的性能，但以下特性不可用或受限：

* 模板中的 `wx:if` `wx:for` 不可用，仅支持 [绑定映射表更新](binding_map_update.md) ；
* `getShadowRoot()` 方法对外部组件返回 `null` ，无法获取到 `ShadowRoot` 对象；
* 所有与 Shadow Tree 相关的树遍历方式（如选择器查询）都不能访问到组件内部的节点；
* 不支持多 Slot（`multipleSlots`）和动态 Slot（`dynamicSlots`）模式，仅支持单 Slot ；
* 无法引用其他组件；
* 外部样式类的更新不会向外部组件内部传播；
* 页面生命周期（Page Lifetime）事件不会递归传播到外部组件的内部子树中；
* 事件监听和冒泡由 `ExternalShadowRoot` 的 `handleEvent` / `setListener` 接管，而非 glass-easel 的标准事件系统。

## 外部组件与自定义模板引擎

外部组件也可以与 [自定义模板引擎](template_engine.md) 一起使用，使得部分 DOM 节点完全脱离 glass-easel 的维护。当需要其他第三方框架来维护部分 DOM 节点时，这种方式很实用。

### `ExternalShadowRoot` 接口

外部组件使用时，自定义模板引擎在实现 `TemplateInstance` 接口时，返回的 `shadowRoot` 必须是 `glassEasel.ExternalShadowRoot` 类型（而非普通的 `ShadowRoot` ）。该接口定义如下：

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `root` | `GeneralBackendElement` | 用作 Shadow Root 的后端节点 |
| `slot` | `GeneralBackendElement` | 用作 Slot 的后端节点，组件的子节点将被分配到此处 |
| `getIdMap()` | `() => { [id: string]: GeneralBackendElement }` | 返回节点 ID 到后端节点的映射表，供 `getElementById` 等查询使用 |
| `handleEvent(target, event)` | `(target: GeneralBackendElement, event: Event) => void` | 在指定的后端节点上触发一个事件 |
| `setListener(elem, ev, listener)` | `(elem: GeneralBackendElement, ev: string, listener: (event: ShadowedEvent) => unknown) => void` | 在指定的后端节点上添加一个事件监听器 |

### 示例

以下示例展示了如何实现一个面向外部组件的自定义模板引擎：

```typescript
import type {
  GeneralBackendElement,
  GeneralBehavior,
  GeneralComponent,
  NormalizedComponentOptions,
  ExternalShadowRoot,
  Event,
  ShadowedEvent,
  templateEngine,
} from 'glass-easel'

class MyTemplateEngine implements templateEngine.TemplateEngine {
  create(behavior: GeneralBehavior, options: NormalizedComponentOptions): MyTemplate {
    behavior.getTemplate() // retrieve the component's template field
    // Ensure the component is defined as an external component
    if (!options.externalComponent) {
      throw new Error('This template engine can only be used with external components')
    }
    return new MyTemplate()
  }
}

class MyTemplate implements templateEngine.Template {
  createInstance(component: GeneralComponent): MyTemplateInstance {
    return new MyTemplateInstance(component)
  }
}

class MyTemplateInstance implements templateEngine.TemplateInstance {
  shadowRoot: ExternalShadowRoot

  constructor(component: GeneralComponent) {
    const root = component.getBackendElement()!
    const slot = document.createElement('div') as unknown as GeneralBackendElement

    this.shadowRoot = {
      root,
      slot,
      getIdMap(): { [id: string]: GeneralBackendElement } {
        // Return a mapping from node IDs to backend elements
        return {}
      },
      handleEvent(target: GeneralBackendElement, event: Event<unknown>): void {
        // Trigger an event on the target element
      },
      setListener<T>(
        elem: GeneralBackendElement,
        ev: string,
        listener: (event: ShadowedEvent<T>) => unknown,
      ): void {
        // Add an event listener to the element
      },
    }
  }

  initValues(data: Record<string, unknown>): void {
    // Called when the component is created; `data` contains the initial data
  }

  updateValues(data: Record<string, unknown>, changes: unknown[]): void {
    // Called when the component data updates;
    // `data` is the new data, `changes` describes what has changed
  }
}

// Usage:
export const myExternalComponent = componentSpace.define()
  .options({
    externalComponent: true,
    templateEngine: new MyTemplateEngine(),
  })
  .data(() => ({
    message: 'Hello from external component!',
  }))
  .registerComponent()
```
