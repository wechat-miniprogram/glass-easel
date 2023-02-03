# 组件初始化策略

组件实例初始化流程有两种：

1. 总是以自己定义的数据来初始化模板、触发 created 生命周期，然后如有必要，应用外部设置的组件属性、触发数据监听器、再更新一次模板；
2. 先在自己定义的数据的基础上，应用外部设置的组件属性、触发数据监听器，然后初始化模板、触发 created 生命周期。

前者的好处是数据监听器永远在 created 生命周期之后触发，逻辑时序比较稳定；坏处是常常需要一次额外的模板更新，性能相对较差。

glass-easel 目前以前者为默认的初始化方式，通过设置 `propertyEarlyInit` 选项可以改为后者：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    propertyEarlyInit: true,
  },
  data: {
    a: 1,
  },
  observers: {
    a() {
      // 可能早于 created 生命周期触发
    }
  },
  lifetimes: {
    created() {
      // 可能晚于 observers 触发
    },
  },
})
```
