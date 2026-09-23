// Installation is optional and always needs the browser's own confirmation.
let promptEvent = null;
let status = "";
let busy = false;
let installed = typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);

export function installChoices() {
  return `<section id="web-app-install" class="panel"><h2>Hearth, a little closer</h2><h3>Would you like to install the Web App?</h3><p>Install the Web App for a home-screen shortcut and a window of its own. On iPhone and iPad, this also lets you enable device notifications. It’s optional and uses the same account.</p>${installed ? '<p role="status">You’re already using the Hearth Web App.</p>' : `<div class="live-actions"><button type="button" data-action="install" ${busy ? "disabled" : ""}>Yes, please!</button><button type="button" data-action="decline-install">No, thank you.</button></div><p class="live-muted">Your browser will ask you to confirm, or we’ll show you how. You can install it later.</p><p role="status">${status}</p>`}</section>`;
}
function update() {
  const section = document.querySelector("#web-app-install");
  if (section) section.outerHTML = installChoices();
}
export async function installAction(action) {
  if (action === "decline-install") {
    status = "That’s fine. Continue using Hearth in your browser.";
    update();
    return;
  }
  if (busy || installed) return;
  if (!promptEvent) {
    status = "On iPhone or iPad, open Hearth in Safari, choose Share, then Add to Home Screen. In other browsers, look in the address bar or browser menu for Install app or Add to Home Screen. If neither appears, you can keep using Hearth here.";
    update();
    return;
  }
  const event = promptEvent;
  promptEvent = null;
  busy = true;
  try {
    // Call during the click gesture, before any asynchronous work.
    const result = await event.prompt();
    const choice = result || await event.userChoice;
    status = choice?.outcome === "accepted"
      ? "Your browser is setting up the Web App. You can continue whenever you’re ready."
      : "No problem. You can install the Web App later from your browser menu.";
  } catch {
    status = "The browser couldn’t open installation. Try its Install app or Add to Home Screen menu, or continue here.";
  } finally { busy = false; update(); }
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    promptEvent = null;
    update();
  });
}
