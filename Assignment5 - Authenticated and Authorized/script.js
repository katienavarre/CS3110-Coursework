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
    document.getElementById("loginStatus").innerText = "Logged in as " + username + " (" + data.role + ")!";
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
        data.forEach(item => {
            list.innerHTML += `<p>ID: ${item.id} | Name: ${item.name}</p>`;
        });
    });
}

// Requirement 3: Authenticated AJAX POST
function addItem(){
  const name = document.getElementById("name").value;
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
    loadItems();
  });
}

// Requirement 4: Authenticated AJAX PUT
function updateItem(){
  const id = document.getElementById("updateId").value;
  const name = document.getElementById("updateName").value;
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
    loadItems();
  });
}

// Requirement 5: Authenticated AJAX DELETE
function deleteItem(){
  const id = document.getElementById("deleteId").value;
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
    loadItems();
  });
}

// Requirement 6 & 7: Create credentials (admin only)
function createUser(){
  const username = document.getElementById("newUsername").value;
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("role").value;

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
    if (data.error) { alert("Error: " + data.error); return; }
    alert("User created");
  });
}
