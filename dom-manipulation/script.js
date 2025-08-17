// script.js

let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { id: 1, text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { id: 2, text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", category: "Perseverance" },
  { id: 3, text: "Happiness depends upon ourselves.", category: "Happiness" }
];

let selectedCategory = localStorage.getItem("lastFilter") || "all";

const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");
const notification = document.getElementById("notification"); // <div id="notification"></div>

// --- Utility functions ---
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function showNotification(message, type = "info") {
  notification.textContent = message;
  notification.className = type; 
  setTimeout(() => {
    notification.textContent = "";
    notification.className = "";
  }, 4000);
}

// --- Quote display ---
function showRandomQuote() {
  let filteredQuotes =
    selectedCategory === "all"
      ? quotes
      : quotes.filter((quote) => quote.category === selectedCategory);

  if (filteredQuotes.length === 0) {
    quoteDisplay.textContent = "No quotes available for this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  quoteDisplay.textContent = `"${filteredQuotes[randomIndex].text}" - ${filteredQuotes[randomIndex].category}`;
}

// --- Add Quote ---
function createAddQuoteForm() {
  const formDiv = document.createElement("div");

  const inputText = document.createElement("input");
  inputText.id = "newQuoteText";
  inputText.type = "text";
  inputText.placeholder = "Enter a new quote";

  const inputCategory = document.createElement("input");
  inputCategory.id = "newQuoteCategory";
  inputCategory.type = "text";
  inputCategory.placeholder = "Enter quote category";

  const addButton = document.createElement("button");
  addButton.textContent = "Add Quote";
  addButton.onclick = addQuote;

  formDiv.appendChild(inputText);
  formDiv.appendChild(inputCategory);
  formDiv.appendChild(addButton);

  document.body.appendChild(formDiv);
}

function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (text && category) {
    const newQuote = { id: Date.now(), text, category };
    quotes.push(newQuote);
    saveQuotes();
    populateCategories();
    showNotification("Quote added successfully!", "success");
    syncQuoteToServer(newQuote);
  } else {
    showNotification("Please enter both quote text and category.", "error");
  }
}

// --- Category handling ---
function populateCategories() {
  const categories = ["all", ...new Set(quotes.map((q) => q.category))];

  categoryFilter.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    if (cat === selectedCategory) option.selected = true;
    categoryFilter.appendChild(option);
  });
}

function filterQuotes() {
  selectedCategory = categoryFilter.value;
  localStorage.setItem("lastFilter", selectedCategory);
  showRandomQuote();
}

// --- Export / Import ---
function exportToJsonFile() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showNotification("Quotes exported successfully!", "success");
}

function importFromJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes = [...quotes, ...importedQuotes];
        saveQuotes();
        populateCategories();
        showNotification("Quotes imported successfully!", "success");
      } else {
        showNotification("Invalid file format.", "error");
      }
    } catch (err) {
      showNotification("Error reading file.", "error");
    }
  };
  reader.readAsText(file);
}

// --- Server Sync ---
async function fetchQuotesFromServer() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    const data = await response.json();
    return data.slice(0, 5).map((item) => ({
      id: item.id,
      text: item.title,
      category: "Server"
    }));
  } catch (error) {
    console.error("Error fetching from server:", error);
    return [];
  }
}

function resolveConflicts(serverQuotes, localQuotes) {
  const merged = [...localQuotes];
  serverQuotes.forEach((serverQuote) => {
    const exists = merged.find((q) => q.id === serverQuote.id);
    if (exists) Object.assign(exists, serverQuote);
    else merged.push(serverQuote);
  });
  return merged;
}

async function syncQuotes() {
  const serverQuotes = await fetchQuotesFromServer();
  if (serverQuotes.length > 0) {
    quotes = resolveConflicts(serverQuotes, quotes);
    saveQuotes();
    populateCategories();
    showNotification("Quotes synced with server!", "info");
  }
}

async function syncQuoteToServer(quote) {
  try {
    await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(quote)
    });
    console.log("Quote synced to server:", quote);
  } catch (error) {
    console.error("Error syncing quote:", error);
  }
}

// --- Init ---
document.getElementById("newQuote").addEventListener("click", showRandomQuote);
document.getElementById("exportBtn").addEventListener("click", exportToJsonFile);
document.getElementById("importFile").addEventListener("change", importFromJsonFile);

populateCategories();
createAddQuoteForm();
showRandomQuote();

// periodic sync every 30s
setInterval(syncQuotes, 30000);
