/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
// new: reference to the existing selected-products container (already in your HTML)
let selectedProductsContainer = document.getElementById("selected-products");
// new: reference for the element to save selected products JSON
let selectedProductsList = document.getElementById("selectedProductsList");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* keep track of selected products: map id -> product */
const selectedProducts = new Map();

/* helper to compute a stable id for a product */
function getProductId(product, index) {
  return product.id
    ? String(product.id)
    : `${(product.name || "p").replace(/\s+/g, "_")}_${index}`;
}

/* Ensure overlay CSS is present (inserts a <style> block once) */
function ensureOverlayStyles() {
  if (document.getElementById("product-overlay-styles")) return;
  const s = document.createElement("style");
  s.id = "product-overlay-styles";
  s.textContent = `
    /* product card overlay styles - injected by script for beginners */
    .product-card { position: relative; overflow: visible; }
    .product-card img { display: block; max-width: 100%; height: auto; }
    .product-desc-overlay {
      display: none;
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      background: rgba(0,0,0,0.82);
      color: #fff;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.3;
      z-index: 20;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    /* show on hover or when the card receives keyboard focus */
    .product-card:hover .product-desc-overlay,
    .product-card:focus .product-desc-overlay,
    .product-card:focus-within .product-desc-overlay {
      display: block;
    }
    /* small tweak so the overlay text wraps nicely */
    .product-desc-overlay p { margin: 0; white-space: normal; }
  `;
  document.head.appendChild(s);
}

/* Create HTML for displaying product cards (updated to include description overlay) */
function displayProducts(products) {
  // ensure overlay CSS is loaded
  ensureOverlayStyles();

  // render cards with data-pid so we can identify them later
  productsContainer.innerHTML = products
    .map((product, i) => {
      const pid = getProductId(product, i);
      // use escapeHtml to avoid injecting raw HTML from product.description
      const desc = escapeHtml(product.description || "");
      return `
    <div class="product-card" data-pid="${pid}" role="button" tabindex="0">
      <img src="${product.image}" alt="${escapeHtml(product.name || "")}">
      <div class="product-info">
        <h3>${escapeHtml(product.name || "")}</h3>
        <p>${escapeHtml(product.brand || "")}</p>
      </div>
      <div class="product-desc-overlay" aria-hidden="false">
        <p>${desc}</p>
      </div>
    </div>
  `;
    })
    .join("");

  // attach click/keyboard handlers to toggle selection
  const cards = Array.from(productsContainer.querySelectorAll(".product-card"));
  cards.forEach((card, i) => {
    const product = products[i];
    const pid = getProductId(product, i);

    // set initial visual state if already selected
    if (selectedProducts.has(pid)) {
      card.classList.add("selected");
      card.style.border = "2px solid #007bff";
    } else {
      card.classList.remove("selected");
      card.style.border = "";
    }

    card.addEventListener("click", () =>
      toggleSelectProduct(pid, product, card)
    );
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggleSelectProduct(pid, product, card);
      }
    });
  });

  // update the selected-products list UI
  renderSelectedProducts();
}

/* Toggle selection for a product */
function toggleSelectProduct(pid, product, cardElement) {
  if (selectedProducts.has(pid)) {
    selectedProducts.delete(pid);
    if (cardElement) {
      cardElement.classList.remove("selected");
      cardElement.style.border = "";
    }
  } else {
    selectedProducts.set(pid, product);
    if (cardElement) {
      cardElement.classList.add("selected");
      cardElement.style.border = "2px solid #007bff";
    }
  }
  saveSelectedToLocalStorage(); // persist change
  renderSelectedProducts();
}

/* Render the selected-products list (uses existing #selected-products div) */
function renderSelectedProducts() {
  // ensure container reference (in case DOM changed)
  selectedProductsContainer =
    selectedProductsContainer || document.getElementById("selected-products");
  selectedProductsList =
    selectedProductsList || document.getElementById("selectedProductsList");
  if (!selectedProductsContainer && !selectedProductsList) return; // nothing to update

  if (selectedProducts.size === 0) {
    if (selectedProductsContainer)
      selectedProductsContainer.innerHTML = "<p>No products selected.</p>";
    if (selectedProductsList)
      selectedProductsList.innerHTML = "<p>No products selected.</p>"; // clear saved list
    return;
  }

  if (selectedProductsContainer) {
    selectedProductsContainer.innerHTML = `
    <ul class="selected-list">
      ${Array.from(selectedProducts.entries())
        .map(([pid, p]) => {
          const name = p.name || "Unnamed product";
          // Add a "Remove" button for each product
          return `<li data-pid="${pid}">
            ${escapeHtml(name)}
            <button class="remove-selected" data-pid="${pid}" aria-label="Remove ${escapeHtml(
            name
          )}">Remove</button>
          </li>`;
        })
        .join("")}
    </ul>
  `;

    // Attach click event listeners to the "Remove" buttons
    selectedProductsContainer
      .querySelectorAll(".remove-selected")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const pid = e.currentTarget.getAttribute("data-pid");
          removeSelectedProduct(pid); // Call the function to remove the product
        });
      });
  }

  // Display selected products with smaller images in #selectedProductsList
  if (selectedProductsList) {
    selectedProductsList.innerHTML = `
      <div class="selected-products-grid">
        ${Array.from(selectedProducts.values())
          .map(
            (p) => `
          <div class="selected-product-card">
            <img src="${p.image}" alt="${escapeHtml(
              p.name || "Unnamed product"
            )}" class="selected-product-image">
            <p class="selected-product-name">${escapeHtml(p.name || "")}</p>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }
}

/* Remove a selected product and update UI and grid visual state */
function removeSelectedProduct(pid) {
  if (!selectedProducts.has(pid)) return;
  selectedProducts.delete(pid);

  // un-highlight corresponding card in the grid
  const card = productsContainer.querySelector(
    `.product-card[data-pid="${pid}"]`
  );
  if (card) {
    card.classList.remove("selected");
    card.style.border = "";
  }

  saveSelectedToLocalStorage(); // persist change
  renderSelectedProducts();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Conversation state: keep the full chat history (system + user + assistant) */
const messages = [{ role: "system", content: "helpful assistant." }];

/* Small helper to safely escape HTML when injecting user content */
function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Render the full conversation into the chat window */
function renderChat() {
  if (!chatWindow) return;
  chatWindow.innerHTML = messages
    .map((m) => {
      const cls =
        m.role === "user"
          ? "user-msg"
          : m.role === "assistant"
          ? "assistant-msg"
          : "system-msg";
      // preserve line breaks from model by converting \n -> <br>
      const contentHtml = escapeHtml(m.content).replace(/\n/g, "<br>");
      return `<div class="${cls}"><strong>${escapeHtml(
        m.role
      )}:</strong> ${contentHtml}</div>`;
    })
    .join("");
}

/* --- New helpers: normalize and match products from products.json --- */
function normalizeText(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchProducts(products, query) {
  const q = normalizeText(query || "");
  const keywords = q.split(/\W+/).filter((w) => w.length > 2);
  if (keywords.length === 0) return [];

  return (products || []).filter((p) => {
    const hay = normalizeText(
      `${p.name || ""} ${p.brand || ""} ${p.category || ""} ${
        p.description || ""
      }`
    );
    return keywords.some((k) => hay.includes(k));
  });
}

function buildProductsContextMessage(matchedProducts, allProducts) {
  const listSource =
    matchedProducts && matchedProducts.length > 0
      ? matchedProducts
      : allProducts || [];
  const list = listSource
    .slice(0, 10)
    .map((p) => {
      const name = p.name || "Unnamed";
      const brand = p.brand ? ` (${p.brand})` : "";
      const cat = p.category ? ` — ${p.category}` : "";
      const desc = p.description ? `: ${p.description}` : "";
      return `- ${name}${brand}${cat}${desc}`;
    })
    .join("\n");

  // Strong, explicit instructions to ensure the assistant only uses local data
  if ((matchedProducts || []).length > 0) {
    return (
      "IMPORTANT: Only use the products listed below when recommending items to the user. " +
      "Do NOT invent, reference, or suggest products outside of this list.\n\n" +
      "Products from local data matching the user's message (showing up to 10):\n" +
      `${list}\n\n` +
      "When recommending, pick one or more items from the list above and explain why they match the user's needs. " +
      'If none of the products are an appropriate direct match, explicitly say "No suitable product found in the provided list" and then suggest the best next alternatives drawn only from the list above (do not mention external brands or products).'
    );
  } else if (allProducts && allProducts.length > 0) {
    return (
      "IMPORTANT: Only use the products listed below when recommending items to the user. " +
      "Do NOT invent, reference, or suggest products outside of this list.\n\n" +
      "No exact matches found for the user's message. Here are some available products (up to 10):\n" +
      `${list}\n\n` +
      'Please recommend any suitable options from this list only. If none are suitable, say "No suitable product found in the provided list."'
    );
  }
  return "No product data available. The assistant should inform the user that no local products exist and not suggest external products.";
}

/* Chat form submission handler - connect to OpenAI API */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const inputEl = chatForm.querySelector("input, textarea");
  const userInput = inputEl ? inputEl.value.trim() : "";

  if (!userInput) {
    chatWindow.innerHTML += `<div class="error">Please enter a message.</div>`;
    return;
  }

  // 1) Add user's message to the conversation and render
  messages.push({ role: "user", content: userInput });
  renderChat();

  // 2) Clear the input field
  if (inputEl) inputEl.value = "";

  // 2.5) Add a temporary assistant "loading" message so UI shows the AI is working
  messages.push({ role: "assistant", content: "Generating response..." });
  const loadingIndex = messages.length - 1;
  renderChat();

  // 3) Send the full conversation history to OpenAI API
  try {
    const toneSystem = {
      role: "system",
      content:
        "You are a friendly, conversational skincare assistant. You can answer questions about skincare, haircare, makeup, fragrance, and related topics. Use a natural tone, keep suggestions concise, and include short tips when appropriate.",
    };

    const messagesForAPI = [toneSystem, ...messages.slice(0, loadingIndex)];

    const assistantResponse = await sendMessagesToOpenAI(messagesForAPI);

    // Replace the temporary assistant placeholder with actual assistant response
    messages[loadingIndex].content =
      assistantResponse || "Sorry, I couldn't get a response from the API.";
    renderChat();
  } catch (err) {
    // Replace loading placeholder with error message
    messages[loadingIndex].content = `Error: ${err.message}`;
    renderChat();
  }
});

/* Send the full messages array to OpenAI Chat Completions API */
async function sendMessagesToOpenAI(fullMessages) {
  // Use the global OPENAI_API_KEY constant directly
  const apiKey = typeof OPENAI_API_KEY !== "undefined" ? OPENAI_API_KEY : null;

  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Define a global OPENAI_API_KEY constant (e.g., in secrets.js) before loading script.js."
    );
  }

  // Basic sanity check: real keys usually start with "sk-"
  if (typeof apiKey === "string" && !apiKey.startsWith("sk-")) {
    throw new Error(
      'Invalid OpenAI API key provided. Make sure OPENAI_API_KEY is set to your real key (starts with "sk-").'
    );
  }

  // Add a system message to instruct the model to perform searches
  const searchSystemMessage = {
    role: "system",
    content:
      "You are a skincare assistant with real-time web search capabilities. When answering user queries, perform web searches to find the most current and accurate information about L'Oréal products, routines, or related topics. Include links or citations in your responses when appropriate.",
  };

  const payload = {
    model: "gpt-4o-search-preview", // Use the GPT model with search capabilities
    messages: [searchSystemMessage, ...fullMessages],
    max_tokens: 700, // Allow longer, structured replies
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const assistantMessage =
    data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;

  return assistantMessage;
}

/* Persist selected products to localStorage */
function saveSelectedToLocalStorage() {
  const arr = Array.from(selectedProducts.values()).map((p) => ({
    id: p.id ?? null,
    name: p.name ?? null,
    brand: p.brand ?? null,
    category: p.category ?? null,
    description: p.description ?? null,
  }));
  localStorage.setItem("selectedProducts", JSON.stringify(arr));
}

/* Load saved selections from localStorage (returns array) */
function loadSelectedFromLocalStorage() {
  const raw = localStorage.getItem("selectedProducts");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/* Restore selections by matching saved items to the currently loaded products.
   This must be called after displayProducts(products) so cards exist. */
function restoreSelectionsFromStorage(products) {
  const saved = loadSelectedFromLocalStorage();
  if (!Array.isArray(saved) || saved.length === 0) return;

  // clear current selections then try to match saved items to products
  selectedProducts.clear();
  saved.forEach((s) => {
    let found = null;
    if (s.id != null) {
      found = products.find((p) => String(p.id) === String(s.id));
    }
    if (!found && s.name) {
      // fallback: match by name + brand (robust to missing ids)
      found = products.find(
        (p) =>
          (p.name || "").toLowerCase() === (s.name || "").toLowerCase() &&
          ((p.brand || "").toLowerCase() === (s.brand || "").toLowerCase() ||
            !s.brand)
      );
    }
    if (found) {
      // compute pid using the same getProductId logic
      const index = products.indexOf(found);
      const pid = getProductId(found, index);
      selectedProducts.set(pid, found);
    }
  });

  // After populating selectedProducts, update UI highlights and list
  // highlight cards
  Array.from(productsContainer.querySelectorAll(".product-card")).forEach(
    (card, i) => {
      const pid = card.getAttribute("data-pid");
      if (selectedProducts.has(pid)) {
        card.classList.add("selected");
        card.style.border = "2px solid #007bff";
      } else {
        card.classList.remove("selected");
        card.style.border = "";
      }
    }
  );

  renderSelectedProducts();
}

/* Clear all selections (UI + storage) */
function clearAllSelections() {
  // Clear the selected products map
  selectedProducts.clear();

  // Clear localStorage
  saveSelectedToLocalStorage();

  // Un-highlight any cards in the grid
  Array.from(productsContainer.querySelectorAll(".product-card")).forEach(
    (card) => {
      card.classList.remove("selected");
      card.style.border = "";
    }
  );

  // Update the selected-products list UI
  renderSelectedProducts();
}

/* Attach "Clear Selected Products" button functionality */
(function attachClearSelectionsButton() {
  const clearBtn = document.getElementById("clearSelectionsBtn");
  if (!clearBtn) {
    console.info(
      "No #clearSelectionsBtn found; clear functionality not attached."
    );
    return;
  }

  clearBtn.addEventListener("click", () => {
    clearAllSelections();

    // Optionally inform the user in the chat window
    messages.push({
      role: "assistant",
      content: "All selected products have been cleared.",
    });
    renderChat();
  });
})();

/* Helper: return array of selected product objects */
function getSelectedProductsArray() {
  return Array.from(selectedProducts.values());
}

/* Wire the "Generate Routine" button to send selected products JSON to OpenAI */
(function attachGenerateRoutine() {
  const btn = document.getElementById("generateRoutineBtn");
  if (!btn) {
    console.info(
      "No #generateRoutineBtn found; routine generation UI not attached."
    );
    return;
  }

  btn.addEventListener("click", async () => {
    const selectedArray = getSelectedProductsArray();
    if (selectedArray.length === 0) {
      // Inform user via assistant message
      messages.push({
        role: "assistant",
        content:
          "Please select at least one product before generating a routine.",
      });
      renderChat();
      return;
    }

    // Build JSON payload for selected products (only requested fields)
    const productsPayload = selectedArray.map((p) => ({
      name: p.name || null,
      brand: p.brand || null,
      category: p.category || null,
      description: p.description || null,
    }));

    // Tone guidance for a natural conversational reply
    const toneSystem = {
      role: "system",
      content:
        "You are a friendly, conversational skincare assistant. Use the provided products to create a concise 3-step skincare routine. Number the steps and include a 1-sentence tip for each step.",
    };

    // Send the products JSON as a user message so the model receives structured data
    const productsUser = {
      role: "user",
      content: `products = ${JSON.stringify(productsPayload)}`,
    };

    // Add a temporary assistant message while generating
    messages.push({
      role: "assistant",
      content: "Generating routine from selected products...",
    });
    const loadingIndex = messages.length - 1;
    renderChat();

    const messagesForAPI = [toneSystem, productsUser];

    try {
      const assistantText = await sendMessagesToOpenAI(messagesForAPI);

      // Replace the temporary assistant placeholder with the API response
      messages[loadingIndex].content =
        assistantText || "I couldn't generate a routine from the API.";
      renderChat();
    } catch (err) {
      messages[
        loadingIndex
      ].content = `Error generating routine: ${err.message}`;
      renderChat();
    }
  });
})();

/* Add event listener to "Generate Routine" button */
const generateRoutineBtn = document.getElementById("generateRoutine");
generateRoutineBtn.addEventListener("click", async () => {
  const selectedArray = Array.from(selectedProducts.values());
  if (selectedArray.length === 0) {
    // Inform user if no products are selected
    messages.push({
      role: "assistant",
      content:
        "Please select at least one product before generating a routine.",
    });
    renderChat();
    return;
  }

  // Build JSON payload for selected products
  const productsPayload = selectedArray.map((p) => ({
    name: p.name || null,
    brand: p.brand || null,
    category: p.category || null,
    description: p.description || null,
  }));

  // Add a temporary assistant message while generating
  messages.push({
    role: "assistant",
    content: "Generating your routine, please wait...",
  });
  const loadingIndex = messages.length - 1;
  renderChat();

  try {
    // Send selected products to OpenAI API
    const toneSystem = {
      role: "system",
      content:
        "You are a friendly, conversational skincare assistant. Use the provided products to create a concise 3-step skincare routine. Number the steps and include a 1-sentence tip for each step.",
    };

    const messagesForAPI = [
      toneSystem,
      { role: "user", content: JSON.stringify(productsPayload) },
    ];
    const assistantResponse = await sendMessagesToOpenAI(messagesForAPI);

    // Replace the temporary assistant placeholder with the API response
    messages[loadingIndex].content =
      assistantResponse || "Sorry, I couldn't generate a routine.";
    renderChat();
  } catch (err) {
    // Replace loading placeholder with error message
    messages[loadingIndex].content = `Error: ${err.message}`;
    renderChat();
  }
});

/* --- New code: filter products by name or keyword --- */

// Store the full product list for filtering
let allProducts = [];

/* Filter and display products based on category and search query */
function filterAndDisplayProducts() {
  const selectedCategory = categoryFilter.value;
  const searchQuery = normalizeText(
    document.getElementById("productSearch").value
  );

  // If no category is selected, show the placeholder message and return
  if (!selectedCategory) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  // Filter products by category and search query
  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory = product.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      normalizeText(
        `${product.name} ${product.brand} ${product.description}`
      ).includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

/* Normalize text for case-insensitive and diacritic-insensitive matching */
function normalizeText(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* Load products and initialize filtering */
(async function initPage() {
  try {
    allProducts = await loadProducts(); // Load all products
    displayProducts(allProducts); // Display all products initially

    // Restore any saved selections now that cards are present
    restoreSelectionsFromStorage(allProducts);
  } catch (err) {
    console.error("Failed to load products on init:", err);
  }

  // Attach event listeners for category filter and search input
  categoryFilter.addEventListener("change", filterAndDisplayProducts);
  document
    .getElementById("productSearch")
    .addEventListener("input", filterAndDisplayProducts);

  // Attach Clear All button functionality if present
  const clearBtn = document.getElementById("clearSelectionsBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearAllSelections();
      messages.push({ role: "assistant", content: "All selections cleared." });
      renderChat();
    });
  }
})();

/* Add support for toggling between LTR and RTL layouts */
function setDirection(direction) {
  document.body.setAttribute("dir", direction);
}

/* Example: Set RTL layout on page load */
setDirection("rtl");

/* Optional: Add a button to toggle between LTR and RTL */
const toggleDirectionBtn = document.createElement("button");
toggleDirectionBtn.textContent = "Toggle Direction";
toggleDirectionBtn.style.position = "fixed";
toggleDirectionBtn.style.top = "10px";
toggleDirectionBtn.style.right = "10px";
toggleDirectionBtn.addEventListener("click", () => {
  const currentDir = document.body.getAttribute("dir");
  setDirection(currentDir === "rtl" ? "ltr" : "rtl");
});
document.body.appendChild(toggleDirectionBtn);
