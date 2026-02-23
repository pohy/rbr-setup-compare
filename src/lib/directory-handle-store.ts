const DB_NAME = 'rbr-setup-compare'
const STORE_NAME = 'handles'
const KEY = 'rbr-root'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB unavailable (incognito, etc.) — silently ignore
  }
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY)
    const result = await new Promise<FileSystemDirectoryHandle | null>(
      (resolve, reject) => {
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error)
      },
    )
    db.close()
    return result
  } catch {
    return null
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // silently ignore
  }
}
