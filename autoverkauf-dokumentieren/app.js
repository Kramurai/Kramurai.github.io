(() => {
  "use strict";

  const STORAGE_KEY = "kramurai-car-sale-v1";
  const DB_NAME = "kramurai-local";
  const STORE_NAME = "files";
  const CASES_KEY = STORAGE_KEY + "-cases-v2";
  const CASE_PREFIX = STORAGE_KEY + ":case:";
  const caseStorageKey = id => CASE_PREFIX + id;
  const TOTAL_STEPS = 6;
  const photoLabels = {
    "overall": "Gesamtansicht des Fahrzeugs",
    "serial": "FIN / Fahrzeugkennzeichnung",
    "odometer": "Kilometerstand im Display",
    "damage": "Mangel oder Schaden – Detail 1",
    "damage2": "Mangel oder Schaden – Detail 2",
    "interior": "Innenraum",
    "accessories": "Zubehör / übergebene Schlüssel",
    "receipt": "Beleg zur Zahlung oder Übergabe"
};

  const defaultState = () => ({
    version: 1,
    caseId: (crypto.randomUUID ? crypto.randomUUID() : "case-" + Date.now()),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentStep: 1,
    item: { name: "", manufacturer: "", model: "", serial: "", registration: "", firstRegistration: "", mileage: "", hu: "" },
    party: { seller: "", buyer: "", sellerContact: "", buyerContact: "" },
    condition: { rating: "", note: "", accidents: "", checkedAt: "", damageHistory: "", repairs: "", inspection: "" },
    accessories: { extraWheels: false, chargingCable: false, tools: false, manual: false, other: "" },
    documents: { partI: false, partII: false, hu: false, service: false, invoices: false, other: "", contractStatus: "", contractNote: "" },
    payment: { price: "", amount: "", status: "", method: "", date: "", note: "" },
    handover: { status: "", registered: "", date: "", time: "", place: "", mileage: "", keyCount: "", vehicle: false, keys: false, partI: false, partII: false, accessories: false, papers: false, remote: false, note: "" },
    followup: { insurance: false, registration: false, note: "" }
  });

  let caseIndex = { ids: [], activeId: "" };
  let fileBusyCount = 0;
  let state = loadState();
  let summaryObjectUrls = [];
  let dbPromise;
  const objectUrls = new Map();

  const form = document.getElementById("saleForm");
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
    // Die Zusammenfassung darf erst nach dem Speichern aller Fotos entstehen.
    nextBtn.disabled = busy;
    document.querySelectorAll("[data-remove-file]").forEach(button => { button.disabled = busy; });
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
    if (isFinal) {
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
      // Nach einem Schrittwechsel beginnt die Tastaturbedienung beim neuen Inhalt.
      const heading = activeStep.querySelector("h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
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
    task.querySelector("[data-remove-file]").hidden = false;
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
          task.querySelector("[data-remove-file]").hidden = true;
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

  document.querySelectorAll("[data-remove-file]").forEach(button => {
    button.addEventListener("click", async () => {
      if (fileBusyCount || !confirm("Diese Datei aus diesem Vorgang entfernen? Andere Fotos und Vorgänge bleiben erhalten.")) return;
      beginFileWork();
      try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).delete(state.caseId + ":" + button.dataset.removeFile);
          tx.oncomplete = resolve;
          tx.onabort = () => reject(tx.error);
          tx.onerror = () => {};
        });
        await restorePreviews();
        saveState();
      } catch (_) {
        alert("Die Datei konnte nicht entfernt werden. Bitte erneut versuchen.");
      } finally { endFileWork(); }
    });
  });

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch]));
  const display = value => value && String(value).trim() ? esc(value) : "–";

  function markedList(group, labels) {
    return Object.entries(labels).filter(([key]) => group[key] === true).map(([, label]) => label).join(", ");
  }
  const accessoryLabels = {extraWheels:"Zusätzlicher Radsatz", chargingCable:"Ladekabel", tools:"Bordwerkzeug / Pannenset", manual:"Betriebsanleitung"};
  const documentLabels = {partI:"Zulassungsbescheinigung Teil I", partII:"Zulassungsbescheinigung Teil II", hu:"HU-Bericht", service:"Serviceheft / Wartungsnachweise", invoices:"Reparaturrechnungen / Prüfnachweise"};
  const handoverLabels = {vehicle:"Fahrzeug übergeben", keys:"Schlüssel übergeben", partI:"Teil I ausgehändigt", partII:"Teil II ausgehändigt", accessories:"Erfasstes Zubehör übergeben", papers:"Weitere Unterlagen übergeben", remote:"Persönliche Fahrzeugkonten / Fernzugriffe getrennt"};
  function money(value) {
    const text = String(value || "").trim();
    return text ? text + " €" : "";
  }
  function moneyNumber(value) {
    const text = String(value || "").trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
    return Number(text.replaceAll(".", "").replace(",", "."));
  }

  function row(key, value) {
    const text = String(value ?? "");
    const isLong = text.length > 420 || text.split("\n").length > 8;
    return '<div class="summary-row' + (isLong ? ' summary-row-long' : '') +
      '"><div class="summary-key">' + esc(key).replaceAll('/', '/<wbr>') + '</div><div>' + display(value) + '</div></div>';
  }

  function formatDate(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  function renderMissingCheck(photoTypes) {
    const hints = [];
    const suggest = (message, step) => hints.push({ message, step });
    if (!state.item.serial.trim()) suggest("FIN ergänzen, falls bekannt.", 1);
    if (!state.condition.rating) suggest("Zustand nach eigener Einschätzung ergänzen.", 2);
    if (!photoTypes.has("overall")) suggest("Eine Gesamtansicht ergänzen, wenn möglich.", 4);
    if (!state.documents.contractStatus || state.documents.contractStatus !== "Von beiden Parteien unterschrieben")
      suggest("Der separate Kaufvertrag ist noch nicht als beidseitig unterschrieben erfasst. Diese Dokumentation ersetzt ihn nicht.", 3);
    if (state.handover.status === "Erfolgt") {
      if (!state.party.seller.trim() || !state.party.buyer.trim()) suggest("Namen von Verkäufer und Käufer ergänzen.", 1);
      if (!state.handover.date || !state.handover.time) suggest("Datum und Uhrzeit der erfolgten Übergabe ergänzen.", 5);
      if (!state.payment.status) suggest("Tatsächlichen Zahlungsstand ergänzen.", 5);
      if (!state.handover.vehicle) suggest("Prüfen, ob das Fahrzeug als tatsächlich übergeben markiert werden soll.", 5);
    }
    if (state.handover.status !== "Erfolgt" && Object.keys(handoverLabels).some(key => state.handover[key]))
      suggest("Erledigte Übergabepunkte sind markiert, die Übergabe aber nicht als erfolgt. Bitte die Angaben prüfen.", 5);
    const price = moneyNumber(state.payment.price), amount = moneyNumber(state.payment.amount);
    if (state.payment.status === "Vollständig erhalten" && price !== null && amount !== null && amount < price)
      suggest("Als vollständig bezahlt erfasst, der erhaltene Betrag ist aber kleiner als der notierte Kaufpreis. Bitte prüfen.", 5);
    if (state.payment.price.trim() && price === null) suggest("Kaufpreis im Format 4.500,00 prüfen.", 5);
    if (state.payment.amount.trim() && amount === null) suggest("Erhaltenen Betrag im Format 500,00 prüfen.", 5);
    if (state.handover.registered === "Zugelassen" && state.handover.status === "Erfolgt" && (!state.followup.insurance || !state.followup.registration))
      suggest("Verkaufsmeldungen an Versicherung und Zulassungsstelle noch prüfen und dokumentieren.", 5);

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
    let html = '<div class="summary-card"><h3>Fahrzeug und Beteiligte</h3>' +
      row("Fahrzeug", state.item.name) + row("Hersteller", state.item.manufacturer) + row("Modell / Variante", state.item.model) +
      row("FIN", state.item.serial) + row("Kennzeichen", state.item.registration) + row("Erstzulassung", formatDate(state.item.firstRegistration)) +
      row("Abgelesener Kilometerstand", state.item.mileage ? state.item.mileage + " km" : "") + row("Nächste HU", state.item.hu) +
      row("Verkäufer", state.party.seller) + row("Kontakt / Anschrift Verkäufer", state.party.sellerContact) +
      row("Käufer", state.party.buyer) + row("Kontakt / Anschrift Käufer", state.party.buyerContact) + '</div>';
    html += '<div class="summary-card"><h3>Zustand nach eigener Angabe</h3>' +
      row("Eigene Einschätzung", state.condition.rating) + row("Bekannte Mängel / Schäden", state.condition.note) +
      row("Kenntnis zu Unfall- und Vorschäden", state.condition.accidents) + row("Schäden genauer beschrieben", state.condition.damageHistory) +
      row("Zustandsaufnahme am", formatDate(state.condition.checkedAt)) + row("Reparaturen / Wartung / Belege", state.condition.repairs) +
      row("Besichtigung / Probefahrt / Prüfung", state.condition.inspection) + '</div>';
    html += '<div class="summary-card"><h3>Zubehör, Unterlagen und separater Vertrag</h3>' +
      row("Zum Verkauf gehörendes Zubehör", markedList(state.accessories, accessoryLabels) || "Nicht als vorhanden erfasst") +
      row("Zubehör / Ausnahmen", state.accessories.other) + row("Vorliegende Unterlagen", markedList(state.documents, documentLabels) || "Nicht als vorhanden erfasst") +
      row("Weitere / fehlende Unterlagen", state.documents.other) + row("Separater Kaufvertrag", state.documents.contractStatus) + row("Hinweis zum Vertrag / Anlagen", state.documents.contractNote) + '</div>';
    html += '<div class="summary-card"><h3>Zahlung nach eigener Angabe</h3>' +
      row("Notierter Kaufpreis", money(state.payment.price)) + row("Erhaltener Betrag", money(state.payment.amount)) +
      row("Zahlungsstand", state.payment.status) + row("Zahlungsart", state.payment.method) + row("Zahlungseingang am", formatDate(state.payment.date)) + row("Notizen / Beleg / offene Punkte", state.payment.note) + '</div>';
    html += '<div class="summary-card"><h3>Übergabe und Nachbereitung</h3>' +
      row("Stand der Übergabe", state.handover.status || "Noch nicht dokumentiert") + row("Zulassungsstand bei Übergabe", state.handover.registered) +
      row("Übergabedatum (geplant / erfolgt)", formatDate(state.handover.date)) + row("Uhrzeit", state.handover.time) + row("Ort", state.handover.place) +
      row("Abgelesener Kilometerstand bei Übergabe", state.handover.mileage ? state.handover.mileage + " km" : "") + row("Übergebene Schlüssel (Anzahl)", state.handover.keyCount) +
      row("Als tatsächlich erledigt markiert", markedList(state.handover, handoverLabels) || "Keine Übergabepunkte als erledigt markiert") +
      row("Abweichungen / offene Punkte", state.handover.note) +
      row("Verkaufsmeldungen als erledigt markiert", markedList(state.followup, {insurance:"Versicherung", registration:"Zulassungsstelle"}) || "Keine Meldungen als erledigt markiert") +
      row("Notizen zur Nachbereitung", state.followup.note) + '</div>';

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
      const paymentCard = summary.querySelectorAll(".summary-card")[3];
      const receiptRow = document.createElement("div");
      receiptRow.className = "summary-row";
      const key = document.createElement("div");
      key.className = "summary-key";
      key.textContent = "Beleg zur Zahlung oder Übergabe";
      const value = document.createElement("div");
      const printed = document.createElement("div");
      printed.className = "receipt-print-note";
      printed.textContent = "Original-PDF separat beifügen: " + (receipt.name || "Zahlungs-oder-Uebergabebeleg.pdf");
      value.appendChild(printed);
      const help = document.createElement("div");
      help.className = "hint screen-only receipt-help";
      help.textContent = "Die Original-PDF ist nicht in der erstellten Dokumentation enthalten. Bitte beide Dateien speichern und gemeinsam weitergeben.";
      value.appendChild(help);
      const link = document.createElement("a");
      link.className = "btn btn-secondary screen-only receipt-download";
      link.textContent = "Original-PDF speichern";
      link.download = receipt.name || "Zahlungs-oder-Uebergabebeleg.pdf";
      const receiptUrl = URL.createObjectURL(receipt.blob);
      summaryObjectUrls.push(receiptUrl);
      link.href = receiptUrl;
      value.appendChild(link);
      receiptRow.append(key, value);
      paymentCard.appendChild(receiptRow);
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
    // In der Druckansicht bleiben Bildpaare zusammen. Bei ungerader
    // Anzahl stehen die letzten drei Bilder als Gruppe auf einer Seite,
    // damit ein einzelner Beleg nicht allein auf einer Folgeseite steht.
    // display:contents erhält die bisherige Bildschirm-Anordnung.
    const photoCards = [...photos.querySelectorAll(".summary-photo")];
    if (photoCards.length >= 5) {
      photos.classList.add("print-photo-rows");
      const pairedCount = photoCards.length % 2 ? photoCards.length - 3 : photoCards.length;
      for (let i = 0; i < photoCards.length;) {
        const photoRow = document.createElement("div");
        photoRow.className = "summary-photo-row";
        const count = i < pairedCount ? 2 : 3;
        photoCards.slice(i, i + count).forEach(card => photoRow.appendChild(card));
        photos.appendChild(photoRow);
        i += count;
      }
    }
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
    helper: "car-sale", defaultState, types: Object.keys(photoLabels),
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
