import * as glassEasel from 'glass-easel'
import { AssociatedBackend } from './backend'
import { CodeSpace } from './space'

/**
 * A mini-program API environment
 *
 * Each environment manages multiple backend contexts.
 * However, a backend context should be exclusively managed by a single environment
 * (to avoid `StyleScopeId` confliction).
 * It is able to create multiple `CodeSpace` within the environment.
 */
export class MiniProgramEnv {
  private codeSpaceMap: { [id: string]: CodeSpace }
  private globalCodeSpace: CodeSpace

  /**
   * Create an empty mini-program API environment
   */
  constructor() {
    this.codeSpaceMap = Object.create(null) as { [id: string]: CodeSpace }
    this.globalCodeSpace = new CodeSpace(this, false, {})
  }

  /**
   * Get a global code space in which global components can be defined
   *
   * External glass-easel based components can be defined in this code space.
   * All global components should be defined before any other `CodeSpace` created!
   */
  getGlobalCodeSpace(): CodeSpace {
    return this.globalCodeSpace
  }

  /**
   * Associate a backend context
   *
   * If `backendContext` is not given, the DOM-based backend is used
   * (causes failure if running outside browsers).
   * The backend context SHOULD NOT be associated by other environments!
   */
  associateBackend(backendContent?: glassEasel.GeneralBackendContext): AssociatedBackend {
    const ctx = backendContent ?? new glassEasel.CurrentWindowBackendContext()
    return new AssociatedBackend(this, ctx)
  }

  /**
   * Create a component space that can manage WXML, WXSS, JS and static JSON config files
   *
   * The space can be specified as a *main* space.
   * This makes some features available:
   * * the `app.wxss` will be used as a style sheet for all root components in the space;
   * * the `StyleIsolation.Shared` is accepted for components in the space.
   * Non-main spaces usually act as plugins.
   * `publicComponents` is a map for specifying a map of aliases and component paths.
   */
  createCodeSpace(
    id: string,
    isMainSpace: boolean,
    publicComponents = Object.create(null) as { [alias: string]: string },
  ): CodeSpace {
    const cs = new CodeSpace(this, isMainSpace, publicComponents, this.globalCodeSpace)
    this.codeSpaceMap[id] = cs
    return cs
  }

  /**
   * Get a component space by the `id` specified when created
   */
  getCodeSpace(id: string): CodeSpace | undefined {
    return this.codeSpaceMap[id]
  }
}
