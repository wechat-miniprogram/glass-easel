# 组件空间

## 定义组件空间

组件空间是一组组件的集合。定义组件时，需要将它定义在某个组件空间里。

```js
// 创建一个组件空间
const componentSpace = new glassEasel.ComponentSpace()

// 在这个组件空间中添加一个 hello-world 组件
export const helloWorld = componentSpace.defineComponent({
  is: 'hello-world',
})
```

在使用组件名字来指定组件时，只会在当前组件空间中查找组件，例如：

```js
componentSpace.defineComponent({
  using: {
    // 在同一个组件空间下查找名为 hello-world 的组件
    hello: 'hello-world',
  },
})
```

## 默认组件选项

组件空间可以为其中的组件指定一部分组件选项，这样，一些组件选项就不需要在每个组件定义时单独设置，例如：

```js
componentSpace.updateComponentOptions({
  multipleSlots: true,
})
```

这个组件空间中接下来定义的组件将统一具有这些选项。

## 默认组件

在组件空间中可以定义一个默认组件，当组件定义未找到时，会使用默认组件来代替。

通常，默认组件的名字是空字符串 `''` ，定义一个该名字的组件就可以将它作为默认组件：

```js
export const helloWorld = componentSpace.defineComponent({
  is: '',
})
```

## 全局引用

在实践中，可能有一些很常用的组件，在其他每个组件中都 using 引用会很繁琐。此时可以使用组件空间全局引用。例如：

```js
const hotComponent = componentSpace.defineComponent({})

componentSpace.setGlobalUsingComponent('hot', hotComponent)
```

这样相当于在所有组件中都引用了这个这个组件。

此外，可以将非组件节点也作为全局引用的目标，此时相当于给非组件节点赋予另一个名字。例如：

```js
componentSpace.setGlobalUsingComponent('hot', 'div')
```

在组件的 `usingComponents` 中也可以重新 using 全局引用、赋予另一个名字。例如：

```js
const myComponent = componentSpace.defineComponent({
  using: {
    'another-hot': 'hot',
  },
})
```

## 基组件空间

组件空间在创建时，可以导入另一个组件空间中的 **公开组件** 。例如：

```js
// 创建一个基组件空间
const baseComponentSpace = new glassEasel.ComponentSpace()

// 在基组件空间中定义一个组件
baseComponentSpace.defineComponent({
  is: 'base-component',
})

// 导出这个组件为公开组件
baseComponentSpace.exportComponent('base-component', 'base-component')

// 创建另一个组件空间，指定基组件空间
const componentSpace = new glassEasel.ComponentSpace('', baseComponentSpace)

// 可以使用基组件空间中导出的组件
componentSpace.defineComponent({
  using: {
    base: 'base-component',
  },
})
```

## 导入组件空间

组件空间中的公开组件可以被其他组件空间导入，例如：

```js
// 创建一个组件空间
const componentSpaceA = new glassEasel.ComponentSpace()

// 在基组件空间中定义一个组件
componentSpaceA.defineComponent({
  is: 'a-component',
})

// 导出这个组件，并为它命一个公开的名字
componentSpaceA.exportComponent('public-name', 'a-component')

// 创建另一个组件空间
const componentSpaceB = new glassEasel.ComponentSpace()

// 导入组件空间并指定它的引用 URL 前缀
componentSpaceB.importSpace('space://space-a', componentSpaceA, false)

// 可以使用导入的组件空间中定义的组件
componentSpaceB.defineComponent({
  using: {
    base: 'space://space-a/public-name',
  },
})
```

在导入组件空间时，也可以导入它的所有组件（不只是公开组件），例如：

```js
// 创建另一个组件空间
const componentSpaceC = new glassEasel.ComponentSpace()

// 导入组件空间中的全部组件
componentSpaceC.importSpace('space-private://space-a', componentSpaceA, true)

// 可以使用导入的组件空间中定义的组件
componentSpaceC.defineComponent({
  using: {
    base: 'space-private://space-a/a-component',
  },
})
```
