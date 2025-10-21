import type {
  GeneralBehavior,
  GeneralComponent,
  NormalizedComponentOptions,
  ShadowRoot,
  templateEngine,
} from 'glass-easel'

export class EmptyTemplateEngine implements templateEngine.Template {
  static create(behavior: GeneralBehavior, componentOptions: NormalizedComponentOptions) {
    return new EmptyTemplateEngine(componentOptions.externalComponent)
  }

  // eslint-disable-next-line no-useless-constructor
  constructor(private externalComponent: boolean) {
    //
  }

  createInstance(
    comp: GeneralComponent,
    createShadowRoot: (component: GeneralComponent) => ShadowRoot,
  ): templateEngine.TemplateInstance {
    const instance: templateEngine.TemplateInstance = {
      shadowRoot: this.externalComponent
        ? {
            root: comp.getBackendElement()!,
            slot: comp.getBackendElement()!,
            getIdMap: () => ({}),
            handleEvent: () => {
              // empty
            },
            setListener: () => {
              // empty
            },
          }
        : createShadowRoot(comp),
      initValues: (_data) => {
        // empty
      },
      updateValues: (_data, _changes) => {
        // empty
      },
    }

    return instance
  }
}
