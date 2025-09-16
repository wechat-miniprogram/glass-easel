import path from 'node:path'
import * as ts from 'typescript'
import { type TmplConvertedExpr, TmplGroup } from 'glass-easel-template-compiler'
import { VirtualFileSystem } from './virtual_fs'

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
    const relPath = path.relative(projectRootPath, fullPath)
    const relPathDir = path.dirname(relPath)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Object.keys(parsed.usingComponents ?? 0).forEach((key) => {
      if (!isValidKey(key)) return
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const p = String(parsed.usingComponents[key])
      ret.usingComponents[key] = path.join(projectRootPath, path.resolve(relPathDir, p))
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
  expr: TmplConvertedExpr
  source: ts.SourceFile
  tsVersion: number
}

export class ProjectDirManager {
  readonly vfs: VirtualFileSystem
  private readonly rootPath: string
  private tmplGroup = new TmplGroup()
  private trackingComponents = Object.create(null) as Record<string, ComponentJsonData>
  private convertedExprCache = Object.create(null) as Record<string, ConvertedExprCache>
  onEntranceFileAdded: (fullPath: string) => void = () => {}
  onEntranceFileRemoved: (fullPath: string) => void = () => {}
  onConvertedExprCacheInvalidated: (wxmlFullPath: string) => void = () => {}
  // onTrackedFileRemoved: (fullPath: string) => void = () => {}
  // onTrackedFileUpdated: (fullPath: string) => void = () => {}

  constructor(rootPath: string, autoTrackAllComponents: boolean, firstScanCallback: () => void) {
    this.rootPath = rootPath
    this.vfs = new VirtualFileSystem(rootPath, firstScanCallback)
    this.vfs.onFileFound = (fullPath) => {
      if (!autoTrackAllComponents) return
      if (isWxmlFile(fullPath)) {
        this.updateComponentJsonData(fullPath)
      }
    }
    this.vfs.onTrackedFileUpdated = (fullPath) => {
      const compPath = possibleComponentPath(fullPath)
      if (compPath !== null) {
        if (isJsonFile(fullPath)) {
          this.removeConvertedExprCache(`${compPath}.wxml`)
          const isComp = !!this.trackingComponents[compPath]
          const newIsComp = this.updateComponentJsonData(fullPath) !== null
          if (!isComp && newIsComp) {
            this.onEntranceFileAdded(`${compPath}.wxml`)
          } else if (isComp && !newIsComp) {
            this.onEntranceFileRemoved(`${compPath}.wxml`)
          }
        } else if (isTsFile(fullPath)) {
          this.removeConvertedExprCache(`${compPath}.wxml`)
          this.forEachDirectDependantComponents(compPath, (compPath) => {
            this.removeConvertedExprCache(`${compPath}.wxml`)
          })
        } else {
          this.removeConvertedExprCache(fullPath)
        }
      }
      // this.onTrackedFileUpdated(fullPath)
    }
    this.vfs.onTrackedFileRemoved = (fullPath) => {
      const compPath = possibleComponentPath(fullPath)
      if (compPath !== null) {
        if (isJsonFile(fullPath)) {
          this.removeConvertedExprCache(`${compPath}.wxml`)
          const isComp = !!this.trackingComponents[compPath]
          if (isComp) {
            this.onEntranceFileRemoved(`${compPath}.wxml`)
          }
        } else if (isTsFile(fullPath)) {
          this.removeConvertedExprCache(`${compPath}.wxml`)
          this.forEachDirectDependantComponents(compPath, (compPath) => {
            this.removeConvertedExprCache(`${compPath}.wxml`)
          })
        } else {
          this.removeConvertedExprCache(fullPath)
        }
      }
      // this.onTrackedFileRemoved(fullPath)
    }
  }

  stop() {
    Object.values(this.convertedExprCache).forEach((ce) => ce.expr.free())
    this.tmplGroup.free()
    return this.vfs.stop()
  }

  getFileContent(fullPath: string): string | null {
    return this.vfs.trackFile(fullPath)
  }

  removeConvertedExprCache(fullPath: string) {
    if (isWxmlFile(fullPath)) {
      const ce = this.convertedExprCache[fullPath]
      if (ce) {
        delete this.convertedExprCache[fullPath]
        ce.expr.free()
        this.onConvertedExprCacheInvalidated(fullPath)
      }
    }
  }

  getWxmlConvertedExpr(
    wxmlFullPath: string,
    wxmlEnvGetter: (fullPath: string, importTargetFullPath: string) => string,
  ): string | null {
    const tsFullPath = `${wxmlFullPath.slice(0, -5)}.ts`
    const tsVersion = this.getFileVersion(tsFullPath) ?? -1
    const cache = this.convertedExprCache[wxmlFullPath]
    if (cache && cache.tsVersion === tsVersion) {
      return cache.expr.code() ?? ''
    }
    const content = this.getFileContent(wxmlFullPath)
    if (!content) return null
    const relPath = path.relative(this.vfs.rootPath, wxmlFullPath).split(path.sep).join('/')
    if (relPath.startsWith('../')) return null
    this.tmplGroup.addTmpl(relPath, content)
    const expr = this.tmplGroup.getTmplConvertedExpr(
      relPath,
      wxmlEnvGetter(tsFullPath, wxmlFullPath),
    )
    console.info(`!!! CONV ${wxmlFullPath}\n${expr.code()}\n`)
    this.convertedExprCache[wxmlFullPath] = {
      expr,
      source: ts.createSourceFile(wxmlFullPath, content, ts.ScriptTarget.Latest),
      tsVersion,
    }
    return expr.code() ?? ''
  }

  getWxmlSource(
    wxmlFullPath: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
  ): {
    source: ts.SourceFile
    startLine: number
    startCol: number
    endLine: number
    endCol: number
  } | null {
    const arr = this.convertedExprCache[wxmlFullPath]?.expr.getSourceLocation(
      startLine,
      startCol,
      endLine,
      endCol,
    )
    if (!arr) return null
    return {
      source: this.convertedExprCache[wxmlFullPath]!.source,
      startLine: arr[0]!,
      startCol: arr[1]!,
      endLine: arr[2]!,
      endCol: arr[3]!,
    }
  }

  getFileTsContent(
    fullPath: string,
    wxmlEnvGetter: (tsFullPath: string, wxmlFullPath: string) => string,
  ): string | null {
    const p = getWxmlTsPathReverted(fullPath)
    if (p !== null) {
      return this.getWxmlConvertedExpr(p, wxmlEnvGetter)
    }
    return this.getFileContent(fullPath)
  }

  getFileVersion(fullPath: string): number | null {
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (!comp) return Object.create(null)
    return comp.generics
  }

  listTrackingComponents() {
    return Object.keys(this.trackingComponents)
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
}
