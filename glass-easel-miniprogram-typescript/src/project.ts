import path from 'node:path'
import type * as ts from 'typescript'
import type { TmplGroup as CompilerTmplGroup } from 'glass-easel-template-compiler'
import { VirtualFileSystem } from './virtual_fs'

export interface TmplGroup {
  free: CompilerTmplGroup['free']
  addTmpl: CompilerTmplGroup['addTmpl']
  getTmplConvertedExpr: (
    path: string,
    tsEnv: string,
  ) => Promise<TmplConvertedExpr> | TmplConvertedExpr
}

export interface TmplConvertedExpr {
  free(): void
  code(): string | undefined
  getSourceLocation: (
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
  ) =>
    | Promise<[number, number, number, number] | Uint32Array | undefined>
    | [number, number, number, number]
    | Uint32Array
    | undefined
  getTokenAtSourcePosition: (
    line: number,
    col: number,
  ) =>
    | Promise<[number, number, number, number, number, number] | Uint32Array | undefined>
    | [number, number, number, number, number, number]
    | Uint32Array
    | undefined
}

export type Position = {
  line: number
  character: number
}

export type PositionRange = {
  start: Position
  end: Position
}

type ComponentJsonData = {
  jsonFileVersion: number
  usingComponents: Record<string, string>
  placeholders: Record<string, string>
  generics: string[]
  // IDEA support generics by special type declaration
}

const parseCompJson = (
  projectRootPath: string,
  fullPath: string,
  json: string,
  jsonFileVersion: number,
): ComponentJsonData | null => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed = JSON.parse(json)
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (parsed.component === true || typeof parsed.usingComponents === 'object')
  ) {
    const isValidKey = (key: string): boolean => /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(key)
    const ret: ComponentJsonData = {
      jsonFileVersion,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      usingComponents: Object.create(null),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      placeholders: Object.create(null),
      generics: [],
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Object.keys(parsed.usingComponents ?? 0).forEach((key) => {
      if (!isValidKey(key)) return
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const p = String(parsed.usingComponents[key])
      const basePath = p.startsWith('/') ? projectRootPath : path.dirname(fullPath)
      const resolvedPath = path.join(basePath, ...p.split('/'))
      ret.usingComponents[key] = resolvedPath
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Object.keys(parsed.placeholders ?? 0).forEach((key) => {
      if (!isValidKey(key)) return
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ret.placeholders[key] = String(parsed.placeholders[key])
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Object.keys(parsed.generics ?? 0).forEach((key) => {
      if (!isValidKey(key)) return
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ret.generics.push(String(parsed.generics[key]))
    })
    return ret
  }
  return null
}

const isWxmlFile = (fullPath: string): boolean => path.extname(fullPath) === '.wxml'

const isJsonFile = (fullPath: string): boolean => path.extname(fullPath) === '.json'

const isTsFile = (fullPath: string): boolean => path.extname(fullPath) === '.ts'

const possibleComponentPath = (fullPath: string): string | null => {
  const ext = path.extname(fullPath)
  const isComp = ext === '.wxml' || ext === '.json' || ext === '.ts'
  return isComp ? fullPath.slice(0, -ext.length) : null
}

export const getWxmlConvertedTsPath = (fullPath: string): string | null => {
  if (!isWxmlFile(fullPath)) return null
  return `${fullPath}.INLINE.ts`
}

export const getWxmlTsPathReverted = (fullPath: string): string | null => {
  if (!fullPath.endsWith('.wxml.INLINE.ts')) return null
  const p = fullPath.slice(0, -10)
  return p
}

type ConvertedExprCache = {
  expr?: TmplConvertedExpr
  source?: ts.SourceFile
  version: number
}

export class ProjectDirManager {
  readonly vfs: VirtualFileSystem
  private tsc: typeof ts
  private tmplGroup: TmplGroup
  private readonly rootPath: string
  private trackingComponents = Object.create(null) as Record<string, ComponentJsonData>
  private convertedExpr = Object.create(null) as Record<string, ConvertedExprCache>
  private pendingAsyncTasks = 0
  wxmlEnvGetter: (tsFullPath: string, wxmlFullPath: string) => string | null = () => null
  onEntranceFileAdded: (fullPath: string) => void = () => {}
  onEntranceFileRemoved: (fullPath: string) => void = () => {}
  onConvertedExprCacheUpdated: (wxmlFullPath: string) => void = () => {}
  onPendingAsyncTasksEmpty: () => void = () => {}

  constructor(
    tsc: typeof ts,
    tmplGroup: TmplGroup,
    rootPath: string,
    firstScanCallback: () => void,
  ) {
    this.tsc = tsc
    this.tmplGroup = tmplGroup
    this.rootPath = rootPath
    this.vfs = new VirtualFileSystem(rootPath, firstScanCallback)
    this.vfs.onFileFound = (fullPath) => {
      this.handleFileOpened(fullPath)
    }
    this.vfs.onTrackedFileUpdated = (fullPath) => {
      this.handleFileUpdated(fullPath)
    }
    this.vfs.onTrackedFileRemoved = (fullPath) => {
      this.handleFileRemoved(fullPath)
    }
  }

  stop() {
    Object.values(this.convertedExpr).forEach((ce) => ce.expr?.free())
    this.tmplGroup.free()
    return this.vfs.stop()
  }

  pendingAsyncTasksCount() {
    return this.pendingAsyncTasks
  }

  private handleFileOpened(fullPath: string) {
    const compPath = possibleComponentPath(fullPath)
    if (compPath !== null) {
      if (isJsonFile(fullPath)) {
        const isComp = !!this.trackingComponents[compPath]
        const newIsComp = this.updateComponentJsonData(fullPath) !== null
        if (!isComp && newIsComp) {
          this.asyncWxmlConvertedExprUpdate(`${compPath}.wxml`)
          this.onEntranceFileAdded(`${compPath}.wxml`)
        }
      }
    }
  }

  private handleFileUpdated(fullPath: string) {
    const compPath = possibleComponentPath(fullPath)
    if (compPath !== null) {
      if (isJsonFile(fullPath)) {
        const isComp = !!this.trackingComponents[compPath]
        const newIsComp = this.updateComponentJsonData(fullPath) !== null
        if (newIsComp) {
          this.asyncWxmlConvertedExprUpdate(`${compPath}.wxml`)
          if (!isComp) {
            this.onEntranceFileAdded(`${compPath}.wxml`)
          }
        } else if (isComp) {
          this.deleteConvertedExprCache(`${compPath}.wxml`)
          this.onEntranceFileRemoved(`${compPath}.wxml`)
        }
      } else if (isTsFile(fullPath)) {
        this.checkConvertedExprCache(`${compPath}.wxml`)
        this.forEachDirectDependantComponents(compPath, (compPath) => {
          this.checkConvertedExprCache(`${compPath}.wxml`)
        })
      } else {
        this.checkConvertedExprCache(fullPath)
      }
    }
  }

  private handleFileRemoved(fullPath: string) {
    const compPath = possibleComponentPath(fullPath)
    if (compPath !== null) {
      if (isJsonFile(fullPath)) {
        const isComp = !!this.trackingComponents[compPath]
        if (isComp) {
          this.deleteConvertedExprCache(`${compPath}.wxml`)
          this.onEntranceFileRemoved(`${compPath}.wxml`)
        }
      } else if (isTsFile(fullPath)) {
        this.checkConvertedExprCache(`${compPath}.wxml`)
        this.forEachDirectDependantComponents(compPath, (compPath) => {
          this.checkConvertedExprCache(`${compPath}.wxml`)
        })
      } else {
        this.deleteConvertedExprCache(fullPath)
      }
    }
  }

  getFileContent(fullPath: string): string | null {
    return this.vfs.trackFile(fullPath)
  }

  private checkConvertedExprCache(fullPath: string) {
    if (!isWxmlFile(fullPath)) return
    if (this.trackingComponents[fullPath.slice(0, -5)]) {
      this.asyncWxmlConvertedExprUpdate(fullPath)
    } else {
      this.deleteConvertedExprCache(fullPath)
    }
  }

  private deleteConvertedExprCache(fullPath: string) {
    const ce = this.convertedExpr[fullPath]
    if (ce && ce.expr) {
      ce.expr?.free()
      ce.expr = undefined
      ce.source = undefined
      ce.version += 1
      this.onConvertedExprCacheUpdated(fullPath)
    }
  }

  private asyncWxmlConvertedExprUpdate(wxmlFullPath: string) {
    const compPath = wxmlFullPath.slice(0, -5)
    const tsFullPath = `${compPath}.ts`
    let cache = this.convertedExpr[wxmlFullPath]
    if (!cache) {
      cache = {
        expr: undefined,
        source: undefined,
        version: 1,
      }
      this.convertedExpr[wxmlFullPath] = cache
    }
    const content = this.getFileContent(wxmlFullPath)
    if (!content) return
    const relPath = path.relative(this.vfs.rootPath, wxmlFullPath).split(path.sep).join('/')
    if (relPath.startsWith('../')) return
    this.tmplGroup.addTmpl(relPath, content)
    const env = this.wxmlEnvGetter(tsFullPath, wxmlFullPath)
    if (!env) return
    this.pendingAsyncTasks += 1
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const expr = await this.tmplGroup.getTmplConvertedExpr(relPath, env)
        cache.expr = expr
        cache.source = this.tsc.createSourceFile(
          wxmlFullPath,
          content,
          this.tsc.ScriptTarget.Latest,
        )
        cache.version += 1
      } finally {
        this.pendingAsyncTasks -= 1
        if (this.pendingAsyncTasks === 0) {
          this.onPendingAsyncTasksEmpty()
        }
      }
      this.onConvertedExprCacheUpdated(wxmlFullPath)
    })()
  }

  async getTokenInfoAtPosition(
    wxmlFullPath: string,
    pos: Position,
  ): Promise<{ sourceStart: Position; sourceEnd: Position; dest: Position } | null> {
    const arr = await this.convertedExpr[wxmlFullPath]?.expr?.getTokenAtSourcePosition(
      pos.line,
      pos.character,
    )
    if (!arr) return null
    return {
      sourceStart: { line: arr[0], character: arr[1] },
      sourceEnd: { line: arr[2], character: arr[3] },
      dest: { line: arr[4], character: arr[5] },
    }
  }

  async getWxmlSource(
    wxmlFullPath: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
  ): Promise<{
    source: ts.SourceFile
    startLine: number
    startCol: number
    endLine: number
    endCol: number
  } | null> {
    const arr = await this.convertedExpr[wxmlFullPath]?.expr?.getSourceLocation(
      startLine,
      startCol,
      endLine,
      endCol,
    )
    if (!arr) return null
    return {
      source: this.convertedExpr[wxmlFullPath]!.source!,
      startLine: arr[0],
      startCol: arr[1],
      endLine: arr[2],
      endCol: arr[3],
    }
  }

  getFileTsContent(fullPath: string): string | null {
    const p = getWxmlTsPathReverted(fullPath)
    if (p !== null) {
      return this.convertedExpr[p]?.expr?.code() ?? ''
    }
    return this.getFileContent(fullPath)
  }

  getFileVersion(fullPath: string): number | null {
    const p = getWxmlTsPathReverted(fullPath)
    if (p !== null) {
      return this.convertedExpr[p]?.version ?? 0
    }
    return this.vfs.getTrackedFileVersion(fullPath)
  }

  private readComponentJsonData(compPath: string): ComponentJsonData | null {
    if (compPath === null) return null
    const json = this.vfs.trackFile(`${compPath}.json`)
    const version = this.getFileVersion(`${compPath}.json`)!
    if (json === null) return null
    let compConfig: ComponentJsonData | null
    try {
      compConfig = parseCompJson(this.rootPath, `${compPath}.json`, json, version)
    } catch {
      return null
    }
    if (compConfig === null) return null
    return compConfig
  }

  private updateComponentJsonData(fullPath: string): string | null {
    const compPath = possibleComponentPath(fullPath)
    if (compPath === null) return null
    const version = this.getFileVersion(`${compPath}.json`)
    if (version !== null && version === this.trackingComponents[compPath]?.jsonFileVersion) {
      return compPath
    }
    const compJson = this.readComponentJsonData(compPath)
    if (compJson !== null) {
      this.trackingComponents[compPath] = compJson
    } else {
      delete this.trackingComponents[compPath]
      return null
    }
    return compPath
  }

  private forEachDirectDependantComponents(compPath: string, f: (dep: string) => void) {
    Object.keys(this.trackingComponents).forEach((p) => {
      const comp = this.trackingComponents[p]!
      if (Object.values(comp.usingComponents).includes(compPath)) {
        f(p)
      }
    })
  }

  getUsingComponents(compPath: string): Record<string, string> {
    const comp = this.trackingComponents[compPath]
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (!comp) return Object.create(null)
    return comp.usingComponents
  }

  getGenerics(compPath: string): string[] {
    const comp = this.trackingComponents[compPath]
    if (!comp) return []
    return comp.generics
  }

  listTrackingComponents() {
    return Object.keys(this.trackingComponents)
  }

  isComponentTracking(fullPath: string) {
    return !!this.trackingComponents[possibleComponentPath(fullPath) ?? '']
  }

  openFile(fullPath: string, content: string) {
    if (possibleComponentPath(fullPath) !== null) {
      this.vfs.overrideFileContent(fullPath, content)
    }
  }

  updateFile(fullPath: string, content: string) {
    if (this.vfs.isFileContentOverridden(fullPath)) {
      this.vfs.overrideFileContent(fullPath, content)
    }
  }

  closeFile(fullPath: string) {
    if (this.vfs.isFileContentOverridden(fullPath)) {
      this.vfs.cancelOverrideFileContent(fullPath)
    }
  }

  isFileOpened(fullPath: string) {
    return this.vfs.isFileContentOverridden(fullPath)
  }
}
