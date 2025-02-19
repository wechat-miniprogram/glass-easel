import { Behavior, type GeneralBehavior } from './behavior'
import { ComponentDefinition, type GeneralComponent } from './component'
import { type RelationParams, type TraitRelationParams } from './component_params'
import { type ComponentSpace } from './component_space'
import { type Element } from './element'
import { safeCallback } from './func_arr'
import { TraitBehavior } from './trait_behaviors'
import { isComponent, isElement, isVirtualNode } from './type_symbol'
import { triggerWarning } from './warning'

export const enum RelationType {
  Ancestor = 0,
  Descendant,
  ParentNonVirtualNode,
  ChildNonVirtualNode,
  ParentComponent,
  ChildComponent,
}

const RELATION_TYPE_COUNT = 6

export const normalizeRelation = <TOut extends { [key: string]: any }>(
  ownerSpace: ComponentSpace,
  is: string,
  key: string,
  relation: RelationParams | TraitRelationParams<TOut>,
): RelationDefinition | null => {
  const checkRelationFunc = (f: unknown): RelationListener | null => {
    if (typeof f === 'function') {
      return f as RelationListener
    }
    if (f !== undefined) {
      triggerWarning(
        `the "${key}" relation listener is not a function (when preparing behavior "${is}").`,
      )
    }
    return null
  }
  let type: RelationType
  if (relation.type === 'parent') {
    type = RelationType.ParentComponent
  } else if (relation.type === 'child') {
    type = RelationType.ChildComponent
  } else if (relation.type === 'parent-common-node') {
    type = RelationType.ParentNonVirtualNode
  } else if (relation.type === 'child-common-node') {
    type = RelationType.ChildNonVirtualNode
  } else if (relation.type === 'ancestor') {
    type = RelationType.Ancestor
  } else if (relation.type === 'descendant') {
    type = RelationType.Descendant
  } else {
    const type = relation.type as string
    triggerWarning(
      `the "${key}" relation has an invalid relation type "${type}" (when preparing behavior "${is}").`,
    )
    return null
  }
  let target:
    | GeneralBehavior
    | TraitBehavior<{ [key: string]: unknown }, { [key: string]: unknown }>
    | null = null
  if (relation.target instanceof ComponentDefinition) {
    target = relation.target.behavior as GeneralBehavior
  } else if (relation.target instanceof Behavior || relation.target instanceof TraitBehavior) {
    target = relation.target
  } else {
    const path = String(relation.target || key)
    const usingTarget = ownerSpace.getComponentByUrlWithoutDefault(path, is)
    if (usingTarget) {
      target = usingTarget.behavior
    } else {
      const globalTarget = ownerSpace.getGlobalUsingComponent(path)
      if (typeof globalTarget === 'object' && globalTarget !== null) {
        target = globalTarget.behavior
      }
    }
  }
  if (!target) {
    triggerWarning(
      `the target of relation "${key}" is not a valid behavior or component (when preparing behavior "${is}").`,
    )
    return null
  }
  return {
    target,
    type,
    linked: checkRelationFunc(relation.linked),
    linkChanged: checkRelationFunc(relation.linkChanged),
    unlinked: checkRelationFunc(relation.unlinked),
    linkFailed: checkRelationFunc(relation.linkFailed) as RelationFailedListener,
  }
}

export interface RelationHandler<TTarget, TOut> {
  list(): TTarget[]
  listAsTrait: TOut extends never ? undefined : () => TOut[]
}

export interface RelationInit {
  (def: RelationParams): RelationHandler<any, never>
  <TOut extends { [key: string]: any }>(def: TraitRelationParams<TOut>): RelationHandler<
    unknown,
    TOut
  >
}

export type RelationListener = (target: unknown) => void

export type RelationFailedListener = () => void

export type RelationDefinition = {
  target: GeneralBehavior | TraitBehavior<{ [x: string]: unknown }, { [x: string]: unknown }>
  type: RelationType
  linked: RelationListener | null
  linkChanged: RelationListener | null
  unlinked: RelationListener | null
  linkFailed: RelationFailedListener | null
}

export type RelationDefinitionGroup = {
  definitions: RelationDefinition[][]
  keyMap: { [key: string | symbol]: [RelationType, number] }
}

export const generateRelationDefinitionGroup = (relations?: {
  [key: string]: RelationDefinition
}): RelationDefinitionGroup | null => {
  if (relations === undefined) return null
  const group = {
    definitions: new Array(RELATION_TYPE_COUNT) as RelationDefinition[][],
    keyMap: Object.create(null) as { [key: string]: [RelationType, number] },
  } as RelationDefinitionGroup
  const defs = group.definitions
  const keyMap = group.keyMap
  const keys = Object.keys(relations)
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]!
    const relation = relations[key]!
    const relationType = relation.type
    if (defs[relationType]) {
      keyMap[key] = [relationType, defs[relationType].length]
      defs[relationType].push(relation)
    } else {
      keyMap[key] = [relationType, 0]
      defs[relationType] = [relation]
    }
  }
  return group
}

export const cloneRelationDefinitionGroup = (
  group: RelationDefinitionGroup,
): RelationDefinitionGroup => {
  const newGroup = {
    definitions: group.definitions.slice(),
    keyMap: Object.assign(Object.create(null), group.keyMap) as {
      [key: string]: [RelationType, number]
    },
  }
  return newGroup
}

export class Relation {
  private _$comp: GeneralComponent
  private _$group: RelationDefinitionGroup | null
  private _$sharedGroup: boolean
  private _$links: ({ target: GeneralComponent; def: RelationDefinition } | null)[][]

  constructor(associatedComponent: GeneralComponent, group: RelationDefinitionGroup | null) {
    this._$comp = associatedComponent
    const links = new Array(RELATION_TYPE_COUNT) as ({
      target: GeneralComponent
      def: RelationDefinition
    } | null)[][]
    if (group) {
      for (let type = 0; type < RELATION_TYPE_COUNT; type += 1) {
        const definitions = group.definitions[type]
        if (definitions) {
          const link = new Array(definitions.length) as ({
            target: GeneralComponent
            def: RelationDefinition
          } | null)[]
          for (let i = 0; i < definitions.length; i += 1) {
            link[i] = null
          }
          links[type] = link
        }
      }
    }
    this._$group = group
    this._$sharedGroup = true
    this._$links = links
  }

  add(relation: RelationDefinition): symbol {
    if (this._$sharedGroup) {
      this._$sharedGroup = false
      const group = this._$group
      if (group) {
        this._$group = {
          definitions: group.definitions.slice(),
          keyMap: Object.assign(Object.create(null), group.keyMap) as {
            [key: string]: [RelationType, number]
          },
        }
      } else {
        this._$group = {
          definitions: new Array(RELATION_TYPE_COUNT) as RelationDefinition[][],
          keyMap: Object.create(null) as { [key: string]: [RelationType, number] },
        }
      }
    }
    const key = Symbol('')
    const defs = this._$group!.definitions
    const keyMap = this._$group!.keyMap
    const relationType = relation.type
    if (defs[relationType]) {
      keyMap[key] = [relationType, defs[relationType].length]
      defs[relationType].push(relation)
    } else {
      keyMap[key] = [relationType, 0]
      defs[relationType] = [relation]
    }
    const linksGroup = this._$links
    if (linksGroup[relationType] === undefined) {
      linksGroup[relationType] = [null]
    } else {
      linksGroup[relationType].push(null)
    }
    return key
  }

  triggerLinkEvent(
    parentType:
      | RelationType.ParentComponent
      | RelationType.ParentNonVirtualNode
      | RelationType.Ancestor,
    isDetach: boolean,
  ) {
    const comp = this._$comp
    const linksGroup = this._$links
    const selfDefs = this._$group?.definitions[parentType]
    if (!selfDefs) return
    for (let i = 0; i < selfDefs.length; i += 1) {
      const links = linksGroup[parentType]!
      const oldLink = links[i]!
      let newLink: { target: GeneralComponent; def: RelationDefinition } | null = null
      const def = selfDefs[i]!
      const parentBehavior = def.target
      if (!isDetach) {
        let cur: Element = comp
        for (;;) {
          const next = cur.parentNode
          if (!next) break
          cur = next
          if (isVirtualNode(cur)) {
            continue
          }
          if (isComponent(cur)) {
            if (cur.hasBehavior(parentBehavior)) {
              const parentRelation = cur._$relation
              if (parentRelation) {
                let rt
                if (parentType === RelationType.ParentComponent) {
                  rt = RelationType.ChildComponent
                } else if (parentType === RelationType.Ancestor) {
                  rt = RelationType.Descendant
                } else {
                  rt = RelationType.ChildNonVirtualNode
                }
                const parentDefs = parentRelation._$group?.definitions[rt]
                if (parentDefs) {
                  for (let j = 0; j < parentDefs.length; j += 1) {
                    const def = parentDefs[j]!
                    if (def.target && this._$comp.hasBehavior(def.target)) {
                      newLink = {
                        target: cur,
                        def,
                      }
                      break
                    }
                  }
                  if (newLink) break
                }
              }
            }
            if (parentType === RelationType.ParentComponent) break
          }
          if (parentType === RelationType.ParentNonVirtualNode) break
        }
      }
      links[i] = newLink
      if (oldLink) {
        const oldTarget = oldLink.target
        const oldDef = oldLink.def
        if (!newLink || oldLink.target !== newLink.target || oldLink.def !== newLink.def) {
          if (oldDef.unlinked) {
            safeCallback(
              'Relation Unlinked Callback',
              oldDef.unlinked,
              oldTarget.getMethodCaller(),
              [comp.getMethodCaller()],
              oldTarget,
            )
          }
          if (def.unlinked) {
            safeCallback(
              'Relation Unlinked Callback',
              def.unlinked,
              comp.getMethodCaller(),
              [oldTarget.getMethodCaller()],
              comp,
            )
          }
        } else {
          if (oldDef.linkChanged) {
            safeCallback(
              'Relation Link Changed Callback',
              oldDef.linkChanged,
              oldTarget.getMethodCaller(),
              [comp.getMethodCaller()],
              oldTarget,
            )
          }
          if (def.linkChanged) {
            safeCallback(
              'Relation Link Changed Callback',
              def.linkChanged,
              comp.getMethodCaller(),
              [oldTarget.getMethodCaller()],
              comp,
            )
          }
        }
      }
      if (newLink) {
        const newTarget = newLink.target
        const newDef = newLink.def
        if (!oldLink || oldLink.target !== newLink.target || oldLink.def !== newLink.def) {
          if (newDef.linked) {
            safeCallback(
              'Relation Linked Callback',
              newDef.linked,
              newTarget.getMethodCaller(),
              [comp.getMethodCaller()],
              newTarget,
            )
          }
          if (def.linked) {
            safeCallback(
              'Relation Linked Callback',
              def.linked,
              comp.getMethodCaller(),
              [newTarget.getMethodCaller()],
              comp,
            )
          }
        }
      }
      if (!isDetach && !newLink && def.linkFailed) {
        safeCallback(
          'Relation Link Failed Callback',
          def.linkFailed,
          comp.getMethodCaller(),
          [],
          comp,
        )
      }
    }
  }

  getLinkedTargets(key: string | symbol): GeneralComponent[] {
    const typeWithIndex = this._$group?.keyMap[key]
    if (!typeWithIndex) {
      triggerWarning(`no relation "${String(key)}" found.`)
      return []
    }
    const [type, index] = typeWithIndex
    if (
      type === RelationType.ParentComponent ||
      type === RelationType.ParentNonVirtualNode ||
      type === RelationType.Ancestor
    ) {
      const link = this._$links[type]?.[index]
      if (link) return [link.target]
      return []
    }
    const ret: GeneralComponent[] = []
    const comp = this._$comp
    const def = this._$group?.definitions[type]?.[index]
    const dfs = (node: Element) => {
      const children = node.childNodes
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]!
        if (!isElement(child)) continue
        if (isVirtualNode(child)) {
          dfs(child)
          continue
        }
        if (isComponent(child)) {
          if (child._$relation) {
            let links
            if (type === RelationType.ChildComponent) {
              links = child._$relation._$links[RelationType.ParentComponent]
            } else if (type === RelationType.Descendant) {
              links = child._$relation._$links[RelationType.Ancestor]
            } else {
              links = child._$relation._$links[RelationType.ParentNonVirtualNode]
            }
            if (links) {
              for (let i = 0; i < links.length; i += 1) {
                const link = links[i]!
                if (link && link.target === comp && link.def === def) {
                  ret.push(child)
                  break
                }
              }
            }
          }
          if (type === RelationType.Descendant) dfs(child)
        } else {
          if (type === RelationType.ChildComponent || type === RelationType.Descendant) dfs(child)
        }
      }
    }
    dfs(this._$comp)
    return ret
  }
}
