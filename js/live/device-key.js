// A non-extractable CryptoKey is structured-cloned by IndexedDB; no raw key
// or passphrase is written to localStorage. This is an explicit device choice.
export async function deviceKey(action, owner, value) {
  const db = await new Promise((resolve,reject) => {
    const request = indexedDB.open('hearth-trusted-device',1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve,reject) => {
      const tx = db.transaction('keys', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('keys');
      const request = action === 'get' ? store.get(owner) : action === 'put' ? store.put(value,owner) : store.delete(owner);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || Error('Device storage unavailable'));
    });
  } finally { db.close(); }
}
