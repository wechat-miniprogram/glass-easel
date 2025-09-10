import fs from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'
import { type TmplConvertedExpr, TmplGroup } from 'glass-easel-template-compiler'
import { VirtualFileSystem } from './virtual_fs'

// determine if a path (relative to the code root) is a component
const isCompPath = (fullPath: string): boolean => {
  try {
    const json = fs.readFileSync(`${fullPath}.json`, { encoding: 'utf8' })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (parsed.component === true || typeof parsed.usingComponents === 'object')
    ) {
      return true
    }
  } catch (e) {
    /* empty */
  }
  return false
}

export const isWxmlFile = (fullPath: string): boolean => path.extname(fullPath) === '.wxml'

export const getWxmlConvertedTsPath = (fullPath: string): string | null => {
  if (!isWxmlFile(fullPath)) return null
  return `${fullPath}.INLINE.ts`
}

export const getWxmlTsPathReverted = (fullPath: string): string | null => {
  if (!fullPath.endsWith('.wxml.INLINE.ts')) return null
  const p = fullPath.slice(0, -10)
  return p
}

type ConvertedExprCache = { expr: TmplConvertedExpr; source: ts.SourceFile }

export class ProjectDirManager {
  readonly vfs: VirtualFileSystem
  private tmplGroup = new TmplGroup()
  private entranceWxmlFiles = Object.create(null) as Record<string, true>
  private convertedExprCache = Object.create(null) as Record<string, ConvertedExprCache>
  onEntranceFileAdded: (fullPath: string) => void = () => {}
  onEntranceFileRemoved: (fullPath: string) => void = () => {}
  onTrackedFileRemoved: (fullPath: string) => void = () => {}
  onTrackedFileUpdated: (fullPath: string) => void = () => {}

  constructor(rootPath: string, autoTrackAllComponents: boolean, firstScanCallback: () => void) {
    this.vfs = new VirtualFileSystem(rootPath, firstScanCallback)
    this.vfs.onFileFound = (fullPath) => {
      if (!autoTrackAllComponents) return
      if (isWxmlFile(fullPath)) {
        if (isCompPath(fullPath.slice(0, -5))) {
          this.vfs.trackFile(fullPath)
          this.entranceWxmlFiles[fullPath] = true
          this.onEntranceFileAdded(fullPath)
        }
      }
    }
    this.vfs.onTrackedFileUpdated = (fullPath) => {
      this.removeConvertedExprCache(fullPath)
      this.onTrackedFileUpdated(fullPath)
    }
    this.vfs.onTrackedFileRemoved = (fullPath) => {
      this.removeConvertedExprCache(fullPath)
      this.onTrackedFileRemoved(fullPath)
    }
  }

  stop() {
    Object.values(this.convertedExprCache).forEach((ce) => ce.expr.free())
    this.tmplGroup.free()
    return this.vfs.stop()
  }

  getEntranceWxmlFiles() {
    return Object.keys(this.entranceWxmlFiles)
  }

  getFileContent(fullPath: string): string | null {
    return this.vfs.trackFile(fullPath)?.content ?? null
  }

  removeConvertedExprCache(fullPath: string) {
    if (isWxmlFile(fullPath)) {
      const ce = this.convertedExprCache[fullPath]
      if (ce) {
        delete this.convertedExprCache[fullPath]
        ce.expr.free()
      }
    }
  }

  getWxmlConvertedExpr(wxmlFullPath: string): string | null {
    if (this.convertedExprCache[wxmlFullPath]) {
      return this.convertedExprCache[wxmlFullPath]!.expr.code() ?? ''
    }
    const content = this.getFileContent(wxmlFullPath)
    if (!content) return null
    const relPath = path.relative(this.vfs.rootPath, wxmlFullPath).split(path.sep).join('/')
    if (relPath.startsWith('../')) return null
    this.tmplGroup.addTmpl(relPath, content)
    const expr = this.tmplGroup.getTmplConvertedExpr(relPath)
    this.convertedExprCache[wxmlFullPath] = {
      expr,
      source: ts.createSourceFile(wxmlFullPath, content, ts.ScriptTarget.Latest),
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

  getFileTsContent(fullPath: string): string | null {
    const p = getWxmlTsPathReverted(fullPath)
    if (p !== null) {
      return this.getWxmlConvertedExpr(p)
    }
    return this.getFileContent(fullPath)
  }

  getFileVersion(fullPath: string): number | null {
    return this.vfs.trackFile(fullPath)?.version ?? null
  }

  openFile(fullPath: string, content: string) {
    if (isWxmlFile(fullPath)) {
      this.vfs.overrideFileContent(fullPath, content)
      this.entranceWxmlFiles[fullPath] = true
      this.onEntranceFileAdded(fullPath)
    }
  }

  updateFile(fullPath: string, content: string) {
    if (this.entranceWxmlFiles[fullPath]) {
      this.vfs.overrideFileContent(fullPath, content)
    }
  }

  closeFile(fullPath: string) {
    if (this.entranceWxmlFiles[fullPath]) {
      delete this.entranceWxmlFiles[fullPath]
      this.vfs.cancelOverrideFileContent(fullPath)
      this.onEntranceFileRemoved(fullPath)
    }
  }
}
