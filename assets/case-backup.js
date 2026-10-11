/* Local, versioned case backups. No network requests or third-party runtime code. */
(function (root) {
  "use strict";
  const FORMAT = "alltagshilfe-vorgang";
  const MAX_TOTAL = 50 * 1024 * 1024;
  const MAX_FILE = 20 * 1024 * 1024;
  const MAX_ARCHIVE = 72 * 1024 * 1024;
  const fail = message => { throw new Error(message); };
  const object = x => x && typeof x === "object" && !Array.isArray(x);
  const text = (x, max = 100000) => typeof x === "string" && x.length <= max;
  const date = x => text(x, 40) && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));

  function copyState(input, template) {
    if (!object(input)) fail("Die Angaben in der Sicherung sind ungültig.");
    const result = {};
    for (const key of Object.keys(input)) {
      if (!Object.hasOwn(template, key)) fail("Die Sicherung enthält unbekannte Felder. Bitte die passende aktuelle Helferversion verwenden.");
    }
    for (const [key, expected] of Object.entries(template)) {
      if (!Object.hasOwn(input, key)) fail("Die Sicherung ist unvollständig.");
      const value = input[key];
      if (object(expected)) result[key] = copyState(value, expected);
      else if (typeof expected === "string" && text(value)) result[key] = value;
      else if (typeof expected === "boolean" && typeof value === "boolean") result[key] = value;
      else if (typeof expected === "number" && Number.isSafeInteger(value)) result[key] = value;
      else fail("Ein Feld in der Sicherung hat ein ungültiges Format.");
    }
    if (Object.hasOwn(template, "caseId")) {
      if (!text(result.caseId, 160) || !result.caseId || result.version !== 1 ||
          !date(result.createdAt) || !date(result.updatedAt) ||
          result.currentStep < 1 || result.currentStep > 7) fail("Die Vorgangsangaben sind ungültig.");
    }
    return result;
  }

  async function checksum(bytes) {
    if (!root.crypto || !root.crypto.subtle) fail("Die Sicherung benötigt eine sichere HTTPS-Verbindung und einen aktuellen Browser.");
    const hash = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
  }
  function encode(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return root.btoa(binary);
  }
  function decode(value) {
    if (!text(value, Math.ceil(MAX_FILE / 3) * 4) || !value.length ||
        value.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail("Eine Datei in der Sicherung ist beschädigt.");
    const binary = root.atob(value);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (bytes.length > MAX_FILE) fail("Eine einzelne Datei ist größer als 20 MB.");
    return bytes;
  }
  function checkMedia(bytes, mime, type) {
    const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
    const valid = (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
      (mime === "image/png" && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) ||
      (mime === "image/webp" && ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP") ||
      (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(ascii(0,6))) ||
      (mime === "application/pdf" && type === "receipt" && ascii(0,5) === "%PDF-");
    if (!valid) fail("Die Sicherung enthält eine nicht unterstützte oder beschädigte Bild-/PDF-Datei.");
  }

  async function create(helper, state, records, template, types) {
    const clean = copyState(state, template);
    const files = [];
    const seen = new Set();
    let total = 0;
    for (const record of records) {
      if (!types.includes(record.type) || seen.has(record.type) || record.caseId !== state.caseId) fail("Die gespeicherten Dateien passen nicht vollständig zu diesem Vorgang.");
      seen.add(record.type);
      if (!record.blob || !record.blob.size || record.blob.size > MAX_FILE) fail("Eine Datei fehlt oder ist größer als 20 MB.");
      total += record.blob.size;
      if (total > MAX_TOTAL) fail("Die Dateien dieses Vorgangs überschreiten zusammen 50 MB.");
      const bytes = new Uint8Array(await record.blob.arrayBuffer());
      const mime = record.mime || record.blob.type;
      checkMedia(bytes, mime, record.type);
      if (!text(record.name || "", 1000) || !date(record.addedAt)) fail("Die Dateiangaben sind ungültig.");
      files.push({type: record.type, name: record.name || "", mime, addedAt: record.addedAt,
        size: bytes.length, sha256: await checksum(bytes), data: encode(bytes)});
    }
    const archive = JSON.stringify({format: FORMAT, version: 1, helper, exportedAt: new Date().toISOString(), state: clean, files});
    if (new Blob([archive]).size > MAX_ARCHIVE) fail("Die Sicherung ist zu groß.");
    return archive;
  }

  async function parse(archive, helper, template, types, migrateState) {
    if (!text(archive, MAX_ARCHIVE) || new Blob([archive]).size > MAX_ARCHIVE) fail("Die Sicherungsdatei ist größer als 72 MB.");
    let data;
    try { data = JSON.parse(archive); } catch (_) { fail("Die Datei ist keine lesbare Vorgangssicherung."); }
    if (!object(data) || data.format !== FORMAT || data.version !== 1) fail("Dieses Sicherungsformat wird nicht unterstützt.");
    if (data.helper !== helper) fail("Diese Sicherung gehört zu einem anderen Helfer. Bitte dort importieren.");
    if (!date(data.exportedAt) || !Array.isArray(data.files) || data.files.length > types.length) fail("Die Sicherung ist unvollständig oder beschädigt.");
    // Helper-specific migrations run before the same strict schema validation.
    const state = copyState(migrateState ? migrateState(data.state) : data.state, template);
    const files = [], seen = new Set();
    let total = 0;
    for (const file of data.files) {
      if (!object(file) || !types.includes(file.type) || seen.has(file.type) || !text(file.name, 1000) ||
          !date(file.addedAt) || !text(file.sha256, 64) || !/^[a-f0-9]{64}$/.test(file.sha256)) fail("Die Dateiliste der Sicherung ist ungültig.");
      seen.add(file.type);
      const bytes = decode(file.data);
      total += bytes.length;
      if (total > MAX_TOTAL) fail("Die Dateien überschreiten zusammen 50 MB.");
      if (file.size !== bytes.length || await checksum(bytes) !== file.sha256) fail("Eine Datei ist beschädigt: Die Prüfsumme stimmt nicht.");
      checkMedia(bytes, file.mime, file.type);
      files.push({type: file.type, name: file.name, mime: file.mime, addedAt: file.addedAt,
        blob: new Blob([bytes], {type: file.mime})});
    }
    return {state, files};
  }

  function readFiles(db, storeName, caseId) {
    return new Promise((resolve, reject) => {
      const records = [];
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).openCursor(root.IDBKeyRange.bound(caseId + ":", caseId + ":\uffff"));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { records.push(cursor.value); cursor.continue(); }
      };
      tx.oncomplete = () => resolve(records);
      tx.onabort = () => reject(tx.error || new Error("Die Dateien konnten nicht gelesen werden."));
      tx.onerror = () => {}; // Reject only after the transaction has finished aborting.
    });
  }

  function writeFiles(db, storeName, records, remove = false) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error("Dateien konnten nicht gespeichert werden."));
      tx.onerror = () => {};
      try {
        for (const record of records) {
          if (remove) store.delete(record.key);
          else store.add(record); // Never overwrite an existing file, even on ID collision.
        }
      } catch (error) { tx.abort(); }
    });
  }

  async function persist(parsed, db, storeName, storage, prefix) {
    const id = "import-" + root.crypto.randomUUID();
    const key = prefix + id;
    if (storage.getItem(key) !== null) fail("Bitte den Import erneut starten; die neue Vorgangskennung ist bereits belegt.");
    const state = {...parsed.state, caseId: id, currentStep: 1};
    const records = parsed.files.map(file => ({...file, caseId: id, key: id + ":" + file.type}));
    // Files commit first. Only the final localStorage write makes the new case visible.
    await writeFiles(db, storeName, records);
    try { storage.setItem(key, JSON.stringify(state)); }
    catch (_) {
      try { await writeFiles(db, storeName, records, true); }
      catch (_) { fail("Import fehlgeschlagen. Vorhandene Vorgänge bleiben erhalten; unvollständige neue Dateikopien konnten nicht entfernt werden. Bitte Speicherplatz prüfen."); }
      fail("Import fehlgeschlagen – bitte freien Browserspeicher prüfen. Vorhandene Vorgänge bleiben erhalten.");
    }
    return state;
  }

  function mount(options) {
    const exportButton = document.getElementById("backupExportBtn");
    const importButton = document.getElementById("backupImportBtn");
    const input = document.getElementById("backupFile");
    const status = document.getElementById("backupStatus");
    let running = false;
    async function run(action) {
      if (running || options.isBusy()) {
        status.textContent = "Bitte warten, bis die aktuelle Verarbeitung abgeschlossen ist.";
        return;
      }
      running = true;
      const controls = [...document.querySelectorAll("button, input, select, textarea")].map(el => [el, el.disabled]);
      controls.forEach(([el]) => { el.disabled = true; });
      options.begin();
      try { await action(); }
      catch (error) { status.textContent = error.message || "Die Sicherung konnte nicht verarbeitet werden. Bitte erneut versuchen."; }
      finally {
        input.value = "";
        controls.forEach(([el, disabled]) => { el.disabled = disabled; });
        options.end();
        running = false;
      }
    }
    exportButton.addEventListener("click", () => run(async () => {
      status.textContent = "Sicherung wird vorbereitet …";
      const snapshot = JSON.parse(JSON.stringify(options.getState()));
      const records = await readFiles(await options.openDb(), options.storeName, snapshot.caseId);
      const archive = await create(options.helper, snapshot, records, options.defaultState(), options.types);
      const url = URL.createObjectURL(new Blob([archive], {type: "application/json"}));
      const link = document.createElement("a");
      link.href = url;
      link.download = "Vorgang-" + options.helper + "-" + new Date().toISOString().slice(0,10) + ".json";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = "Download gestartet. Bitte prüfen, ob die Sicherungsdatei gespeichert wurde. Enthaltene Dateien: " + records.length + ".";
    }));
    importButton.addEventListener("click", () => {
      if (running || options.isBusy()) { status.textContent = "Bitte warten, bis die aktuelle Verarbeitung abgeschlossen ist."; return; }
      input.click();
    });
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      run(async () => {
        status.textContent = "Sicherung wird geprüft …";
        if (file.size > MAX_ARCHIVE) fail("Die Sicherungsdatei ist größer als 72 MB.");
        const parsed = await parse(await file.text(), options.helper, options.defaultState(), options.types, options.migrateState);
        const state = await persist(parsed, await options.openDb(), options.storeName, localStorage, options.prefix);
        // From here the saved case can be recovered by the existing case scanner, even if rendering fails.
        try {
          await options.onImported(state);
          status.textContent = "Sicherung als zusätzlicher Vorgang geöffnet. Vorhandene Vorgänge bleiben erhalten.";
        } catch (_) { status.textContent = "Der Vorgang wurde importiert. Bitte die Seite neu laden, um ihn in der Vorgangsliste zu öffnen."; }
      });
    });
  }
  const api = {create, parse, readFiles, persist, mount, MAX_ARCHIVE};
  root.CaseBackup = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
