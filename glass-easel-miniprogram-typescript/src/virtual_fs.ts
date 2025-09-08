import fs from 'node:fs'
import chokidar, { type FSWatcher } from 'chokidar'

type VirtualFile = {
  version: number
  content: string | null
  contentOutdated: boolean
  overriddenContent: string | null
}

export class VirtualFileSystem {
  private rootPath: string
  private files = Object.create(null) as Record<string, VirtualFile>
  private watcher: FSWatcher
  onFileFound: (fullPath: string) => void = () => {}
  onFileUpdated: (fullPath: string) => void = () => {}
  onFileRemoved: (fullPath: string) => void = () => {}
  onTrackedFileRemoved: (fullPath: string) => void = () => {}
  onTrackedFileUpdated: (fullPath: string) => void = () => {}

  constructor(rootPath: string, firstScanCallback: () => void) {
    this.rootPath = rootPath

    // file added handling
    const handleFileAdded = (fullPath: string) => {
      this.onFileFound(fullPath)
    }

    // file removed handling
    const handleFileRemoved = (fullPath: string) => {
      this.onFileRemoved(fullPath)
      const entry = this.getFileEntry(fullPath)
      if (entry) {
        entry.content = null
        entry.contentOutdated = false
        if (entry.overriddenContent === null) {
          this.removeEntry(fullPath)
        }
        this.onTrackedFileRemoved(fullPath)
      }
    }

    // file changed handling
    const handleFileChanged = (fullPath: string) => {
      this.onFileUpdated(fullPath)
      const entry = this.getFileEntry(fullPath)
      if (entry) {
        entry.contentOutdated = true
        this.onTrackedFileUpdated(fullPath)
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

  private getFileEntry(fullPath: string): VirtualFile | null {
    return this.files[fullPath] ?? null
  }

  private getOrCreateFileEntry(fullPath: string): VirtualFile {
    const ret = this.files[fullPath]
    if (!ret) {
      const ret = {
        version: 0,
        content: null,
        contentOutdated: false,
        overriddenContent: null,
      }
      this.files[fullPath] = ret
      return ret
    }
    return ret
  }

  private removeEntry(fullPath: string) {
    delete this.files[fullPath]
  }

  private loadFileContentFromDisk(fullPath: string): VirtualFile | null {
    let content: string
    try {
      content = fs.readFileSync(fullPath, { encoding: 'utf8' })
    } catch (e) {
      return null
    }
    if (content === null) return this.getFileEntry(fullPath)
    const entry = this.getOrCreateFileEntry(fullPath)
    if (entry.overriddenContent === null) {
      entry.version += 1
    }
    entry.content = content
    entry.contentOutdated = false
    return entry
  }

  // Read the file content and start tracking if the file is inside the project
  //
  // This will try to load file content from disk if not present.
  trackFile(fullPath: string): VirtualFile | null {
    let entry = this.getFileEntry(fullPath)
    if (!entry || (entry.contentOutdated && entry.overriddenContent === null)) {
      entry = this.loadFileContentFromDisk(fullPath)
    }
    return entry ?? null
  }

  // End the tracking of the file content
  endTrackFile(fullPath: string) {
    const entry = this.getFileEntry(fullPath)
    if (!entry) return
    if (entry.overriddenContent === null) {
      this.removeEntry(fullPath)
      return
    }
    entry.content = null
    entry.contentOutdated = false
  }

  // Overrides the content of a file (and also mark it as an entrance file)
  //
  // This also keep the file when the file is unlinked on dist.
  overrideFileContent(fullPath: string, content: string) {
    const entry = this.getOrCreateFileEntry(fullPath)
    entry.version += 1
    entry.overriddenContent = content
  }

  // Cancels the corresponding `overrideFileContent` operation
  cancelOverrideFileContent(fullPath: string) {
    const entry = this.getFileEntry(fullPath)
    if (!entry) return
    if (entry.content === null) {
      this.removeEntry(fullPath)
      return
    }
    if (entry.overriddenContent === null) return
    entry.version += 1
    entry.overriddenContent = null
  }
}
