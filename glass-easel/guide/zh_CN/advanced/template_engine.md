# 自定义模板引擎

## 模板引擎简介

模板引擎是处理模板、在模板上应用数据绑定更新的模块。

glass-easel 的默认模板引擎是 `glassEasel.glassEaselTemplate` ，但也可以通过更改组件 options 来指定另一个自定义的模块作为模板引擎。

自定义模板引擎必须实现 TypeScript 接口 `glassEasel.templateEngine.TemplateEngine` 。

实现模板引擎前，请先确保你了解 [节点树](../tree/node_tree.md) 概念。

## 模板引擎接口

`glassEasel.templateEngine.TemplateEngine` 接口需要实现一个 `create` 方法。这个方法对每个组件定义执行一次。它接受传入的组件定义，传出一个 `glassEasel.templateEngine.Template` 。

`glassEasel.templateEngine.Template` 接口需要实现一个 `createInstance` 方法。这个方法在每个组件实例创建时执行一次。它需要生成一个 `glassEasel.templateEngine.TemplateInstance` 。

`glassEasel.templateEngine.TemplateInstance` 则需要提供一个 `shadowRoot` 节点（调用 `glassEasel.ShadowRoot.createShadowRoot` 来获得）作为组件实例的 `this.shadowRoot` 。还需要实现 `initValues` 和 `updateValues` ，分别用于创建初始节点树、更新数据绑定。

实现模板引擎时，常常需要用到 [节点树变更](../tree/node_tree_modification.md) 接口。

## 自定义模板引擎示例

自定义模板引擎的实现可以大体上以下例表示：

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
