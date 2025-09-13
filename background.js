
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_ARTICLE_TEXT") {

    return true; 
  }

  if (request.type === "GET_API_KEY") {
    const GEMINI_API_KEY = "AIzaSyBz_zXVwbp-iFcIivyFZb80SA5cRVyFqOs"; 
    sendResponse({ apiKey: GEMINI_API_KEY });
    return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("Summify extension installed/updated:", details);

  chrome.storage.sync.set({
    summaryType: "brief", 
  });
});

chrome.action.onClicked.addListener((tab) => {
  console.log("Summify icon clicked on tab:", tab.id);
});

function checkApiStatus() {
  console.log("Checking API status...");
}

chrome.alarms.create("checkApiStatus", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkApiStatus") {
    checkApiStatus();
  }
});
