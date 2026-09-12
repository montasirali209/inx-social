const DATABASE_NAME = 'inx-social-post-composer'
const STORE_NAME = 'files'
const FILE_KEY = 'standard-post-media'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Browser draft storage is unavailable.'))
  })
}

async function transact(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest) {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    operation(transaction.objectStore(STORE_NAME))
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Browser draft storage failed.')) }
  })
}

export function savePostComposerFile(file: File) {
  return transact('readwrite', (store) => store.put(file, FILE_KEY))
}

export async function readPostComposerFile() {
  const database = await openDatabase()
  return new Promise<File | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(FILE_KEY)
    request.onsuccess = () => resolve(request.result instanceof File ? request.result : null)
    request.onerror = () => reject(request.error || new Error('Browser draft media could not be restored.'))
    transaction.oncomplete = () => database.close()
  })
}

export function clearPostComposerFile() {
  return transact('readwrite', (store) => store.delete(FILE_KEY))
}
