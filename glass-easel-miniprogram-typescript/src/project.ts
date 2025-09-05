import fs from 'node:fs'
import path from 'node:path'
import { TmplGroup } from 'glass-easel-template-compiler'
import { VirtualFileSystem } from './virtual_fs'

// TODO check windows `relPath` sep

// determine if a path (relative to the code root) is a component
const isCompPath = (rootPath: string, relPath: string): boolean => {
  try {
    const json = fs.readFileSync(path.join(rootPath, `${relPath}.json`), { encoding: 'utf8' })
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

export class ProjectDirManager {
  readonly vfs: VirtualFileSystem
  private tmplGroup = new TmplGroup()
  private entranceFiles = Object.create(null) as Record<string, true>
  onTrackedFileRemoved: (relPath: string) => void = () => {}
  onTrackedFileUpdated: (relPath: string) => void = () => {}

  constructor(rootPath: string, autoTrackAllComponents: boolean, firstScanCallback: () => void) {
    this.vfs = new VirtualFileSystem(rootPath, firstScanCallback)
    this.vfs.onFileFound = (relPath) => {
      if (!autoTrackAllComponents) return
      const extName = path.extname(relPath)
      if (extName === '.wxml') {
        if (isCompPath(rootPath, relPath.slice(0, -extName.length))) {
          this.vfs.trackFile(relPath)
          this.entranceFiles[relPath] = true
        }
      }
    }
    this.vfs.onTrackedFileUpdated = (relPath) => {
      this.onTrackedFileUpdated(relPath)
    }
    this.vfs.onTrackedFileRemoved = (relPath) => {
      this.onTrackedFileRemoved(relPath)
    }
  }

  stop() {
    this.tmplGroup.free()
    return this.vfs.stop()
  }

  getEntranceFiles() {
    return Object.keys(this.entranceFiles)
  }

  getFileContent(relPath: string): string | null {
    return this.vfs.trackFile(relPath)?.content ?? null
  }

  getFileVersion(relPath: string): number | null {
    return this.vfs.trackFile(relPath)?.version ?? null
  }

  openFile(relPath: string, content: string) {
    const extName = path.extname(relPath)
    if (extName === '.wxml') {
      this.vfs.overrideFileContent(relPath, content)
      this.entranceFiles[relPath] = true
    }
  }

  updateFile(relPath: string, content: string) {
    if (this.entranceFiles[relPath]) {
      this.vfs.overrideFileContent(relPath, content)
    }
  }

  closeFile(relPath: string) {
    if (this.entranceFiles[relPath]) {
      delete this.entranceFiles[relPath]
      this.vfs.cancelOverrideFileContent(relPath)
    }
  }
}
