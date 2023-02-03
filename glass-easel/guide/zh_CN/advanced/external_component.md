# 外部组件

## 使用外部组件来提升性能

有些时候，出于性能或一些特殊原因，可以使一个组件内部的实现不通过 Shadow Tree 维护，而是直接通过 DOM 接口或 [自定义后端](custom_backend.md) 接口来维护。

在组件中添加 `externalComponent` 选项，就可以使它成为一个外部组件，例如：

```js
componentSpace.defineComponent({
  options: {
    externalComponent: true,
  },
})
```

这种模式下的组件通常具有很好的性能，但部分特性不可用：

* 模板中的 `wx:if` `wx:for` 不可用，仅支持 [虚拟树更新](binding_map_update.md) ；
* 由于没有 Shadow Tree ，所有与之相关的树遍历方式（如选择器查询）都不能访问到组件内的节点；
* 大部分 DOM 未提供的对应特性不可用，如外部样式类、复杂事件监听器等。

## 外部组件与自定义模板引擎

外部组件也可以与 [自定义模板引擎](template_engine.md) 一起使用，这样就可以使得部分 DOM 节点完全脱离 glass-easel 的维护。当需要其他第三方框架来维护部分 DOM 节点时，这个方式很实用。

此时，自定义模板引擎在实现 `TemplateInstance` 接口时，返回的 `shadowRoot` 必须是 `glassEasel.ExternalShadowRoot` 类型的，例如：

```js
class MyTemplateEngine {
  create(rootBehavior, options) {
    behavior.getTemplate() // 组件的 template 字段内容
    // 检测组件是不是被定义为外部组件
    if (!options.externalComponent) {
      throw new Error('The template engine can only be used in external component')
    }
    return new MyTemplate()
  }
}

class MyTemplate {
  createInstance(component) {
    return new MyTemplateInstance(component)
  }
}

class MyTemplateInstance {
  constructor(component) {
    // 以外部组件形式使用
    this.shadowRoot = {
      root: document.body, // 用作 shadowRoot 的节点
      slot: document.createElement('span'), // 用作 slot 的节点
      getIdMap() {
        // 返回节点 id 到节点的映射表
      },
      handleEvent(target, event) {
        // 触发一个事件
      },
      setListener(element, event, listener) {
        // 添加一个事件监听器
      },
    }
  }

  initValues(data) {
    // 组件被创建，初始数据是 data
  }

  updateValues(data, changes) {
    // 组件更新，新的数据是 data ，变更内容描述在 changes 中
  }
}
```
