# 组件定义风格

在定义组件时，有两种接口风格可选： **Definition API** 和 **Chaining API** 。两者在功能上是完全等价的，定义每个组件时都可以任选一种。我们推荐使用 **Chaining API** ，它拥有更好的 TypeScript 支持和更灵活的逻辑拆分能力。

| | Definition API | Chaining API（推荐） |
|---|---|---|
| 入口方法 | `componentSpace.defineComponent({...})` | `componentSpace.define().xxx().registerComponent()` |
| 代码风格 | 传递单个配置对象 | 链式连缀调用 |
| TypeScript 支持 | 有一定限制 | 完整的类型推导 |
| 逻辑拆分 | 所有配置集中在一个对象中 | 连缀函数可多次调用，方便拆分 |
| 学习成本 | 较低，与小程序传统风格一致 | 略高，需要了解连缀模式 |

## Definition API

Definition API 类似于微信小程序的传统接口风格，通过 `componentSpace.defineComponent()` 传入一个包含所有配置的对象来定义组件：

```js
export const helloWorld = componentSpace.defineComponent({
  template: wxml(template),
  data: {
    hello: 'Hello world!',
  },
  methods: {
    hello() {
      console.log('hello')
      this.world()
    },
    world() {
      console.log('world')
    },
  },
})
```

在 Definition API 中，方法之间通过 `this` 相互调用。配置对象中可使用的字段如下：

| 配置字段 | 类型 | 说明 |
|---|---|---|
| `is` | `string` | 组件路径名称 |
| `behaviors` | `(string \| GeneralBehavior)[]` | 引入的 behavior 列表 |
| `using` | `{ [name: string]: string \| ComponentDefinition }` | 引用其他组件 |
| `generics` | `{ [name: string]: { default: ... } \| true }` | 泛型组件配置 |
| `placeholders` | `{ [name: string]: string }` | 占位组件配置 |
| `template` | `{ [key: string]: any } \| null` | 编译后的模板对象 |
| `externalClasses` | `string[]` | 外部样式类 |
| `data` | `TData \| (() => TData)` | 模板数据字段（对象或返回对象的函数） |
| `properties` | `TProperty` | 组件属性定义 |
| `methods` | `TMethod` | 组件方法定义 |
| `listeners` | `{ [name: string]: ComponentMethod \| string }` | 事件监听器 |
| `relations` | `{ [name: string]: RelationParams }` | 组件间关系 |
| `lifetimes` | `{ [name: string]: ComponentMethod }` | 生命周期回调 |
| `created` / `attached` / `ready` / `moved` / `detached` | `ComponentMethod` | 生命周期回调的简写形式 |
| `pageLifetimes` | `{ [name: string]: ComponentMethod }` | 页面生命周期回调 |
| `observers` | `{ [fields: string]: ComponentMethod }` | 数据监听器 |
| `options` | `ComponentOptions` | 组件选项 |

这种风格的代码比较符合传统习惯，但对 TypeScript 的支持有一定限制：由于所有配置在一个对象字面量中声明， TypeScript 难以在 `methods` 之间进行完整的类型推导。

## Chaining API（推荐）

Chaining API 通过 `componentSpace.define()` 开始，以连缀调用的形式串联各个字段，最后调用 `registerComponent()` 完成注册：

```js
export const helloWorld = componentSpace.define()
  .template(wxml(template))
  .data(() => ({
    hello: 'Hello world!',
  }))
  .init(({ method }) => {
    const hello = method(() => {
      console.log('hello')
      world()
    })
    const world = method(() => {
      console.log('world')
    })

    return {
      hello,
      world,
    }
  })
  .registerComponent()
```

Chaining API 有以下几个值得关注的特点：

- **完整的 TypeScript 类型推导**：每一步连缀调用都能正确推导出当前已声明的数据、属性和方法类型，在 `init` 函数中可获得完整的类型提示。
- **`init` 函数**：交互逻辑集中在 `init` 方法中定义。方法之间可以直接以函数变量的形式互相调用，无需通过 `this` 。

Chaining API 提供的连缀方法包括：

| 连缀方法 | 类型 | 说明 |
|---|---|---|
| `.template(template)` | `template: { [key: string]: unknown }` | 设置编译后的模板对象 |
| `.data(gen)` | `gen: () => TData` | 添加模板数据字段（接受返回数据对象的函数） |
| `.staticData(data)` | `data: TData` | 设置静态模板数据（会在组件创建时克隆） |
| `.property(name, def)` | `name: string, def: PropertyListItem<T, V>` | 添加单个属性 |
| `.methods(funcs)` | `funcs: MethodList` | 批量添加公共方法 |
| `.init(func)` | `func: (ctx: BuilderContext) => TExport` | 添加实例初始化函数 |
| `.lifetime(name, func)` | `name: keyof Lifetimes, func: Lifetimes[L]` | 添加生命周期回调 |
| `.pageLifetime(name, func)` | `name: string, func: (...args: any[]) => any` | 添加页面生命周期回调 |
| `.observer(paths, func)` | `paths: string \| string[], func: (...args) => void` | 添加数据监听器 |
| `.behavior(beh)` | `beh: string \| GeneralBehavior` | 引入一个 behavior |
| `.implement(traitBehavior, impl)` | `traitBehavior: TraitBehavior<TIn>, impl: TIn` | 实现一个 trait behavior |
| `.usingComponents(list)` | `list: Record<string, string \| ComponentDefinition>` | 引用其他组件 |
| `.placeholders(list)` | `list: Record<string, string>` | 设置占位组件 |
| `.generics(list)` | `list: Record<string, { default?: string \| ComponentDefinition } \| true>` | 设置泛型组件 |
| `.externalClasses(list)` | `list: string[]` | 设置外部样式类 |
| `.relation(name, rel)` | `name: string, rel: RelationParams` | 添加组件间关系 |
| `.definition(def)` | `def: ComponentParams` | 混入 Definition API 风格的配置对象 |
| `.options(options)` | `options: ComponentOptions` | 设置组件选项 |
| `.chainingFilter(func)` | `func: ChainingFilterFunc` | 设置连缀过滤器（用于自定义 behavior 的连缀扩展） |
| `.methodCallerInit(func)` | `func: (this: ComponentInstance) => any` | 设置方法调用者初始化函数（自定义 `this` 值） |
| `.extraThisFieldsType<T>()` | — | 声明附加的 `this` 字段类型（仅用于 TypeScript 类型辅助） |
| `.registerComponent()` | — | 完成构建并注册为组件 |
| `.registerBehavior()` | — | 完成构建并注册为 behavior |

> 📖 更多关于 `init` 函数的用法请参阅 [方法](./method.md) 文档。

## 混用 API 风格

在同一个组件内， Definition API 也可以通过 `.definition()` 混用于 Chaining API 中。这在需要复用已有的 Definition API 配置、或希望将部分配置以对象形式集中声明时非常方便：

```js
export const helloWorld = componentSpace.define()
  .definition({
    template: wxml(template),
    data: {
      hello: 'Hello world!',
    },
  })
  .init(({ method }) => {
    const hello = method(() => {
      console.log('hello')
    })

    return { hello }
  })
  .registerComponent()
```

这种混用方式让你可以灵活选择：将适合集中声明的部分（如 `template` 、 `data` ）放在 `definition` 中，将需要精细控制的逻辑（如方法、生命周期）通过连缀调用来定义。

## 如何选择

- **推荐使用 Chaining API** ：它提供完整的 TypeScript 类型推导，并且**init**函数中定义逻辑可以方便地将复杂组件的逻辑进行拆分和解耦。
- 如果你熟悉微信小程序的开发模式，或项目不使用 TypeScript ， **Definition API** 也是一个简单直接的选择。
两种风格可以在不同组件间自由切换，也可以通过 `.definition()` 在同一个组件内混用，无需在项目层面做统一约束。

> 📖 更多组件定义选项请参阅 [组件定义](./component.md) 文档。
> 📖 更多关于 behavior 的用法请参阅 [普通 Behaviors](../interaction/behavior.md) 文档。