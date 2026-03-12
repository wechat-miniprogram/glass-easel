# 组件配置

组件配置用于控制组件的各种行为。

## 组件配置列表

所有可用的组件配置选项如下：

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `externalComponent` | `boolean` | `false` | 是否为[外部组件](./external_component.md)。外部组件的 Shadow Tree 由外部后端管理，而非 glass-easel 内部模板引擎 |
| `hostNodeTagName` | `string` | `'wx-x'` | 组件宿主节点的标签名（仅在外部组件中有效） |
| `templateEngine` | `TemplateEngine \| null` | `null` | 组件使用的[模板引擎](./template_engine.md)。默认为 `null` 时使用组件空间的默认模板引擎 |
| `styleScope` | `StyleScopeId \| null` | `null` | [样式作用域](../styling/style_isolation.md)标识。用于控制组件样式的隔离范围 |
| `extraStyleScope` | `StyleScopeId \| null` | `null` | 额外的[样式作用域](../styling/style_isolation.md)。组件会同时拥有 `styleScope` 和 `extraStyleScope` 两个样式作用域 |
| `inheritStyleScope` | `boolean` | `false` | 是否继承父组件的[样式作用域](../styling/style_isolation.md) |
| `multipleSlots` | `boolean` | `false` | 是否启用[多 slot](../interaction/slot.md) 支持。启用后可使用具名 slot |
| `dynamicSlots` | `boolean` | `false` | 是否启用[动态 slot](../interaction/slot.md)。启用后允许在列表中放置 `<slot />` 并支持 slot 数据传递 |
| `reflectToAttributes` | `boolean` | `false` | 是否将组件的属性值通过 `setAttribute` 写入到后端 DOM 属性上 |
| `writeFieldsToNode` | `boolean` | `true` | 是否允许在组件实例节点上直接访问属性和方法 |
| `writeIdToDOM` | `boolean` | `false` | 是否将节点 ID 写入后端 DOM 节点 |
| `useMethodCallerListeners` | `boolean` | `false` | 是否使用 method caller 中的方法作为事件处理器 |
| `idPrefixGenerator` | `((this: Component) => string) \| null` | `null` | ID 前缀生成函数。用于为写入后端 DOM 的节点 ID 添加前缀 |
| `pureDataPattern` | `RegExp \| null` | `null` | [纯数据字段](../data_management/pure_data_pattern.md)匹配模式。匹配该正则的 data 字段不会被应用到模板渲染中 |
| `dataDeepCopy` | `DeepCopyKind` | `DeepCopyKind.Simple` | [数据更新时的深拷贝策略](../data_management/data_deep_copy.md)。可选值见下表 |
| `propertyPassingDeepCopy` | `DeepCopyKind` | `DeepCopyKind.Simple` | [属性传递时的深拷贝策略](../data_management/data_deep_copy.md)。可选值见下表 |
| `listenerChangeLifetimes` | `boolean` | `false` | 是否启用 `listenerChange` [生命周期](../basic/lifetime.md)。启用后，当组件的事件监听器被添加或移除时会触发回调 |
| `virtualHost` | `boolean` | `false` | 组件宿主节点是否为[虚拟节点](../styling/virtual_host.md)。启用后，组件不会生成真实的宿主 DOM 节点，子节点直接挂载到父级 |
| `propertyEarlyInit` | `boolean` | `false` | 是否在 `created` [生命周期](../basic/lifetime.md)之前初始化属性值。详见[属性早期初始化](../data_management/property_early_init.md) |
| `propertyComparer` | `((a, b) => boolean) \| null` | `null` | 全局属性值比较函数。返回 `true` 表示值已改变（需要更新），返回 `false` 表示值未变。默认为 `null` 时使用 `!==` 比较 |
| `unknownPropertyHandler` | `((name, value) => boolean \| void) \| null` | `null` | 未知属性处理函数。当组件收到未声明的属性时触发，可用于自定义处理逻辑。返回 `true` 表示该属性已被处理 |

## 设置组件选项

在定义组件时，可以通过 `.options()` 链式调用来设置该组件的选项：

```js
export const myComponent = componentSpace
  .define()
  .options({
    virtualHost: true,
    multipleSlots: true,
    pureDataPattern: /^_/,
  })
  .registerComponent()
```

组件自身设置的选项优先级最高，会覆盖 ComponentSpace 和 `globalOptions` 中的同名选项。

## 设置 ComponentSpace 组件选项

通过 `ComponentSpace` 的 `updateComponentOptions` 方法，可以为该组件空间中的所有组件设置默认选项：

```js
const componentSpace = new glassEasel.ComponentSpace()

// 该组件空间中所有组件都默认启用多 slot
componentSpace.updateComponentOptions({
  multipleSlots: true,
  dynamicSlots: true,
})
```

ComponentSpace 的选项优先级高于 `globalOptions` ，但低于组件自身的 `.options()` 设置。

> 📖 关于组件空间的详细说明请参阅 [组件空间](./component_space.md) 文档。

## 设置全局选项

组件配置也可以通过 `globalOptions` 设置全局默认值，所有组件都会继承这些默认值。组件自身设置的 `options` 会覆盖全局默认值：

```js
const { globalOptions, DeepCopyKind } = glassEasel

// 设置全局默认组件选项
globalOptions.multipleSlots = true
globalOptions.dynamicSlots = true
globalOptions.dataDeepCopy = DeepCopyKind.SimpleWithRecursion
globalOptions.virtualHost = true

// 单个组件可以覆盖全局默认值
const myComp = componentSpace
  .define()
  .options({
    // 即使全局启用了 virtualHost，此组件仍使用真实宿主节点
    virtualHost: false,
    // 此组件不需要深拷贝
    dataDeepCopy: DeepCopyKind.None,
  })
  .registerComponent()
```

### 环境选项

环境选项（ `EnvironmentOptions` ）仅存在于 `globalOptions` 上，用于配置全局运行环境，不能通过组件的 `.options()` 或 `ComponentSpace.updateComponentOptions()` 覆盖。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `defaultComponentSpace` | `ComponentSpace \| null` | `null` | 默认的组件空间实例 |
| `throwGlobalError` | `boolean` | `false` | 是否在捕获到错误时直接抛出异常（测试场景常用） |
| `writeExtraInfoToAttr` | `boolean` | `false` | 是否将额外调试信息写入 DOM 属性（调试用） |
| `backendContext` | `GeneralBackendContext \| null` | `null` | 默认的[渲染后端](./custom_backend.md) |
| `devTools` | `DevTools \| null` | `null` | 开发者工具接口（用于接入调试工具） |

```js
const { globalOptions } = glassEasel

globalOptions.throwGlobalError = true
globalOptions.writeExtraInfoToAttr = true
globalOptions.backendContext = myBackendContext
```

## 选项优先级

组件选项的解析遵循以下优先级（从高到低）：

1. 组件自身通过 `.options()` 设置的选项
2. 所在 `ComponentSpace` 通过 `updateComponentOptions` 设置的选项
3. `globalOptions` 中设置的全局默认值
4. 内置默认值

未在高优先级层显式设置的选项，会自动回退到低优先级层的值。
