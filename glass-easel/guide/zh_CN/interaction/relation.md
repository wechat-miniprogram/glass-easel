# 组件间关系

## 基于组件的 relations

有时会遇到一些组件相互之间存在紧密的逻辑联系，在它们作为父子节点被联合使用时，需要执行一些额外的逻辑。

例如，需要实现表单控件 `<form>` `<input>` ，而它们之间有紧密的关联逻辑。此时可以使用 relations ，使它们之间可以相互获取组件实例 `this` ：

```js
// form 组件，需要关联到子孙节点中的 input 组件
export const formComponent = componentSpace.defineComponent({
  is: 'component/form',
  relations: {
    // 需要关联到 input 组件
    './input': {
      // 关联范围是子孙节点
      type: 'descendant',
      linked(target) {
        // 每当有 input 组件插入时，这个函数会执行一次
        // 参数中的 target 是 input 组件实例
        // 使用 getRelationNodes 可以获取当前关联到的所有 input 组件
        this.getRelationNodes('./input')
      },
      unlinked(target) {
        // 每当有 input 组件移除时，这个函数会执行一次
      },
    }
  },
})

// input 组件，需要关联到祖先节点中的 form 组件
export const myComponent = componentSpace.defineComponent({
  is: 'component/input',
  relations: {
    // 需要关联到 form 组件
    './form': {
      // 关联范围是祖先节点
      type: 'ancestor',
      linked(target) {
        // 关联到 form 组件时，这个函数会执行一次
      },
      linkFailed() {
        // 没有关联到 form 组件时，这个函数会执行一次
      },
    }
  },
})

// 同时使用这两个组件
export const myComponent = componentSpace.defineComponent({
  using: {
    form: formComponent,
    input: inputComponent,
  },
  template: compileTemplate(`
    <form>
      <input />
    </form>
  `),
})
```

这样， `<form>` 和 `<input>` 可以实现更复杂的关联逻辑。

目前 relation 支持的关联范围有以下这些。

| 关联范围 | 含义 |
| ---- | ---- |
| `ancestor` | 需关联到一个祖先组件 |
| `descendant` | 可关联到若干子孙组件 |
| `parent` | 需关联到一个祖先组件，但中间不能间隔其他组件节点 |
| `child` | 可关联到若干子孙组件，但中间不能间隔其他组件节点 |
| `parent-common-node` | 需关联到一个祖先组件，但中间不能间隔其他普通节点或组件节点 |
| `child-common-node` | 可关联到若干子孙组件，但中间不能间隔其他普通节点或组件节点 |

注意：它们必须成对使用，只在一个节点上声明 `relations` 、使用不成对的关联范围都是无效的。

每个 relation 定义都包含了四个 relation 生命周期。

| relation 生命周期 | 首个参数 | 触发时机 |
| ----------------- | -------- | -------- |
| `linked` | 对应组件实例 this | 每当关联到新的组件实例 |
| `linkChanged` | 对应组件实例 this | 每当有关联到的组件实例发生了移动 |
| `unlinked` | 对应组件实例 this | 每当有关联到的组件实例被移除 |
| `linkFailed` | （无） | 当未找到需要关联的祖先组件时 |

## 基于 trait behavior 的 relations

如果建立 relations 的组件不是某个特定的组件，而是一类组件，则可以使用 behaviors 或者 trait behaviors 来规定 relations 。

例如，表单组件 `<form>` 需要关联 `<input>` `<button>` 等一类组件，可以对 `<input>` `<button>` 实现同一个 trait behavior ，这样也会有更好的 TypeScript 类型支持。这种情况下，使用 init 来实现比较好：

```ts
// 定义一个公共的 trait behavior
interface FormControlInterface {
  getName(): string
  getValue(): string
}
const FormControl = componentSpace.defineTraitBehavior<FormControlInterface>()

// 定义 form 组件
export const formComponent = componentSpace.define()
  .init(function ({ implement, relation }) {
    // 关联到所有 FormControl
    const rel = relation({
      type: 'descendant',
      target: FormControl,
      linked(target) {
        // 获得目标节点对 trait behavior 的实现
        const impl = target.traitBehavior(FormControl)
        impl.getName()
        impl.getValue()
      },
    })
    // 获取当前关联到的所有组件
    rel.list()
  })
  .registerComponent()

// 定义 input 组件
export const inputComponent = componentSpace.define()
  .init(function ({ implement, relation }) {
    // 实现 FormControl
    implement(FormControl, {
      getName() { return '...' },
      getValue() { return '...' },
    })
    // 关联到 form
    relation({
      type: 'ancestor',
      target: formComponent,
    })
  })
  .registerComponent()

// 定义 button 组件
export const buttonComponent = componentSpace.define()
  .init(function ({ implement, relation }) {
    // 实现 FormControl
    implement(FormControl, {
      getName() { return '...' },
      getValue() { return '...' },
    })
    // 关联到 form
    relation({
      type: 'ancestor',
      target: formComponent,
    })
  })
  .registerComponent()
```
