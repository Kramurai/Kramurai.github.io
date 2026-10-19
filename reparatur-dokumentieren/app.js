(() => {
  "use strict";

  const STORAGE_KEY = "kramurai-repair-v1";
  const DB_NAME = "kramurai-local";
  const STORE_NAME = "files";
  const CASES_KEY = STORAGE_KEY + "-cases-v2";
  const CASE_PREFIX = STORAGE_KEY + ":case:";
  const caseStorageKey = id => CASE_PREFIX + id;
  const TOTAL_STEPS = 4;
  const photoLabels = {beforeOverall: "Vorher: Gesamtansicht und Zubehör", beforeDetail: "Vorher: auffällige Stelle / Kennung", afterOverall: "Nachher: Gesamtansicht und Zubehör", afterDetail: "Nachher: auffällige Stelle / Vergleich", receipt: "Abgabebeleg / Reparaturbeleg"};
  const defaultState = () => ({version:1, caseId:crypto.randomUUID(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), currentStep:1,
    item:{name:"",manufacturer:"",model:"",serial:""},party:{sender:"",recipient:""},
    intake:{status:"vorbereitung",accessoryStatus:"unbekannt",date:"",reference:"",fault:"",occurrence:"",condition:"",accessories:"",costNotes:""},
    returned:{status:"offen",testNote:"",date:"",result:"",functionCheck:"offen",accessories:"offen",condition:"",openIssues:""}
  });

  function migrateRepairState(saved) {
    if(!saved || typeof saved !== "object" || !saved.intake || !saved.returned) return saved;
    const intake={...saved.intake},returned={...saved.returned};
    if(!Object.prototype.hasOwnProperty.call(intake,"accessoryStatus")) intake.accessoryStatus=String(intake.accessories || "").trim() ? "liste" : "unbekannt";
    if(!Object.prototype.hasOwnProperty.call(returned,"testNote")) returned.testNote="";
    return {...saved,intake,returned};
  }
  let caseIndex = { ids: [], activeId: "" };
  let fileBusyCount = 0;
  let state = migrateRepairState(loadState());
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
      state = migrateRepairState(saved);
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

  function updateReturnFields() {
    const given=state.intake.status === "abgegeben",returned=state.returned.status === "zurueck";
    document.querySelector('[for="intakeDate"]').textContent = given ? "Datum der Abgabe / des Versands" : "Geplantes Datum der Abgabe / des Versands";
    document.querySelector('[for="accessories"]').textContent = given ? "Abgegebenes Zubehör – ein Teil pro Zeile" : "Vorgesehenes Zubehör – ein Teil pro Zeile";
    const list=state.intake.accessoryStatus === "liste";
    document.getElementById("accessoryListFields").hidden=!list;
    document.getElementById("returnFields").hidden=!returned;
    document.getElementById("returnPending").hidden=returned;
    document.getElementById("returnedAccessoriesFields").hidden=!list;
    const hint=document.getElementById("returnAccessoriesHint");hint.hidden=list;
    hint.textContent=state.intake.accessoryStatus === "keines" ? "Bei der Abgabe wurde ausdrücklich kein Zubehör angegeben." : "Für einen Zubehörvergleich zuerst in Schritt 2 erfassen, was du abgegeben hast.";
    document.getElementById("testNoteFields").hidden=state.returned.functionCheck === "offen";
    document.getElementById("openIssues").closest(".field").classList.toggle("field-issue",returned && (state.returned.functionCheck === "weiterhin" || state.returned.functionCheck === "teilweise" || (list && state.returned.accessories === "fehlt")));
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
        if(["returnStatus","intakeStatus","accessoryStatus","functionCheck","returnedAccessories"].includes(el.id)) updateReturnFields();
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
    return '<div class="summary-row'+(long?' summary-row-long':'')+'"><div class="summary-key">'+esc(key).replaceAll('/', '/<wbr>')+'</div><div>'+esc(text || 'Nicht angegeben')+'</div></div>';
  }
  function card(title, content) {return '<section class="summary-card"><h3>'+esc(title)+'</h3>'+content+'</section>';}
  function checks(types) {
    const notes=[],warnings=[];
    const today=new Date(),todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
    if(!state.intake.fault.trim()) notes.push(["Die Fehlerbeschreibung ist noch leer.",1]);
    if(!state.party.recipient.trim()) notes.push(["Werkstatt oder Servicebetrieb sind noch nicht angegeben.",2]);
    if(state.intake.status === "abgegeben" && !state.intake.date) notes.push(["Das Datum der Abgabe fehlt.",2]);
    if(state.intake.status === "abgegeben" && state.intake.date > todayKey) warnings.push(["Die bereits erfolgte Abgabe ist in der Zukunft datiert. Bitte Stand oder Datum prüfen.",2]);
    if(state.intake.accessoryStatus === "unbekannt") notes.push(["Noch offen: Wurde Zubehör abgegeben? Bitte in Schritt 2 ausdrücklich kein Zubehör oder eine Zubehörliste erfassen.",2]);
    if(state.intake.accessoryStatus === "liste" && !state.intake.accessories.trim()) notes.push(["Zubehör auflisten ist ausgewählt, die Liste ist aber noch leer.",2]);
    if(!types.has("beforeOverall")) notes.push(["Es ist noch keine Gesamtansicht vor der Abgabe enthalten.",2]);
    if(state.returned.status === "zurueck") {
      if(state.intake.status !== "abgegeben") warnings.push(["Rücknahme eingetragen, Abgabe steht noch auf Vorbereitung. Bitte den Stand prüfen.",2]);
      if(state.returned.date && state.intake.date && state.returned.date < state.intake.date) warnings.push(["Das Rücknahmedatum liegt vor dem Abgabedatum. Bitte die Datumsangaben prüfen.",3]);
      if(state.returned.date > todayKey) warnings.push(["Die bereits erfolgte Rücknahme ist in der Zukunft datiert. Bitte Stand oder Datum prüfen.",3]);
      if(!state.returned.date) notes.push(["Das Datum der Rücknahme fehlt.",3]);
      if(state.returned.functionCheck === "offen") notes.push(["Die eigene Funktionsprüfung steht noch aus.",3]);
      if(state.returned.functionCheck !== "offen" && !state.intake.fault.trim()) warnings.push(["Ein Prüfergebnis ist eingetragen, aber die ursprüngliche Fehlerbeschreibung fehlt. Bitte den Bezug ergänzen.",1]);
      if(state.returned.functionCheck !== "offen" && !state.returned.testNote.trim()) notes.push(["Optional: Beschreibe kurz, was du wie lange geprüft hast.",3]);
      if(state.intake.accessoryStatus === "liste" && !state.intake.accessories.trim() && state.returned.accessories === "vollstaendig") warnings.push(["Zubehör ist als vollständig markiert, aber die Abgabeliste fehlt. Der Vergleich ist so noch nicht nachvollziehbar.",2]);
      if((state.returned.functionCheck === "weiterhin" || state.returned.functionCheck === "teilweise" || (state.intake.accessoryStatus === "liste" && state.returned.accessories === "fehlt")) && !state.returned.openIssues.trim()) notes.push(["Bitte die festgestellten Probleme oder fehlenden Teile bei den offenen Punkten beschreiben.",3]);
    }
    missingCheck.replaceChildren();missingCheck.hidden=false;
    const title=document.createElement("strong");title.textContent=notes.length || warnings.length ? "Vor dem PDF noch kurz prüfen" : "PDF bereit";missingCheck.append(title);
    const help=document.createElement("p");help.textContent="Unbekannte oder unzutreffende Angaben dürfen offen bleiben. Widersprüche werden zusätzlich im PDF hervorgehoben.";missingCheck.append(help);
    for(const [text,step] of [...warnings,...notes]) {
      const line=document.createElement("p");line.textContent=text+" ";
      const button=document.createElement("button");button.type="button";button.className="btn btn-secondary";button.textContent="Schritt "+step+" öffnen";button.addEventListener("click",()=>showStep(step));line.append(button);missingCheck.append(line);
    }
    return warnings.map(([text])=>text);
  }
  async function renderSummary() {
    summaryObjectUrls.forEach(url=>URL.revokeObjectURL(url));summaryObjectUrls=[];
    document.getElementById("docUpdatedDate").textContent=new Date(state.updatedAt).toLocaleString("de-DE");
    const summary=document.getElementById("summary"),returned=state.returned.status === "zurueck",given=state.intake.status === "abgegeben";
    const records=await Promise.all(Object.keys(photoLabels).map(async type=>({type,record:await getFile(type)})));
    const visible=records.filter(({type,record})=>record && (returned || !type.startsWith("after")));
    const warnings=checks(new Set(visible.map(f=>f.type)));
    let html=warnings.map(w=>'<p class="warning">Prüfhinweis: '+esc(w)+'</p>').join("");
    html+=card("Gerät und Fehler",row("Gerät / Gegenstand",state.item.name,true)+row("Hersteller",state.item.manufacturer)+row("Modell",state.item.model)+row("Seriennummer / Kennung",state.item.serial)+row("Fehlerbeschreibung",state.intake.fault,true)+row("Auftreten des Fehlers",state.intake.occurrence));
    const list=state.intake.accessoryStatus === "liste",listed=list && Boolean(state.intake.accessories.trim());
    const accessoryIntake=state.intake.accessoryStatus === "keines" ? "Ausdrücklich kein Zubehör angegeben" : list ? state.intake.accessories || "Zubehörliste noch leer" : "Noch nicht erfasst";
    html+=card("Abgabe",row("Stand",given ? "Abgegeben / versendet (eigene Angabe)" : "Abgabe wird vorbereitet")+row("Werkstatt / Servicebetrieb",state.party.recipient)+row(given ? "Abgabe / Versand am" : "Abgabe geplant für",formatDate(state.intake.date))+row("Name",state.party.sender)+row("Kennung / Referenz",state.intake.reference)+row("Sichtbarer Zustand vorher",state.intake.condition,true)+row(given ? "Abgegebenes Zubehör" : "Vorgesehenes Zubehör",accessoryIntake)+row("Bereits getroffene Absprachen",state.intake.costNotes));
    const functionLabels={offen:"Noch nicht geprüft",behoben:"Beschriebener Fehler beim eigenen Test nicht mehr aufgetreten",weiterhin:"Beschriebener Fehler tritt beim eigenen Test weiterhin auf",teilweise:"Teilweise behoben / anderes Problem festgestellt"};
    let accessoryReturn="Abgabeliste fehlt – Vollständigkeit noch nicht beurteilt";
    if(state.intake.accessoryStatus === "keines") accessoryReturn="Bei der Abgabe ausdrücklich kein Zubehör angegeben";
    else if(listed) accessoryReturn=({offen:"Noch nicht geprüft",vollstaendig:"Mit der Abgabeliste verglichen: nach eigener Prüfung vollständig",fehlt:"Es fehlt Zubehör / Abweichung festgestellt"})[state.returned.accessories] || "Nicht angegeben";
    else if(list && state.returned.accessories === "fehlt") accessoryReturn="Fehlendes Zubehör angegeben; die Abgabeliste ist noch leer";
    const problem=state.returned.functionCheck === "weiterhin" || state.returned.functionCheck === "teilweise" || (list && state.returned.accessories === "fehlt");
    const pending=state.returned.functionCheck === "offen" || state.intake.accessoryStatus === "unbekannt" || (list && (!listed || state.returned.accessories === "offen"));
    const statusClass=problem ? "status-problem" : pending ? "status-open" : "";
    const reasons=[];
    if(state.returned.functionCheck === "weiterhin") reasons.push("Fehler tritt weiterhin auf");
    if(state.returned.functionCheck === "teilweise") reasons.push("Teilweise behoben / anderes Problem");
    if(list && state.returned.accessories === "fehlt") reasons.push("Zubehör fehlt oder weicht ab");
    const statusText=problem ? "Zurückerhalten – "+reasons.join(" · ") : pending ? "Zurückerhalten – eigene Prüfung noch offen" : "Rücknahme und eigene Prüfung dokumentiert";
    const returnContent=returned ? '<p class="phase-status '+statusClass+'">'+statusText+'</p>'+row("Rücknahme am",formatDate(state.returned.date))+row("Arbeiten laut Betrieb",state.returned.result)+row("Eigene Funktionsprüfung",functionLabels[state.returned.functionCheck] || "Nicht angegeben")+row("Umfang der eigenen Prüfung",state.returned.functionCheck !== "offen" ? state.returned.testNote : "")+row("Zubehör bei Rücknahme",accessoryReturn)+row("Sichtbarer Zustand nachher",state.returned.condition)+row("Offene Punkte / Abweichungen",state.returned.openIssues) : '<p class="phase-status status-open">Rücknahme noch offen. Das Gerät wurde noch nicht zurückerhalten; eine eigene Prüfung des Reparaturergebnisses steht aus.</p>';
    html+=card("Rücknahme und eigener Vergleich",returnContent);
    html+='<section class="summary-card photo-summary-card"><h3>Fotos und Beleg</h3><div class="summary-photos" id="summaryPhotos"></div><div id="summaryReceipt"></div></section>';
    summary.innerHTML=html;
    summary.querySelectorAll('.summary-card').forEach(c=>{if(c.querySelector('.summary-row-long'))c.classList.add('summary-card-long')});
    const photos=document.getElementById('summaryPhotos');
    for(const {type,record} of visible) {
      const url=URL.createObjectURL(record.blob);summaryObjectUrls.push(url);
      if(type==='receipt' && record.mime==='application/pdf') {
        const target=document.getElementById('summaryReceipt');
        const note=document.createElement('p');note.className='receipt-print-note';note.textContent='PDF-Beleg separat beifügen: '+(record.name || 'Reparaturbeleg.pdf');
        const help=document.createElement('p');help.className='hint screen-only';help.textContent='Dieser PDF-Beleg ist nicht in die erzeugte Dokumentation eingebettet. Bitte beide Dateien speichern und gemeinsam weitergeben.';
        const link=document.createElement('a');link.href=url;link.download=record.name || 'Reparaturbeleg.pdf';link.className='btn btn-secondary screen-only receipt-download';link.textContent='Original-PDF speichern';target.append(note,help,link);continue;
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
    state = next ? migrateRepairState(next) : defaultState();
    caseIndex.activeId = state.caseId;
    form.reset();
    hydrateForm();
    saveState(false);
    await restorePreviews();
    showStep(next ? (state.currentStep || 1) : 1);
  });

  CaseBackup.mount({
    helper: "repair", defaultState, migrateState: migrateRepairState, types: Object.keys(photoLabels),
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
