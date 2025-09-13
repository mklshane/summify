
function markdownToHtml(text) {
  console.log('Raw API output:', text);

  let sanitized = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  sanitized = sanitized
    .replace(/&lt;b&gt;([^&]+)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;strong&gt;([^&]+)&lt;\/strong&gt;/g, '<b>$1</b>');

  return sanitized;
}

const GEMINI_API_KEY = "AIzaSyBz_zXVwbp-iFcIivyFZb80SA5cRVyFqOs"; 
const summarizeBtn = document.getElementById("summarize-btn");

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['lastSummary', 'lastSummaryType'], (data) => {
    const result = document.getElementById("result");
    const summaryTypeSelect = document.getElementById("summary-type");
    
    if (data.lastSummary && data.lastSummaryType) {
      summaryTypeSelect.value = data.lastSummaryType;
      
      if (data.lastSummaryType === "bullets") {
        result.innerHTML = markdownToHtml(data.lastSummary).replace(/\n/g, "<br>");
      } else {
        result.innerHTML = markdownToHtml(data.lastSummary);
      }
      result.classList.remove("placeholder");
    }
  });
});

document.getElementById("summarize-btn").addEventListener("click", async () => {
  const result = document.getElementById("result");
  result.innerHTML =
    '<div class="loading"><div class="spinner"></div>Extracting text...</div>';
  result.classList.remove("placeholder");

  summarizeBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_ARTICLE_TEXT",
    });

    if (!response || !response.text) {
      throw new Error("No text found on this page");
    }

    result.innerHTML =
      '<div class="loading"><div class="spinner"></div>Summarizing...</div>';

    const summaryType = document.getElementById("summary-type").value;

    let prompt = "";
    switch (summaryType) {
      case "brief":
        prompt = `You are an expert summarizer. Create a concise 3-6 sentence summary of the following text.
              REQUIREMENTS:
              - Focus only on core concepts and main ideas
              - Exclude examples, quotes, and minor details
              - Ensure sentences flow logically
              - Use clear, direct language
              - Do not use bullet points or numbered lists
              - Do not include opinions or evaluations
              - Highlight important terms, key concepts, and named entities (e.g., people, places, organizations) by wrapping them in double asterisks (**text**) for bold formatting
              - Do NOT use HTML tags like <b> or <strong> in the output; use Markdown (**text**) exclusively for bolding
              
              TEXT TO SUMMARIZE:
              ${response.text.substring(0, 3000)}`;
        break;

      case "detailed":
        prompt = `You are an expert summarizer. Create a comprehensive 6-12 sentence summary of the following text.
              REQUIREMENTS:
              - Cover all main ideas and important supporting points
              - Maintain logical organization and flow
              - Include key details but avoid trivial examples
              - Use complete, well-structured sentences
              - Begin with an overview sentence
              - End with a concluding sentence
              - Do not use bullet points or numbered lists
              - Highlight important terms, key concepts, and named entities (e.g., people, places, organizations) by wrapping them in double asterisks (**text**) for bold formatting
              - Do NOT use HTML tags like <b> or <strong> in the output; use Markdown (**text**) exclusively for bolding
              
              TEXT TO SUMMARIZE:
              ${response.text.substring(0, 3000)}`;
        break;

      case "bullets":
        prompt = `You are an expert summarizer. Create a bullet-point summary of the following text.
              STRICT REQUIREMENTS:
              - Output MUST consist ONLY of bullet points
              - Each bullet point MUST start with "• " (bullet character)
              - Each bullet MUST be on a separate line
              - Use concise phrases, not complete sentences
              - Focus on key findings and main ideas only
              - Exclude examples, quotes, and minor details
              - Organize bullets from most to least important
              - Do not include any introductory or concluding text
              - Do not use numbers or other markers
              - Highlight important terms, key concepts, and named entities (e.g., people, places, organizations) by wrapping them in double asterisks (**text**) for bold formatting
              - Do NOT use HTML tags like <b> or <strong> in the output; use Markdown (**text**) exclusively for bolding
              
              TEXT TO SUMMARIZE:
              ${response.text.substring(0, 3000)}`;
        break;
    }

    const summary = await callGeminiAPI(prompt);
    console.log('Processed summary:', summary);

    chrome.storage.sync.set({
      lastSummary: summary,
      lastSummaryType: summaryType
    }, () => {
      console.log('Summary saved to chrome.storage');
    });

    if (summaryType === "bullets") {
      result.innerHTML = markdownToHtml(summary).replace(/\n/g, "<br>");
    } else {
      result.innerHTML = markdownToHtml(summary);
    }
  } catch (error) {
    console.error("Error:", error);
    result.textContent = "Error: " + error.message;
  } finally {
    summarizeBtn.disabled = false;
  }
});

document.getElementById("copy-btn").addEventListener("click", () => {
  const result = document.getElementById("result");
  const text = result.textContent;

  if (
    text.includes("Select a summary type") ||
    text.includes("Extracting text") ||
    text.includes("Summarizing") ||
    text.includes("Error:")
  ) {
    showNotification("Generate a summary first");
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification("Summary copied to clipboard");
    })
    .catch((err) => {
      showNotification("Failed to copy text");
      console.error("Failed to copy: ", err);
    });
});

async function callGeminiAPI(prompt) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API error: ${response.status} ${response.statusText}. ${
          errorData.error?.message || ""
        }`
      );
    }

    const data = await response.json();

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content
    ) {
      throw new Error("Invalid response format from Gemini API");
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate summary: " + error.message);
  }
}

function showNotification(message) {
  const notification = document.getElementById("notification");
  if (notification) {
    notification.textContent = message;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 2000);
  }
}
