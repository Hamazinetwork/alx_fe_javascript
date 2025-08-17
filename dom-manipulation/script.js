// script.js

// Global quotes array
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { id: 1, text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { id: 2, text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", category: "Perseverance" },
  { id: 3, text: "Happiness depends upon ourselves.", category: "Happiness" }
];

// Track selected category
let selectedCategory = localStorage.getItem("lastFilter") || "all";

const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");
const notification = document.getElementById("notification"); // <div id="notification"></div> in HTML

// Save quotes
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// Show notification
function showNotification(message, type = "info") {
  notification.textContent = message;
  notification.className = type; // style via CSS
  setTimeout(() => {
    notification.textContent = "";
    notification.className = "";
  }, 4000);
}

// Show random quote
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

// Create Add Quote Form
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

// Add new quote
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (text && category) {
    const newQuote = {
      id: Date.now(),
      text,
      category
    };
    quotes.push(newQuote);
    saveQuotes();
    populateCategories();
    showNotification("Quote added successfully!", "success");
    syncQuoteToServer(newQuote);
  } else {
    showNotification("Please enter both quote text and category.", "error");
  }
}

// Populate categories
function populateCategories() {
  const categories = ["all", ...new Set(quotes.map((q) => q.category))];

  categoryFilter.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    if (cat === selectedCategory) {
      option.selected = true;
    }
    categoryFilter.appendChild(option);
  });
}

// Filter quotes
function filterQuotes() {
  selectedCategory = categoryFilter.value;
  localStorage.setItem("lastFilter", selectedCategory);
  showRandomQuote();
}

// --- Server Sync Functions ---

// Fetch from server
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

// Conflict resolution: server data wins
function resolveConflicts(serverQuotes, localQuotes) {
  const merged = [...localQuotes];

  serverQuotes.forEach((serverQuote) => {
    const exists = merged.find((q) => q.id === serverQuote.id);
    if (exists) {
      // Server overwrites local
      Object.assign(exists, serverQuote);
    } else {
      merged.push(serverQuote);
    }
  });

  return merged;
}

// Sync quotes with server
async function syncQuotes() {
  const serverQuotes = await fetchQuotesFromServer();

  if (serverQuotes.length > 0) {
    quotes = resolveConflicts(serverQuotes, quotes);
    saveQuotes();
    populateCategories();
    showNotification("Quotes synced with server!", "info");
  }
}

// Sync new quote to server
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

// Init
document.getElementById("newQuote").addEventListener("click", showRandomQuote);
document.getElementById("exportBtn").addEventListener("click", exportToJsonFile);
document.getElementById("importFile").addEventListener("change", importFromJsonFile);

populateCategories();
createAddQuoteForm();
showRandomQuote();

// periodic sync every 30s
setInterval(syncQuotes, 30000);
