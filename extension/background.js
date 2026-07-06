/* Etude extension · background.
   Only job: a click on the toolbar icon toggles Etude on the active tab.
   Chrome reads service_worker, Firefox reads scripts; both load this file and
   register the same onClicked listener. No extra permission needed: sending a
   message to a content script in a host-permitted tab does not require "tabs". */
const api = (typeof browser !== 'undefined' ? browser : chrome);
api.action.onClicked.addListener((tab) => {
  if (!tab || tab.id == null) return;
  Promise.resolve(api.tabs.sendMessage(tab.id, { type: 'etude-toggle' })).catch(() => {});
});
