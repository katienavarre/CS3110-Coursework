// Store credentials after login
let currentUsername = "";
let currentPassword = "";

function getAuthHeader() {
  return "Basic " + btoa(currentUsername + ":" + currentPassword);
}

// ── Server-Sent Events ────────────────────────────────────────────────────────
// Connect to the SSE endpoint so the server can push item changes to us
// without us needing to poll or click anything.
const evtSource = new EventSource("/api/events");

function setSseStatus(state, text) {
  const el = document.getElementById("sseStatus");
  if (!el) return;
  el.className = "sse-status " + state;
  el.textContent = text;
}

evtSource.onopen = () => {
  setSseStatus("connected", "🟢 Live updates connected");
};

evtSource.addEventListener("items-changed", () => {
  // Silently refresh the list whenever any user mutates data.
  loadItems();
});

evtSource.onerror = () => {
  // EventSource auto-reconnects; show a transient warning.
  setSseStatus("error", "🔴 Connection lost – reconnecting…");
};
// ── end SSE ───────────────────────────────────────────────────────────────────

function testLogin(){
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!username || !password) {
    document.getElementById("loginStatus").innerText = "Please enter a username and password.";
    return;
  }

  fetch("/api/login", {
    headers: { "Authorization": "Basic " + btoa(username + ":" + password) }
  })
    .then(res => {
      if (!res.ok) throw new Error("Login failed");
      return res.json();
    })
    .then(data => {
      currentUsername = username;
      currentPassword = password;
      document.getElementById("loginStatus").innerText = "Logged in as " + username + " (" + data.role + ")";
    })
    .catch(() => {
      document.getElementById("loginStatus").innerText = "Invalid credentials";
    });
}

// Render items, now showing last_modified_by alongside created_by.
function renderItems(data) {
  const list = document.getElementById("items");
  list.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    list.innerHTML = "<p>No items yet.</p>";
    return;
  }

  data.forEach(item => {
    const modifier = item.last_modified_by || item.created_by || "unknown";
    const modifiedAt = item.updated_at
      ? new Date(item.updated_at).toLocaleString()
      : "";
    const modNote = item.last_modified_by && item.last_modified_by !== item.created_by
      ? ` | <em>Last modified by <strong>${modifier}</strong> at ${modifiedAt}</em>`
      : ` | <em>Created by <strong>${item.created_by || "unknown"}</strong></em>`;

    list.innerHTML += `<p>ID: ${item.id} | Name: ${item.name}${modNote}</p>`;
  });
}

function loadItems(){
  fetch("/api/items")
    .then(res => res.json())
    .then(data => renderItems(data))
    .catch(() => {
      document.getElementById("items").innerHTML = "<p>Could not load items.</p>";
    });
}

function addItem(){
  const name = document.getElementById("name").value.trim();

  if (!name) {
    alert("Enter a name first");
    return;
  }

  fetch("/api/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader()
    },
    body: JSON.stringify({ name: name })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) { alert("Error: " + data.error); return; }
      document.getElementById("name").value = "";
      // SSE will trigger loadItems() for all tabs; call it locally too for
      // immediate feedback in case SSE delivery is slightly delayed.
      loadItems();
    });
}

function updateItem(){
  const id = document.getElementById("updateId").value.trim();
  const name = document.getElementById("updateName").value.trim();

  if (!id || !name) {
    alert("Enter both ID and new name");
    return;
  }

  fetch("/api/items", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader()
    },
    body: JSON.stringify({ id: id, name: name })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) { alert("Error: " + data.error); return; }
      document.getElementById("updateId").value = "";
      document.getElementById("updateName").value = "";
      loadItems();
    });
}

function deleteItem(){
  const id = document.getElementById("deleteId").value.trim();

  if (!id) {
    alert("Enter an item ID");
    return;
  }

  fetch("/api/items", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader()
    },
    body: JSON.stringify({ id: id })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) { alert("Error: " + data.error); return; }
      document.getElementById("deleteId").value = "";
      loadItems();
    });
}

function createUser(){
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value.trim();
  const role = document.getElementById("role").value;

  if (!username || !password) {
    document.getElementById("userStatus").innerText = "Username and password are required.";
    return;
  }

  fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader()
    },
    body: JSON.stringify({ username, password, role })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        document.getElementById("userStatus").innerText = "Error: " + data.error;
        return;
      }

      document.getElementById("newUsername").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("userStatus").innerText = "User created";
    });
}

// Load items on page start so the list is populated without clicking anything.
loadItems();
