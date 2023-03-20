# 组件构造器中间件

## Definition Filter

在定义组件时， glass-easel 允许一些简易的中间件来调整组件定义。

对于 definition API ，可以使用 `definitionFilter` 。例如，可以定义一个中间件，用来检查是否有属性没有定义初始值：

```js
export const propCheck = componentSpace.defineBehavior({
  definitionFilter(def) {
    // def 是定义组件时传入的组件定义对象
    if (def.properties) {
      Object.keys(def.properties).forEach((propName) => {
        const prop = def.properties[propName]
        if (prop.value === undefined) {
          console.warn(`Forget property initial value of "${propName}"`)
        }
      })
    }
  }
})
```

中间件表现为一个 behavior 的形式。在组件中引用这个 behavior 时，中间件会被自动触发，例如：

```js
export const myComponent = componentSpace.defineComponent({
  // 引入含有 definitionFilter 的 behavior
  behaviors: [propCheck],
  properties: {
    a: {
      type: String,
    },
  },
})
```

## Chaining Filter

对于 Chaining API ，可以使用 `chainingFilter` 。它允许修改链式调用中的调用链函数。例如：

```js
export const propCheck = componentSpace.define()
  .chainingFilter((chain) => {
    return Object.create(chain, {
      property: {
        value(propName, prop) {
          if (prop.value === undefined) {
            console.warn(`Forget property initial value of "${propName}"`)
          }
          chain.property(propName, prop)
        }
      },
    })
  })
  .registerBehavior()
```

使用这个 behavior 时，要在链式调用靠前的地方引用：

```js
export const myComponent = componentSpace.define()
  // 引入含有 chainingFilter 的 behavior
  .behavior(propCheck)
  .property('a', {
    type: String,
  })
  .registerComponent()
```
