(() => {
  "use strict";

  const STORAGE_KEY = "kramurai-return-v1";
  const DB_NAME = "kramurai-local";
  const STORE_NAME = "files";
  const CASES_KEY = STORAGE_KEY + "-cases-v2";
  const CASE_PREFIX = STORAGE_KEY + ":case:";
  const caseStorageKey = id => CASE_PREFIX + id;
  const TOTAL_STEPS = 6;
  const photoLabels = {
    overall: "Gesamtansicht des Artikels",
    serial: "Seriennummer / Typenschild",
    accessories: "Artikel mit komplettem Zubehör",
    openPackage: "Inhalt im offenen Paket",
    protected: "Verpackung / Polsterung",
    closedPackage: "Geschlossenes Paket",
    receipt: "Einlieferungsbeleg"
  };

  const defaultState = () => ({
    version: 1,
    caseId: (crypto.randomUUID ? crypto.randomUUID() : "case-" + Date.now()),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: 1,
    item: { name: "", manufacturer: "", model: "", serial: "", reason: "" },
    party: { sender: "", recipient: "" },
    condition: { rating: "", note: "" },
    accessories: { powerSupply: false, cable: false, manual: false, originalBox: false, other: "" },
    shipment: { carrier: "", tracking: "", date: "", weight: "" }
  });

  let caseIndex = { ids: [], activeId: "" };
  let fileBusyCount = 0;
  let state = loadState();
  let summaryObjectUrls = [];
  let dbPromise;
  const objectUrls = new Map();

  const form = document.getElementById("returnForm");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const saveStatus = document.getElementById("saveStatus");
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const finalPrintBtn = document.getElementById("finalPrintBtn");
  const finalPrintBtnBottom = document.getElementById("finalPrintBtnBottom");
  const finalBackBtn = document.getElementById("finalBackBtn");
  const newCaseBtn = document.getElementById("newCaseBtn");
  const caseSelect = document.getElementById("caseSelect");
  const caseCount = document.getElementById("caseCount");
  const createCaseTopBtn = document.getElementById("createCaseTopBtn");
  const missingCheck = document.getElementById("missingCheck");
  const wizardNav = document.getElementById("wizardNav");

  function setPrintButtons(disabled, text) {
    [finalPrintBtn, finalPrintBtnBottom].filter(Boolean).forEach(btn => {
      btn.disabled = disabled;
      btn.textContent = text;
    });
  }


  function loadState() {
    let legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {}

    let registry = null;
    try {
      registry = JSON.parse(localStorage.getItem(CASES_KEY) || "null");
    } catch (e) {}

    // Auch wenn ein älterer Start die Vorgangsliste versehentlich auf
    // einen Eintrag reduziert hat, bleiben andere :case:-Schlüssel
    // möglicherweise erhalten. Alle gültigen Einträge wiederfinden.
    const saved = new Map();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(CASE_PREFIX)) continue;
        const id = key.slice(CASE_PREFIX.length);
        try {
          const found = JSON.parse(localStorage.getItem(key) || "null");
          if (found && found.caseId === id) saved.set(id, found);
        } catch (e) {}
      }
    } catch (e) {}

    if (legacy && legacy.caseId && !saved.has(legacy.caseId)) {
      saved.set(legacy.caseId, legacy);
      try { localStorage.setItem(caseStorageKey(legacy.caseId), JSON.stringify(legacy)); }
      catch (e) {}
    }

    const orderedIds = registry && Array.isArray(registry.ids)
      ? registry.ids.filter(id => typeof id === "string" && saved.has(id))
      : [];
    const ids = [...new Set([...orderedIds, ...saved.keys()])];
    if (!ids.length) {
      const initial = defaultState();
      ids.push(initial.caseId);
      saved.set(initial.caseId, initial);
      try { localStorage.setItem(caseStorageKey(initial.caseId), JSON.stringify(initial)); }
      catch (e) {}
    }

    let activeId = registry && saved.has(registry.activeId)
      ? registry.activeId
      : legacy && saved.has(legacy.caseId)
        ? legacy.caseId
        : ids[0];
    caseIndex = { ids, activeId };
    try { localStorage.setItem(CASES_KEY, JSON.stringify(caseIndex)); } catch (e) {}
    return saved.get(activeId);
  }

  function caseTitle(saved) {
    const item = saved.item || {};
    const name = String(item.name || "").trim() || "Neuer Vorgang";
    const date = saved.updatedAt ? new Date(saved.updatedAt) : null;
    const dateLabel = date && !isNaN(date.getTime())
      ? date.toLocaleDateString("de-DE") : "";
    return (name.length > 35 ? name.slice(0, 32) + "…" : name)
      + (dateLabel ? " · " + dateLabel : "");
  }

  function renderCaseList() {
    if (!caseSelect) return;
    const entries = caseIndex.ids.map(id => {
      if (state.caseId === id) return state;
      try {
        const parsed = JSON.parse(localStorage.getItem(caseStorageKey(id)) || "null");
        return parsed && parsed.caseId === id ? parsed : null;
      } catch (e) { return null; }
    }).filter(Boolean);
    entries.sort((a,b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    caseSelect.replaceChildren(...entries.map(saved => {
      const option = document.createElement("option");
      option.value = saved.caseId;
      option.textContent = caseTitle(saved);
      return option;
    }));
    caseSelect.value = state.caseId;
    caseCount.textContent = "(" + entries.length + ")";
    const busy = fileBusyCount > 0;
    caseSelect.disabled = busy;
    createCaseTopBtn.disabled = busy;
    newCaseBtn.disabled = busy;
    document.getElementById("deleteBtn").disabled = busy;
  }

  function saveState(updateTimestamp = true) {
    if (updateTimestamp) state.updatedAt = new Date().toISOString();
    if (!caseIndex.ids.includes(state.caseId)) caseIndex.ids.push(state.caseId);
    caseIndex.activeId = state.caseId;
    try {
      // Legacy-Kopie bleibt zur Sicherheit lesbar; weitere Fälle
      // erhalten je einen eigenen Schlüssel. Fotos bleiben in IndexedDB.
      localStorage.setItem(caseStorageKey(state.caseId), JSON.stringify(state));
      localStorage.setItem(CASES_KEY, JSON.stringify(caseIndex));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveStatus.textContent = "lokal gespeichert";
    } catch (e) {
      saveStatus.textContent = "Speichern fehlgeschlagen – Speicherplatz prüfen";
    }
    renderCaseList();
  }

  function resetCaseImages() {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls.clear();
    summaryObjectUrls.forEach(url => URL.revokeObjectURL(url));
    summaryObjectUrls = [];
  }

  async function openSavedCase(caseId) {
    if (!caseId || caseId === state.caseId) return;
    if (fileBusyCount) {
      alert("Bitte warten, bis das Foto gespeichert wurde.");
      renderCaseList();
      return;
    }
    saveState(false);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(caseStorageKey(caseId)) || "null"); }
    catch (e) {}
    if (!saved || saved.caseId !== caseId) {
      alert("Dieser Vorgang konnte nicht geöffnet werden.");
      renderCaseList();
      return;
    }
    resetCaseImages();
    state = saved;
    form.reset();
    hydrateForm();
    saveState(false);
    await restorePreviews();
    showStep(state.currentStep || 1);
  }

  async function createNewCase() {
    if (fileBusyCount) {
      alert("Bitte warten, bis das Foto gespeichert wurde.");
      return;
    }
    saveState(false);
    resetCaseImages();
    state = defaultState();
    form.reset();
    hydrateForm();
    saveState(false);
    await restorePreviews();
    showStep(1);
  }

  function beginFileWork() {
    fileBusyCount++;
    renderCaseList();
  }
  function endFileWork() {
    fileBusyCount = Math.max(0, fileBusyCount - 1);
    renderCaseList();
  }

  function setPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getPath(obj, path) {
    return path.split(".").reduce((acc, key) => acc && acc[key], obj);
  }

  function hydrateForm() {
    document.querySelectorAll("[data-field]").forEach(el => {
      const value = getPath(state, el.dataset.field);
      if (value !== undefined && value !== null) el.value = value;
    });
    document.querySelectorAll("[data-radio]").forEach(el => {
      el.checked = getPath(state, el.dataset.radio) === el.value;
    });
    document.querySelectorAll("[data-check]").forEach(el => {
      el.checked = !!getPath(state, el.dataset.check);
    });
  }

  function bindAutosave() {
    document.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("input", () => {
        setPath(state, el.dataset.field, el.value);
        saveStatus.textContent = "speichert …";
        saveState();
      });
    });
    document.querySelectorAll("[data-radio]").forEach(el => {
      el.addEventListener("change", () => {
        if (el.checked) {
          setPath(state, el.dataset.radio, el.value);
          saveState();
        }
      });
    });
    document.querySelectorAll("[data-check]").forEach(el => {
      el.addEventListener("change", () => {
        setPath(state, el.dataset.check, el.checked);
        saveState();
      });
    });
  }

  function showStep(step, scroll = true) {
    state.currentStep = Math.max(1, Math.min(TOTAL_STEPS, step));
    document.querySelectorAll(".step").forEach(el => el.classList.toggle("active", Number(el.dataset.step) === state.currentStep));
    progressBar.style.width = ((state.currentStep / TOTAL_STEPS) * 100) + "%";
    progressText.textContent = "Schritt " + state.currentStep + " von " + TOTAL_STEPS;
    backBtn.style.visibility = state.currentStep === 1 ? "hidden" : "visible";
    const isFinal = state.currentStep === TOTAL_STEPS;
    wizardNav.style.display = isFinal ? "none" : "";
    saveState(false);
    if (state.currentStep === TOTAL_STEPS) {
      missingCheck.hidden = true;
      beginFileWork();
      setPrintButtons(true, "Fotos werden vorbereitet …");
      renderSummary().then(() => {
        endFileWork();
        if (state.currentStep === TOTAL_STEPS) {
          setPrintButtons(false, "PDF speichern");
        }
      }).catch(() => {
        endFileWork();
        setPrintButtons(true, "PDF derzeit nicht verfügbar");
        missingCheck.hidden = false;
        missingCheck.textContent = "Die Dokumentation konnte nicht vollständig vorbereitet werden. Bitte Fotos prüfen und zur Zusammenfassung zurückkehren oder die Seite neu laden. Ein unvollständiges PDF wird nicht ausgegeben.";
      });

    }
    if (scroll) {
      const activeStep = document.getElementById("step-" + state.currentStep);
      const stickyHeader = document.querySelector(".site-header");
      const headerOffset = (stickyHeader ? stickyHeader.getBoundingClientRect().height : 0) + 12;
      const targetTop = activeStep.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }
  }

  function validateCurrentStep() {
    if (state.currentStep === 1 && !state.item.name.trim()) {
      const input = document.getElementById("itemName");
      input.focus();
      input.reportValidity();
      return false;
    }
    return true;
  }

  backBtn.addEventListener("click", () => showStep(state.currentStep - 1));
  nextBtn.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    showStep(state.currentStep + 1);
  });
  finalBackBtn.addEventListener("click", () => showStep(TOTAL_STEPS - 1));
  newCaseBtn.addEventListener("click", createNewCase);
  createCaseTopBtn.addEventListener("click", createNewCase);
  caseSelect.addEventListener("change", () => openSavedCase(caseSelect.value));

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function putFile(type, blob, meta = {}) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        key: state.caseId + ":" + type,
        caseId: state.caseId,
        type,
        blob,
        mime: blob.type || meta.mime || "",
        name: meta.name || "",
        addedAt: new Date().toISOString()
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFile(type) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(state.caseId + ":" + type);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteCaseFiles(caseId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (cursor.value.caseId === caseId) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function compressImage(file) {
    const img = await fileToImage(file);
    const max = 1600;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, max / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, w, h);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Bild konnte nicht verarbeitet werden")), "image/jpeg", 0.82);
    });
  }

  function setPreview(type, record) {
    const task = document.querySelector('[data-task="' + type + '"]');
    if (!task || !record) return;
    task.classList.add("done");
    const status = task.querySelector(".photo-status");
    status.textContent = record.mime === "application/pdf" ? "PDF gespeichert ✓" : "Foto gespeichert ✓";
    const img = document.querySelector('[data-preview="' + type + '"]');
    if (img && record.mime.startsWith("image/")) {
      if (objectUrls.has(type)) URL.revokeObjectURL(objectUrls.get(type));
      const url = URL.createObjectURL(record.blob);
      objectUrls.set(type, url);
      img.src = url;
      img.classList.add("show");
    } else if (img) {
      img.classList.remove("show");
    }
  }

  async function restorePreviews() {
    for (const type of Object.keys(photoLabels)) {
      try {
        const record = await getFile(type);
        if (record) {
          setPreview(type, record);
        } else {
          const task = document.querySelector('[data-task="' + type + '"]');
          if (!task) continue;
          task.classList.remove("done");
          const status = task.querySelector(".photo-status");
          if (status) status.textContent = type === "receipt" ? "noch keine Datei" : "noch kein Foto";
          const img = task.querySelector("[data-preview]");
          if (img) {
            img.classList.remove("show");
            img.removeAttribute("src");
          }
          if (objectUrls.has(type)) {
            URL.revokeObjectURL(objectUrls.get(type));
            objectUrls.delete(type);
          }
        }
      } catch (e) {}
    }
  }

  document.querySelectorAll("[data-photo]").forEach(input => {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const type = input.dataset.photo;
      const task = document.querySelector('[data-task="' + type + '"]');
      const status = task.querySelector(".photo-status");
      status.textContent = "wird verarbeitet …";
      beginFileWork();
      try {
        const blob = await compressImage(file);
        await putFile(type, blob, { name: file.name });
        const record = await getFile(type);
        setPreview(type, record);
        saveState();
      } catch (e) {
        status.textContent = "Fehler – bitte erneut versuchen";
      } finally {
        input.value = "";
        endFileWork();
      }
    });
  });

  document.querySelectorAll("[data-attachment]").forEach(input => {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const type = input.dataset.attachment;
      const task = document.querySelector('[data-task="' + type + '"]');
      const status = task.querySelector(".photo-status");
      status.textContent = "wird gespeichert …";
      beginFileWork();
      try {
        const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
        await putFile(type, blob, { name: file.name, mime: file.type });
        const record = await getFile(type);
        setPreview(type, record);
        saveState();
      } catch (e) {
        status.textContent = "Fehler – bitte erneut versuchen";
      } finally {
        input.value = "";
        endFileWork();
      }
    });
  });

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch]));
  const display = value => value && String(value).trim() ? esc(value) : "–";

  function accessoryList() {
    const items = [];
    if (state.accessories.powerSupply) items.push("Netzteil / Ladegerät");
    if (state.accessories.cable) items.push("Kabel / Anschlussleitung");
    if (state.accessories.manual) items.push("Anleitung / Unterlagen");
    if (state.accessories.originalBox) items.push("Originalverpackung");
    if (state.accessories.other) items.push(...state.accessories.other.split("\n").map(x => x.trim()).filter(Boolean));
    return items;
  }

  function row(key, value) {
    const text = String(value ?? "");
    const isLong = text.length > 420 || text.split("\n").length > 8;
    return '<div class="summary-row' + (isLong ? ' summary-row-long' : '') +
      '"><div class="summary-key">' + esc(key) + '</div><div>' + display(value) + '</div></div>';
  }

  function formatDate(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  function formatWeight(value) {
    const v = String(value || "").trim();
    if (!v) return "";
    if (/[a-zA-Z]/.test(v)) return v;
    return v + " kg";
  }

  function renderMissingCheck(photoTypes) {
    const hints = [];
    const suggest = (message, step) => hints.push({ message, step });
    if (!String(state.party.recipient || "").trim())
      suggest("Händler / Empfänger ergänzen, falls bekannt.", 1);
    if (!state.condition.rating)
      suggest("Zustand unmittelbar vor dem Verpacken auswählen.", 2);
    if (!String(state.item.serial || "").trim())
      suggest("Seriennummer / Kennung ergänzen, falls vorhanden.", 1);
    if (!photoTypes.has("overall"))
      suggest("Eine Gesamtansicht als Foto hinzufügen, wenn möglich.", 4);
    if (!photoTypes.has("closedPackage"))
      suggest("Das verschlossene Paket fotografieren, falls noch möglich.", 4);
    if (!String(state.shipment.tracking || "").trim() &&
        (state.shipment.carrier || state.shipment.date))
      suggest("Sendungsnummer nach dem Versand ergänzen, sofern vorhanden.", 5);

    missingCheck.replaceChildren();
    missingCheck.hidden = false;
    const title = document.createElement("strong");
    title.textContent = hints.length ? "Vor dem PDF noch kurz prüfen" : "PDF bereit";
    missingCheck.appendChild(title);
    const intro = document.createElement("p");
    intro.textContent = hints.length
      ? "Diese Angaben können die Dokumentation ergänzen. Unzutreffende oder noch unbekannte Punkte darfst du überspringen – das PDF bleibt speicherbar."
      : "Keine zusätzlichen Hinweise zu den wichtigsten Angaben. Bitte prüfe die Zusammenfassung trotzdem.";
    missingCheck.appendChild(intro);
    if (!hints.length) {
      intro.classList.add("missing-ok");
      return;
    }
    const list = document.createElement("ul");
    for (const hint of hints) {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = hint.message + " ";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary";
      button.textContent = "Schritt " + hint.step + " öffnen";
      button.style.minHeight = "36px";
      button.style.padding = "4px 9px";
      button.style.margin = "4px 0";
      button.addEventListener("click", () => showStep(hint.step));
      li.append(label, button);
      list.appendChild(li);
    }
    missingCheck.appendChild(list);
  }

  async function renderSummary() {
    const summary = document.getElementById("summary");
    summaryObjectUrls.forEach(url => URL.revokeObjectURL(url));
    summaryObjectUrls = [];
    const created = document.getElementById("docCreatedDate");
    const updated = document.getElementById("docUpdatedDate");
    if (created) created.textContent = new Date(state.createdAt).toLocaleString("de-DE");
    if (updated) updated.textContent = new Date(state.updatedAt).toLocaleString("de-DE");
    const accessories = accessoryList();
    let html = '<div class="summary-card"><h3>Gegenstand</h3>' +
      row("Bezeichnung", state.item.name) +
      row("Hersteller", state.item.manufacturer) +
      row("Modell", state.item.model) +
      row("Seriennummer / Kennung", state.item.serial) +
      row("Absender", state.party.sender) +
      row("Empfänger", state.party.recipient) +
      row("Rücksendegrund", state.item.reason) +
      '</div>';

    html += '<div class="summary-card"><h3>Zustand und Zubehör</h3>' +
      row("Zustand", state.condition.rating) +
      row("Beschreibung", state.condition.note) +
      row("Mitgesendet", accessories.length ? accessories.join(", ") : "") +
      '</div>';

    html += '<div class="summary-card"><h3>Versand</h3>' +
      row("Paketdienst", state.shipment.carrier) +
      row("Sendungsnummer", state.shipment.tracking) +
      row("Versanddatum", formatDate(state.shipment.date)) +
      row("Paketgewicht", formatWeight(state.shipment.weight)) +
      row("Dokumentation erstellt", new Date(state.createdAt).toLocaleString("de-DE")) +
      row("Zuletzt geändert", new Date(state.updatedAt).toLocaleString("de-DE")) +
      '</div>';

    html += '<div class="summary-card photo-summary-card"><h3>Fotodokumentation und Belege</h3><div class="summary-photos" id="summaryPhotos"></div></div>';
    summary.innerHTML = html;
    summary.querySelectorAll(".summary-card").forEach(card => {
      if (card.querySelector(".summary-row-long")) {
        card.classList.add("summary-card-long");
      }
    });

    // Ein bereits hochgeladenes PDF lässt sich nicht verlässlich in den
    // mobilen Browserdruck einbetten. Es wird deshalb getrennt ausgewiesen
    // und als Originaldatei zum Herunterladen angeboten.
    const receipt = await getFile("receipt");
    const receiptIsPdf = receipt &&
      (receipt.mime === "application/pdf" || (receipt.name || "").toLowerCase().endsWith(".pdf"));
    if (receiptIsPdf) {
      const shippingCard = summary.querySelectorAll(".summary-card")[2];
      const receiptRow = document.createElement("div");
      receiptRow.className = "summary-row";
      const key = document.createElement("div");
      key.className = "summary-key";
      key.textContent = "Einlieferungsbeleg";
      const value = document.createElement("div");
      const printed = document.createElement("div");
      printed.className = "receipt-print-note";
      printed.textContent = "Original-PDF separat beifügen: " + (receipt.name || "Einlieferungsbeleg.pdf");
      value.appendChild(printed);
      const help = document.createElement("div");
      help.className = "hint screen-only receipt-help";
      help.textContent = "Die Original-PDF ist nicht in der erstellten Dokumentation enthalten. Bitte beide Dateien speichern und gemeinsam weitergeben.";
      value.appendChild(help);
      const link = document.createElement("a");
      link.className = "btn btn-secondary screen-only receipt-download";
      link.textContent = "Original-PDF speichern";
      link.download = receipt.name || "Einlieferungsbeleg.pdf";
      const receiptUrl = URL.createObjectURL(receipt.blob);
      summaryObjectUrls.push(receiptUrl);
      link.href = receiptUrl;
      value.appendChild(link);
      receiptRow.append(key, value);
      shippingCard.appendChild(receiptRow);
    }

    const photos = document.getElementById("summaryPhotos");
    const presentPhotoTypes = new Set();
    for (const [type, label] of Object.entries(photoLabels)) {
      const record = await getFile(type);
      if (!record) continue;
      presentPhotoTypes.add(type);
      if (type === "receipt" && receiptIsPdf) continue;
      const box = document.createElement("div");
      box.className = "summary-photo";
      if (record.mime.startsWith("image/")) {
        const url = URL.createObjectURL(record.blob);
        summaryObjectUrls.push(url);
        const img = document.createElement("img");
        img.src = url;
        img.alt = label;
        box.appendChild(img);
      } else {
        const p = document.createElement("p");
        p.textContent = "Datei: " + (record.name || "PDF-Beleg");
        box.appendChild(p);
      }
      const strong = document.createElement("strong");
      strong.textContent = label;
      box.appendChild(strong);
      const small = document.createElement("div");
      small.className = "hint";
      small.textContent = "dem Vorgang hinzugefügt: " + new Date(record.addedAt).toLocaleString("de-DE");
      box.appendChild(small);
      photos.appendChild(box);
    }
    if (!photos.children.length) photos.innerHTML = '<p class="small">Noch keine Fotos oder Belege hinzugefügt.</p>';
    // Ausschließlich die Druckdarstellung verwendet bei genau drei
    // Bildern drei gleich breite Spalten. Bildschirm-Layout unverändert.
    photos.classList.toggle("print-three-images",
      photos.querySelectorAll(".summary-photo").length === 3);
    // Warten, bis die Foto-Vorschauen decodiert sind, bevor der Druckknopf
    // freigegeben wird. window.print() selbst bleibt synchron im Klick-Handler.
    const images = [...photos.querySelectorAll("img")];
    await Promise.all(images.map(async img => {
      try {
        if (typeof img.decode === "function") await img.decode();
        else if (!img.complete) await new Promise(resolve => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
        if (!img.naturalWidth) throw new Error("Bild konnte nicht geladen werden");
      } catch (e) {
        const warning = document.createElement("p");
        warning.className = "receipt-print-note";
        warning.textContent = "Dieses Bild konnte nicht geladen werden. Bitte das Foto erneut hinzufügen.";
        img.replaceWith(warning);
      }
    }));
    renderMissingCheck(presentPhotoTypes);
  }

  [finalPrintBtn, finalPrintBtnBottom].filter(Boolean).forEach(btn => {
    btn.addEventListener("click", () => window.print());
  });

  document.getElementById("deleteBtn").addEventListener("click", async () => {
    if (fileBusyCount) {
      alert("Bitte warten, bis das Foto gespeichert wurde.");
      return;
    }
    if (!confirm("Nur diesen Vorgang einschließlich seiner Fotos und Belege löschen? Andere gespeicherte Vorgänge bleiben erhalten.")) return;
    const oldCase = state.caseId;
    try {
      await deleteCaseFiles(oldCase);
    } catch (e) {
      alert("Die Dateien konnten nicht gelöscht werden. Bitte erneut versuchen.");
      return;
    }
    resetCaseImages();
    try { localStorage.removeItem(caseStorageKey(oldCase)); } catch (e) {}
    caseIndex.ids = caseIndex.ids.filter(id => id !== oldCase);
    let next = null;
    for (const id of caseIndex.ids) {
      try {
        next = JSON.parse(localStorage.getItem(caseStorageKey(id)) || "null");
        if (next && next.caseId === id) break;
      } catch (e) {}
      next = null;
    }
    state = next || defaultState();
    caseIndex.activeId = state.caseId;
    form.reset();
    hydrateForm();
    saveState(false);
    await restorePreviews();
    showStep(next ? (state.currentStep || 1) : 1);
  });

  CaseBackup.mount({
    helper: "retoure", defaultState, types: Object.keys(photoLabels),
    openDb, storeName: STORE_NAME, prefix: CASE_PREFIX,
    getState: () => state, isBusy: () => fileBusyCount > 0,
    begin: beginFileWork, end: endFileWork,
    onImported: async imported => {
      resetCaseImages();
      state = imported;
      form.reset();
      hydrateForm();
      saveState(false);
      await restorePreviews();
      showStep(1);
    }
  });

  hydrateForm();
  bindAutosave();
  restorePreviews();
  showStep(state.currentStep || 1, false);
})();