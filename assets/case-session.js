/* One editing tab per helper. No case data, files or network access here. */
(function (root) {
  "use strict";

  function run(storageKey, initialize) {
    const notice = document.querySelector("[data-case-session-notice]");
    const message = notice.querySelector("[data-case-session-message]");
    const retry = notice.querySelector("button");
    const panels = document.querySelectorAll("[data-case-session-root]");
    const block = text => {
      panels.forEach(panel => { panel.inert = true; });
      // Also make the pause visible to browsers that do not support inert.
      panels.forEach(panel => panel.querySelectorAll("button,input,select,textarea")
        .forEach(control => { control.disabled = true; }));
      message.textContent = text;
      notice.hidden = false;
      retry.hidden = false;
      const status = document.getElementById("saveStatus");
      if (status) status.textContent = "Bearbeitung pausiert";
    };
    retry.addEventListener("click", () => location.reload());
    // A restored page must acquire the lock and load current data again.
    // Never release on visibilitychange: a hidden tab may still save a photo.
    root.addEventListener("pagehide", () => {
      panels.forEach(panel => { panel.inert = true; });
    });
    root.addEventListener("pageshow", event => {
      if (event.persisted) location.reload();
    });

    if (!navigator.locks || typeof navigator.locks.request !== "function") {
      block("Dieser Browser unterstützt die geschützte Bearbeitung nicht. Bitte öffne den Helfer über HTTPS in einem aktuellen Browser. Gespeicherte Vorgänge werden nicht verändert.");
      return;
    }
    navigator.locks.request("kramurai-edit:" + storageKey, {ifAvailable: true}, lock => {
      if (!lock) {
        block("Dieser Helfer wird bereits in einem anderen Tab bearbeitet. Schließe den anderen Tab und wähle dann „Erneut prüfen“. Hier wird anschließend der zuletzt gespeicherte Stand geöffnet.");
        return;
      }
      try {
        // Initialization includes legacy migration, autosave and file handlers.
        // None of those may run before the exclusive browser lock is held.
        initialize();
        panels.forEach(panel => { panel.inert = false; });
        notice.hidden = true;
      } catch (_) {
        block("Der Helfer konnte nicht vollständig geöffnet werden. Bitte lade die Seite erneut. Gespeicherte Vorgänge werden nicht gelöscht.");
      }
      // The browser releases the lock when this document is closed or unloaded.
      // No takeover/timeout: ongoing work must not continue under a second owner.
      return new Promise(() => {});
    }).catch(() => {
      block("Die geschützte Bearbeitung konnte nicht gestartet werden. Bitte schließe weitere Tabs dieses Helfers und lade die Seite erneut.");
    });
  }

  root.CaseSession = {run};
})(window);
