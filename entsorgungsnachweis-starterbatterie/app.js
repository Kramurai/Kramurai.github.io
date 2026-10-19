(() => {
  "use strict";

  const STORAGE_KEY = "kramurai-battery-v1";
  const DB_NAME = "kramurai-local";
  const STORE_NAME = "files";
  const CASES_KEY = STORAGE_KEY + "-cases-v2";
  const CASE_PREFIX = STORAGE_KEY + ":case:";
  const caseStorageKey = id => CASE_PREFIX + id;
  const TOTAL_STEPS = 3;
  const photoLabels = {battery:"Starterbatterie / Kennzeichnung",receipt:"Bestätigter Rückgabenachweis"};
  const defaultState = () => ({version:1,caseId:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),currentStep:1,
    item:{name:""},person:{name:"",street:"",city:""},battery:{quantity:"1",type:"Gebrauchte Fahrzeug-Starterbatterie",capacity:"",notes:""},
    returned:{status:"vorbereitung",date:"",collectionSite:"",refund:"unbekannt"},
    proof:{status:"offen",issuedDate:"",seller:"",reference:"",submittedDate:"",refundStatus:"offen",refundDate:""}});
  const normaliseState = saved => saved;
  let caseIndex = { ids: [], activeId: "" };
  let fileBusyCount = 0;
  let state = normaliseState(loadState());
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
  const entryResumeBtn = document.getElementById("entryResumeBtn");
  const entryNewCaseBtn = document.getElementById("entryNewCaseBtn");
  const entryHint = document.querySelector(".result-effort");
  const entryStartLabel = entryResumeBtn.textContent;
  const entryStartHint = entryHint.textContent;


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
    const hasDraft = Boolean(state.item.name.trim()) || state.currentStep > 1;
    entryResumeBtn.textContent = hasDraft ? "Vorgang fortsetzen" : entryStartLabel;
    entryResumeBtn.disabled = busy;
    entryNewCaseBtn.hidden = !hasDraft;
    entryNewCaseBtn.disabled = busy;
    entryHint.textContent = hasDraft
      ? "Aktueller Vorgang: " + (state.item.name.trim() || "Ohne Bezeichnung") + " · Schritt " + state.currentStep + " von " + TOTAL_STEPS
      : entryStartHint;

    document.querySelectorAll("[data-photo], [data-attachment], [data-remove-file]").forEach(control => { control.disabled = busy; });
    // Die Zusammenfassung darf erst nach dem Speichern aller Fotos entstehen.
    nextBtn.disabled = busy;
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
    beginFileWork();
    setPrintButtons(true, "Vorgang wird geöffnet …");
    try {
      resetCaseImages();
      state = normaliseState(saved);
      form.reset();
      hydrateForm();
      saveState(false);
      await restorePreviews();
      showStep(state.currentStep || 1);
    } finally { endFileWork(); }
  }

  async function createNewCase() {
    if (fileBusyCount) {
      alert("Bitte warten, bis das Foto gespeichert wurde.");
      return;
    }
    saveState(false);
    beginFileWork();setPrintButtons(true,"Vorgang wird vorbereitet …");
    try {
      resetCaseImages();state=defaultState();form.reset();hydrateForm();saveState(false);
      await restorePreviews();showStep(1);
    } finally {endFileWork();}
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

  function updateReturnFields() {
    const given=state.returned.status === "abgegeben";
    document.querySelector('[for="returnDate"]').textContent=given ? "Datum der tatsächlichen Rückgabe" : "Geplantes Datum der Rückgabe";
    document.getElementById("actualReturnFields").hidden=!given;
    document.getElementById("proofDateFields").hidden=state.proof.status !== "vorhanden";
  }
  function hydrateForm() {
    updateReturnFields();
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
        if(["returnStatus","proofStatus"].includes(el.id)) updateReturnFields();
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
    if(state.currentStep===1) {
      for(const id of ["itemName","quantity"]) {const input=document.getElementById(id);if(!input.checkValidity() || (id==="itemName" && !state.item.name.trim())){input.focus();input.reportValidity();return false;}}
    }
    return true;
  }

  entryResumeBtn.addEventListener("click", () => {
    if (!fileBusyCount) showStep(state.currentStep || 1);
  });
  entryNewCaseBtn.addEventListener("click", createNewCase);

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
      tx.onabort = () => reject(tx.error || new Error("Datei konnte nicht gespeichert werden"));
      tx.onerror = () => {};
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
      tx.onabort = () => reject(tx.error || new Error("Datei konnte nicht gespeichert werden"));
      tx.onerror = () => {};
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
    if(file.size > 20 * 1024 * 1024) throw new Error("Das Foto ist größer als 20 MB.");
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
        status.textContent = "Fehler – die bisherige Datei bleibt erhalten. Bitte eine gültige Bild- oder PDF-Datei bis 20 MB wählen.";
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
        if(file.size > 20 * 1024 * 1024) throw new Error("Die Datei ist größer als 20 MB.");
        if(!file.type.startsWith("image/") && (file.type !== "application/pdf" || new TextDecoder().decode(await file.slice(0,5).arrayBuffer()) !== "%PDF-")) throw new Error("Bitte ein Bild oder eine PDF-Datei wählen.");
        const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
        await putFile(type, blob, { name: file.name, mime: file.type });
        const record = await getFile(type);
        setPreview(type, record);
        saveState();
      } catch (e) {
        status.textContent = "Fehler – die bisherige Datei bleibt erhalten. Bitte eine gültige Bild- oder PDF-Datei bis 20 MB wählen.";
      } finally {
        input.value = "";
        endFileWork();
      }
    });
  });

  form.addEventListener("click", async event => {
    const button = event.target.closest("[data-remove-file]");
    if (!button || fileBusyCount) return;
    const type = button.dataset.removeFile;
    if (!Object.prototype.hasOwnProperty.call(photoLabels, type)) return;
    if (!confirm("Diese Datei aus diesem Vorgang entfernen? Andere Fotos und Vorgänge bleiben erhalten.")) return;
    const caseId = state.caseId;
    beginFileWork();
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(caseId + ":" + type);
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error("Entfernen fehlgeschlagen"));
        tx.onerror = () => {};
      });
      await restorePreviews();
      saveState();
      const status = button.closest("[data-task]").querySelector(".photo-status");
      status.textContent = type === "receipt" ? "Beleg entfernt" : "Foto entfernt";
    } catch (_) {
      alert("Die Datei konnte nicht entfernt werden. Bitte erneut versuchen.");
    } finally {
      endFileWork();
      const input = document.querySelector('[data-task="' + type + '"] input[type="file"]');
      if (input) input.focus();
    }
  });

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join(".") : value;
  function row(key,value,required=false) {
    const text=String(value || "").trim();
    if(!text && !required) return "";
    const long=text.length>420 || text.split("\n").length>8;
    return '<div class="summary-row'+(long?' summary-row-long':'')+'"><div class="summary-key">'+esc(key).replaceAll('/', '/<wbr>')+'</div><div>'+esc(text || 'Nicht dokumentiert')+'</div></div>';
  }
  function card(title, content) {return '<section class="summary-card"><h3>'+esc(title)+'</h3>'+content+'</section>';}
  function checks() {
    const notes=[],warnings=[],r=state.returned,p=state.proof;
    const today=new Date(),todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
    if(!r.collectionSite.trim())notes.push("Annahmestelle noch nicht dokumentiert.");
    if(!Number.isInteger(Number(state.battery.quantity)) || Number(state.battery.quantity)<1 || Number(state.battery.quantity)>50)warnings.push("Die Anzahl der Starterbatterien muss eine ganze Zahl zwischen 1 und 50 sein.");
    if(r.status==="abgegeben") {
      if(!r.date)notes.push("Das tatsächliche Rückgabedatum fehlt.");
      if(r.date>todayKey)warnings.push("Die als erfolgt bezeichnete Rückgabe liegt in der Zukunft.");
      if(r.refund==="unbekannt")notes.push("Noch offen: Hat die Annahmestelle Pfand erstattet?");
      if(r.refund==="ja")warnings.push("Nach eigener Angabe wurde bei der Rücknahme bereits Pfand erstattet. Für diese Rücknahme keine erneute Pfanderstattung beanspruchen.");
      if(p.status==="vorhanden") {
        if(!p.issuedDate)notes.push("Ausstellungsdatum des tatsächlichen Rückgabenachweises noch offen.");
        if(p.issuedDate>todayKey)warnings.push("Der als vorhanden bezeichnete Nachweis ist in der Zukunft ausgestellt.");
        if(p.issuedDate && r.date && p.issuedDate<r.date)warnings.push("Der Nachweis ist vor der tatsächlichen Rückgabe ausgestellt. Bitte die Daten prüfen.");
        if(p.issuedDate && p.submittedDate && p.submittedDate<p.issuedDate)warnings.push("Die Einreichung liegt vor der Ausstellung des Nachweises.");
        const end=p.submittedDate || todayKey;
        if(p.issuedDate && /^\d{4}-\d{2}-\d{2}$/.test(p.issuedDate) && (Date.parse(end+"T00:00:00Z")-Date.parse(p.issuedDate+"T00:00:00Z"))/86400000>14)warnings.push(p.submittedDate ? "Der Nachweis war laut diesen Daten bei Einreichung älter als zwei Wochen. Bitte den Verlauf mit dem Händler klären." : "Der Nachweis ist inzwischen älter als zwei Wochen. Bei einer jetzigen Vorlage beim Fernabsatzhändler wäre die gesetzliche Altersgrenze überschritten; bei früherer Einreichung das tatsächliche Datum ergänzen.");
      }
    } else if(p.submittedDate || p.refundStatus!=="offen" || p.refundDate)warnings.push("Ein Pfandverlauf ist eingetragen, die Rückgabe steht noch auf Vorbereitung. Bitte den Stand prüfen.");
    if(p.submittedDate>todayKey)warnings.push("Die als erfolgt eingetragene Einreichung liegt in der Zukunft.");
    if(p.refundStatus==="erhalten" && !p.refundDate)notes.push("Datum der erhaltenen Erstattung noch offen.");
    if(p.refundStatus==="erhalten" && p.refundDate>todayKey)warnings.push("Die als erhalten bezeichnete Erstattung liegt in der Zukunft.");
    if(p.refundStatus!=="erhalten" && p.refundDate)warnings.push("Ein Erstattungsdatum ist eingetragen, der Erstattungsstand bestätigt aber keinen Zahlungseingang.");
    missingCheck.replaceChildren();missingCheck.hidden=false;
    const title=document.createElement("strong");title.textContent=notes.length||warnings.length ? "Vor dem PDF noch prüfen" : "PDF bereit";missingCheck.append(title);
    for(const t of [...warnings,...notes]){const line=document.createElement("p");line.textContent=t;missingCheck.append(line)}
    return warnings;
  }
  async function renderSummary() {
    summaryObjectUrls.forEach(url=>URL.revokeObjectURL(url));summaryObjectUrls=[];
    document.getElementById("docUpdatedDate").textContent=new Date(state.updatedAt).toLocaleString("de-DE");
    const summary=document.getElementById("summary"),r=state.returned,p=state.proof,given=r.status==="abgegeben";
    const records=await Promise.all(Object.keys(photoLabels).map(async type=>({type,record:await getFile(type)})));
    const visible=records.filter(f=>f.record),warnings=checks();
    let html=warnings.map(w=>'<p class="warning">Prüfhinweis: '+esc(w)+'</p>').join("");
    html+=card("Angaben zur Rückgabe",row("Vorgang",state.item.name,true)+row("Anzahl Starterbatterien",state.battery.quantity,true)+row("Batterietyp",state.battery.type,true)+row("Kapazität / Zusatzangabe",state.battery.capacity)+row("Name",state.person.name)+row("Straße / Hausnummer",state.person.street)+row("PLZ / Ort",state.person.city)+row("Annahmestelle",r.collectionSite,true)+row(given ? "Tatsächliche Rückgabe am (eigene Angabe)" : "Rückgabe geplant für",formatDate(r.date))+row("Bemerkungen",state.battery.notes));
    html+=card("Stand und Bestätigung",'<p class="phase-status status-open">'+(given ? "Rückgabe laut eigener Angabe erfolgt. Diese PDF allein bestätigt weder die Annahme noch deren Umstände." : "Rückgabe wird vorbereitet. Ein geplantes Datum ist kein Nachweis einer tatsächlichen Rücknahme.")+'</p>'+(given ? row("Pfand bei Annahmestelle",{unbekannt:"Nicht dokumentiert",nein:"Laut eigener Angabe ohne Pfanderstattung",ja:"Laut eigener Angabe bereits erstattet"}[r.refund],true)+row("Bestätigter Nachweis",p.status==="vorhanden" ? "Laut eigener Angabe vorhanden; siehe Originalbeleg" : "Noch nicht erhalten / noch zu klären")+(p.status==="vorhanden" ? row("Ausgestellt am",formatDate(p.issuedDate),true) : "") : ""));
    if((!given || r.refund!=="ja") && (!given || p.status!=="vorhanden"))html+='<section class="summary-card battery-signature"><h3>Bestätigung durch die Annahmestelle</h3><p class="hint">Vorlage zum Ausfüllen nach der tatsächlichen Rücknahme. Nur durch die Annahmestelle bestätigen lassen, wenn die Aussage zutrifft. Bis dahin keine Rücknahmebestätigung.</p><p>Wir bestätigen die tatsächliche Rücknahme der oben bezeichneten Starteraltbatterie(n), ohne hierfür Batteriepfand zu erstatten.</p><div class="signature-space">Tatsächliches Rückgabedatum: __________________________<br><br>Ort / Datum der Ausstellung: __________________________<div class="signature-line"></div>Name / Stempel und Unterschrift der Annahmestelle</div></section>';
    const tracking=p.seller.trim() || p.reference.trim() || p.submittedDate || p.refundStatus!=="offen" || p.refundDate;
    if(tracking)html+=card("Eigene Notizen zum Pfandverlauf",row("Pfand erhebender Händler",p.seller)+row("Bestellung / Rechnung",p.reference)+row("Nachweis eingereicht am",formatDate(p.submittedDate))+row("Erstattungsstand",{offen:"Nicht dokumentiert",angefragt:"Angefragt / noch offen",erhalten:"Laut eigener Angabe erhalten"}[p.refundStatus])+row("Erstattung erhalten am",p.refundStatus==="erhalten" ? formatDate(p.refundDate) : ""));
    html+=card("Hinweis zum Nachweis","<p>Beim Fernabsatzhändler darf der tatsächliche Rückgabenachweis bei Vorlage nicht älter als zwei Wochen sein (§ 19 Abs. 2 BattDG). Das Erstellen oder erneute Speichern dieser Vorlage setzt die Frist nicht zurück. Ein schriftlicher oder elektronischer Nachweis der Annahmestelle ist erforderlich.</p><p class=\"hint\">https://www.gesetze-im-internet.de/battdg/__19.html · Hinweise geprüft am 19.10.2026</p>");
    if(visible.length)html+='<section class="summary-card photo-summary-card"><h3>Foto und Originalbeleg</h3><div class="summary-photos" id="summaryPhotos"></div><div id="summaryReceipt"></div></section>';
    else html+='<div class="screen-only"><div id="summaryPhotos"></div><div id="summaryReceipt"></div><p>Keine Fotos oder Belege hinzugefügt.</p></div>';
    summary.innerHTML=html;
    summary.querySelectorAll('.summary-card').forEach(c=>{if(c.querySelector('.summary-row-long'))c.classList.add('summary-card-long')});
    const photos=document.getElementById('summaryPhotos');
    for(const {type,record} of visible) {
      const url=URL.createObjectURL(record.blob);summaryObjectUrls.push(url);
      if(type==='receipt' && record.mime==='application/pdf') {
        const target=document.getElementById('summaryReceipt');
        const note=document.createElement('p');note.className='receipt-print-note';note.textContent='PDF-Beleg separat beifügen: '+(record.name || 'Rueckgabenachweis.pdf');
        const help=document.createElement('p');help.className='hint screen-only';help.textContent='Dieser PDF-Beleg ist nicht in die erzeugte Dokumentation eingebettet. Bitte beide Dateien speichern und gemeinsam weitergeben.';
        const link=document.createElement('a');link.href=url;link.download=record.name || 'Rueckgabenachweis.pdf';link.className='btn btn-secondary screen-only receipt-download';link.textContent='Original-PDF speichern';target.append(note,help,link);continue;
      }
      const figure=document.createElement('figure');figure.className='summary-photo';figure.style.margin='0';
      const img=document.createElement('img');img.src=url;img.alt=photoLabels[type];
      const cap=document.createElement('figcaption'),strong=document.createElement('strong');strong.textContent=photoLabels[type];
      const added=document.createElement('span');added.className='hint';added.textContent='Datei hinzugefügt: '+new Date(record.addedAt).toLocaleString('de-DE');cap.append(strong,added);figure.append(img,cap);photos.append(figure);
    }
    if(!visible.length) photos.textContent='Keine Fotos oder Belege hinzugefügt.';
    await Promise.all([...photos.querySelectorAll('img')].map(async img=>{await img.decode();if(!img.naturalWidth) throw new Error('Foto konnte nicht geladen werden')}));
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
    beginFileWork();setPrintButtons(true,"Vorgang wird gelöscht …");
    const oldCase = state.caseId;
    try {
      await deleteCaseFiles(oldCase);
    } catch (e) {
      endFileWork();
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
    state = next ? normaliseState(next) : defaultState();
    caseIndex.activeId = state.caseId;
    form.reset();
    hydrateForm();
    saveState(false);
    await restorePreviews();
    showStep(next ? (state.currentStep || 1) : 1);
    endFileWork();
  });

  CaseBackup.mount({
    helper: "battery", defaultState, migrateState: normaliseState, types: Object.keys(photoLabels),
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
