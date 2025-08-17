// script.js

// Global quotes array
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", category: "Perseverance" },
  { text: "Happiness depends upon ourselves.", category: "Happiness" }
];

// Load last selected filter
let lastFilter = localStorage.getItem("lastFilter") || "all";

// Display elements
const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");

// Save quotes to localStorage
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// Show random quote
function showRandomQuote() {
  let filteredQuotes =
    lastFilter === "all"
      ? quotes
      : quotes.filter((quote) => quote.category === lastFilter);

  if (filteredQuotes.length === 0) {
    quoteDisplay.innerText = "No quotes available for this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  quoteDisplay.innerText = `"${filteredQuotes[randomIndex].text}" - ${filteredQuotes[randomIndex].category}`;
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
  addButton.innerText = "Add Quote";
  addButton.onclick = addQuote;

  formDiv.appendChild(inputText);
  formDiv.appendChild(inputCategory);
  formDiv.appendChild(addButton);

  document.body.appendChild(formDiv);
}

// Add a new quote
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (text && category) {
    quotes.push({ text, category });
    saveQuotes();
    populateCategories();
    alert("Quote added successfully!");
  } else {
    alert("Please enter both quote text and category.");
  }
}

// Populate categories dynamically
function populateCategories() {
  const categories = ["all", ...new Set(quotes.map((q) => q.category))];

  categoryFilter.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.text = cat;
    if (cat === lastFilter) {
      option.selected = true;
    }
    categoryFilter.appendChild(option);
  });
}

// Filter quotes by category
function filterQuotes() {
  lastFilter = categoryFilter.value;
  localStorage.setItem("lastFilter", lastFilter);
  showRandomQuote();
}

// --- Server Sync Simulation ---
// Fetch quotes from a mock server
async function fetchQuotesFromServer() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    const data = await response.json();

    // Simulate server quotes: map posts to quote objects
    const serverQuotes = data.slice(0, 5).map((item) => ({
      text: item.title,
      category: "Server"
    }));

    // Conflict resolution: server overrides
    quotes = [...serverQuotes, ...quotes];
    saveQuotes();
    populateCategories();
    console.log("Quotes synced with server!");
  } catch (error) {
    console.error("Error fetching from server:", error);
  }
}

// Initialize App
document.getElementById("newQuote").addEventListener("click", showRandomQuote);
populateCategories();
createAddQuoteForm();
showRandomQuote();

// Periodic sync with server
setInterval(fetchQuotesFromServer, 30000);
