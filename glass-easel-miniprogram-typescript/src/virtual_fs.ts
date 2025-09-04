import fs from 'node:fs'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'

type VirtualFile = {
  version: number
  content: string | null
  contentOutdated: boolean
  overriddenContent: string | null
  directDependencies: { [relPath: string]: true }
  directDependants: { [relPath: string]: true }
}

type VirtualDirectory = {
  version: number
  children: { [name: string]: VirtualFile | VirtualDirectory }
}

export class VirtualFileSystem {
  private rootPath: string
  private root: VirtualDirectory
  private watcher: FSWatcher
  onFileFound: (relPath: string) => void = () => {}
  onTrackedFileRemoved: (relPath: string) => void = () => {}
  onTrackedFileUpdated: (relPath: string) => void = () => {}

  constructor(rootPath: string, firstScanCallback: () => void) {
    this.rootPath = rootPath
    this.root = {
      version: 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      children: Object.create(null),
    }

    // file added handling
    const handleFileAdded = (relPath: string) => {
      this.onFileFound(relPath)
    }

    // file removed handling
    const handleFileRemoved = (relPath: string) => {
      const entry = this.getFileEntry(relPath)
      if (entry) {
        entry.content = null
        entry.contentOutdated = false
        if (entry.overriddenContent === null) {
          this.removeEntry(relPath)
        }
        this.onTrackedFileRemoved(relPath)
      }
    }

    // file changed handling
    const handleFileChanged = (relPath: string) => {
      const entry = this.getFileEntry(relPath)
      if (entry) {
        entry.contentOutdated = true
        this.onTrackedFileUpdated(relPath)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.watcher = chokidar.watch(rootPath, { ignoreInitial: false })
    this.watcher
      .on('add', (p) => {
        handleFileAdded(p)
      })
      .on('unlink', (p) => {
        handleFileRemoved(p)
      })
      .on('change', (p) => {
        handleFileChanged(p)
      })
      .on('ready', () => {
        firstScanCallback()
      })
  }

  async stop() {
    await this.watcher.close()
  }

  private getFileEntry(relPath: string): VirtualFile | null {
    const parts = relPath.split('/')
    let curDir = this.root
    for (let i = 0; i < parts.length - 2; i += 1) {
      const part = parts[i]!
      if (!curDir.children[part] || !('children' in curDir.children[part])) {
        return null
      }
      const child = curDir.children[part]
      curDir = child
    }
    const name = parts[parts.length - 1]!
    if (curDir.children[name] && 'content' in curDir.children[name]) {
      return curDir.children[name] as VirtualFile
    }
    return null
  }

  private getOrCreateFileEntry(relPath: string): VirtualFile {
    const parts = relPath.split('/')
    let curDir = this.root
    for (let i = 0; i < parts.length - 2; i += 1) {
      const part = parts[i]!
      if (!curDir.children[part] || !('children' in curDir.children[part])) {
        curDir.children[part] = {
          version: 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          children: Object.create(null),
        }
      }
      const child = curDir.children[part]
      curDir = child
    }
    const name = parts[parts.length - 1]!
    if (curDir.children[name] && 'content' in curDir.children[name]) {
      return curDir.children[name] as VirtualFile
    }
    curDir.children[name] = {
      version: 0,
      content: null,
      contentOutdated: false,
      overriddenContent: null,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      directDependencies: Object.create(null),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      directDependants: Object.create(null),
    }
    return curDir.children[name] as VirtualFile
  }

  private removeEntry(relPath: string) {
    const parts = relPath.split('/')
    let curDir = this.root
    const mid: [string, VirtualDirectory][] = []
    for (let i = 0; i < parts.length - 2; i += 1) {
      const part = parts[i]!
      if (!curDir.children[part] || !('children' in curDir.children[part])) {
        return
      }
      mid.push([part, curDir])
      const child = curDir.children[part]
      curDir = child
    }
    const name = parts[parts.length - 1]!
    delete curDir.children[name]
    while (mid.length > 0) {
      const [name, dir] = mid.pop()!
      if (Object.keys(dir.children).length === 0) {
        delete dir.children[name]
      }
    }
  }

  private loadFileContentFromDisk(relPath: string): VirtualFile | null {
    let content: string
    try {
      content = fs.readFileSync(path.join(this.rootPath, relPath), { encoding: 'utf8' })
    } catch (e) {
      return null
    }
    if (content === null) return this.getFileEntry(relPath)
    const entry = this.getOrCreateFileEntry(relPath)
    if (entry.overriddenContent === null) {
      entry.version += 1
    }
    entry.content = content
    entry.contentOutdated = false
    return entry
  }

  // Read the file content and start tracking
  //
  // This will try to load file content from disk if not present.
  // The `relPath` should always be `/` seperated even on Windows.
  trackFileContent(relPath: string): string | null {
    let entry = this.getFileEntry(relPath)
    if (!entry || (entry.contentOutdated && entry.overriddenContent === null)) {
      entry = this.loadFileContentFromDisk(relPath)
    }
    return entry?.content ?? null
  }

  // TODO proper gc
  // // Add a dependency to a file
  // //
  // // The `relPath` and `dependencyRelPath` should always be `/` seperated even on Windows.
  // addDependency(relPath: string, dependencyRelPath: string) {
  //   const src = this.getFileEntry(relPath)?.directDependencies
  //   const dest = this.getFileEntry(dependencyRelPath)?.directDependants
  //   if (!src || !dest) return
  //   src[dependencyRelPath] = true
  //   dest[relPath] = true
  // }

  // // Remove a dependency to a file
  // //
  // // The `relPath` and `dependencyRelPath` should always be `/` seperated even on Windows.
  // removeDependency(relPath: string, dependencyRelPath: string) {
  //   const src = this.getFileEntry(relPath)?.directDependencies
  //   const dest = this.getFileEntry(dependencyRelPath)?.directDependants
  //   if (!src || !dest) return
  //   delete src[dependencyRelPath]
  //   delete dest[relPath]
  // }

  // Overrides the content of a file (and also mark it as an entrance file)
  //
  // This also keep the file when the file is unlinked on dist.
  // The `relPath` should always be `/` seperated even on Windows.
  overrideFileContent(relPath: string, content: string) {
    const entry = this.getOrCreateFileEntry(relPath)
    entry.version += 1
    entry.overriddenContent = content
  }

  // Cancels the corresponding `overrideFileContent` operation
  //
  // The `relPath` should always be `/` seperated even on Windows.
  cancelOverrideFileContent(relPath: string) {
    const entry = this.getFileEntry(relPath)
    if (!entry) return
    if (entry.content === null) {
      this.removeEntry(relPath)
      return
    }
    if (entry.overriddenContent === null) return
    entry.version += 1
    entry.overriddenContent = null
  }
}
