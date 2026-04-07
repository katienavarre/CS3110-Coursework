// Store credentials after login
let currentUsername = "";
let currentPassword = "";

function getAuthHeader() {
  return "Basic " + btoa(currentUsername + ":" + currentPassword);
}

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

// Requirement 2: Unauthenticated AJAX GET
function loadItems(){
  fetch("/api/items")
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("items");
      list.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = "<p>No items yet.</p>";
        return;
      }

      data.forEach(item => {
        list.innerHTML += `<p>ID: ${item.id} | Name: ${item.name} | By: ${item.created_by || "unknown"}</p>`;
      });
    })
    .catch(() => {
      document.getElementById("items").innerHTML = "<p>Could not load items.</p>";
    });
}

// Requirement 3: Authenticated AJAX POST
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
      loadItems();
    });
}

// Requirement 4: Authenticated AJAX PUT
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

// Requirement 5: Authenticated AJAX DELETE
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

// Requirement 6 & 7: Create credentials (admin only)
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
