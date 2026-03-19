# 组件空间

组件空间（`ComponentSpace`）是 glass-easel 中管理组件和 Behavior 注册的核心容器。它负责组件定义的存储与查找、组件选项的统一配置、全局引用管理，以及跨空间的组件导入导出。

> 📖 关于 `ComponentSpace` 的完整 API 列表请参阅 [其他常用 API — ComponentSpace](../api/other.md#componentspace) 。

## 定义组件空间

组件空间是一组组件的集合。定义组件时，需要将它定义在某个组件空间里。每个组件只属于一个组件空间，通过组件名字查找组件时，也只会在当前组件空间中查找。

```js
// 创建一个组件空间
const componentSpace = new glassEasel.ComponentSpace()

// 在这个组件空间中添加一个 hello-world 组件
export const helloWorld = componentSpace.define('hello-world')
  .registerComponent()
```

在使用组件名字来指定组件时，只会在当前组件空间中查找组件，例如：

```js
componentSpace.define()
  .usingComponents({
    // 在同一个组件空间下查找名为 hello-world 的组件
    hello: 'hello-world',
  })
  .registerComponent()
```

如果不想自行创建组件空间，也可以使用 glass-easel 提供的全局默认组件空间：

```js
// 获取默认组件空间（首次调用时自动创建）
const defaultSpace = glassEasel.getDefaultComponentSpace()
```

## 默认组件选项

组件空间可以为其中的组件指定一部分默认组件选项。这样，一些通用的组件选项就不需要在每个组件定义时单独设置，例如：

```js
componentSpace.updateComponentOptions({
  multipleSlots: true,
  dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
})
```

调用 `updateComponentOptions` 会将新选项与已有选项**合并**（而非替换），因此可以多次调用来逐步配置。这个组件空间中接下来定义的组件将统一具有这些选项。

组件自身也可以通过 `.options()` 覆盖组件空间的默认选项。组件级选项的优先级高于组件空间的默认选项。

> 📖 关于组件选项以及所有可用选项的完整列表和说明，请参阅 [组件配置](../advanced/component_options.md) 文档。

## 默认组件

在组件空间中可以定义一个**默认组件**。当通过组件名字查找组件但未找到对应定义时，会使用默认组件来代替，并输出一条警告信息。

默认组件的名字在创建组件空间时通过构造函数的第一个参数指定（默认值为空字符串 `''`），然后定义一个该名字的组件即可：

```js
// 创建组件空间时指定默认组件路径（默认为 ''）
const componentSpace = new glassEasel.ComponentSpace('fallback')

// 定义名为 'fallback' 的组件作为默认组件
componentSpace.define('fallback')
  .template(wxml(`<div>Component not found</div>`))
  .registerComponent()
```

如果使用默认的空字符串路径，可以简写为：

```js
export const defaultComp = componentSpace.define('')
  .registerComponent()
```

> ⚠️ 如果组件空间中没有定义默认组件，且查找到了不存在的组件名字，会抛出错误。建议始终定义一个默认组件作为兜底。

## 全局引用

在实践中，可能有一些很常用的组件需要在多处使用。如果在每个组件中都通过 `usingComponents` 逐一引用，会非常繁琐。此时可以使用组件空间的**全局引用**功能：

```js
// 定义一个常用组件
const hotComponent = componentSpace.define('hot-comp')
  .registerComponent()

// 将它设置为全局引用
componentSpace.setGlobalUsingComponent('hot', hotComponent)
```

设置全局引用后，该组件空间中的所有组件都可以直接在模板中使用 `<hot />` 标签，无需再在 `usingComponents` 中声明。

此外，全局引用的目标也可以是**非组件节点**（原生节点），此时相当于给原生节点赋予一个别名。例如：

```js
// 将原生 div 节点注册为全局引用
componentSpace.setGlobalUsingComponent('my-div', 'div')
```

在组件的 `usingComponents` 中也可以进一步给全局引用赋予另一个本地名字。例如：

```js
const myComponent = componentSpace.define()
  .usingComponents({
    'another-hot': 'hot',
  })
  .registerComponent()
```

## 基组件空间

组件空间在创建时，可以指定一个**基组件空间**（`baseSpace`）。基组件空间中所有已导出的**公开组件**和**公开 Behavior** 会在创建时被一次性导入到新的组件空间中。

```js
// 创建一个基组件空间
const baseComponentSpace = new glassEasel.ComponentSpace()

// 在基组件空间中定义一个组件
baseComponentSpace.define('base-component')
  .registerComponent()

// 导出这个组件为公开组件
baseComponentSpace.exportComponent('base-component', 'base-component')

// 创建另一个组件空间，指定基组件空间
const componentSpace = new glassEasel.ComponentSpace('', baseComponentSpace)

// 可以直接使用基组件空间中导出的组件（无需 URL 前缀）
componentSpace.define()
  .usingComponents({
    base: 'base-component',
  })
  .registerComponent()
```

与导入组件空间（`importSpace`）不同，基组件空间中的公开组件可以直接通过名字使用，不需要加 URL 前缀。此外，新创建的组件空间也会继承基组件空间的默认组件选项。

> ⚠️ 基组件空间的导入是创建时的**一次性快照**，之后往基组件空间中新增的组件不会自动同步到已创建的组件空间。

## 导入组件空间

除了通过基组件空间来继承组件外，还可以通过 `importSpace` 导入其他组件空间。导入时需要指定一个 URL 形式的**域名前缀**（`protoDomain`），使用被导入空间中的组件时，必须带上该前缀。

### 导入公开组件

当 `privateUse` 参数为 `false` 时，只能使用被导入空间中已通过 `exportComponent` 导出的公开组件：

```js
// 创建一个组件空间
const componentSpaceA = new glassEasel.ComponentSpace()

// 定义并注册一个组件
componentSpaceA.define('a-component')
  .registerComponent()

// 导出这个组件，并为它指定一个公开别名
componentSpaceA.exportComponent('public-name', 'a-component')

// 创建另一个组件空间
const componentSpaceB = new glassEasel.ComponentSpace()

// 导入组件空间并指定它的引用 URL 前缀
componentSpaceB.importSpace('space://space-a', componentSpaceA, false)

// 使用时必须通过 URL 前缀 + 公开别名 来引用
componentSpaceB.define()
  .usingComponents({
    base: 'space://space-a/public-name',
  })
  .registerComponent()
```

### 导入全部组件

当 `privateUse` 参数为 `true` 时，可以直接使用被导入空间中的**所有组件**（包括未导出的），此时通过组件的原始名字（即 `is`）来引用：

```js
// 创建另一个组件空间
const componentSpaceC = new glassEasel.ComponentSpace()

// 导入组件空间中的全部组件
componentSpaceC.importSpace('space-private://space-a', componentSpaceA, true)

// 使用时通过 URL 前缀 + 组件原始名字 来引用
componentSpaceC.define()
  .usingComponents({
    base: 'space-private://space-a/a-component',
  })
  .registerComponent()
```
