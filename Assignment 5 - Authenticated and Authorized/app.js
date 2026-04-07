const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");
    next();
});

/* DATA STORAGE */

let items = [];
let idCounter = 1;

let users = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "author", password: "author123", role: "author" }
];

/* AUTHENTICATION MIDDLEWARE */

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    console.log("AUTH HEADER:", authHeader);

    if (!authHeader) {
        return res.status(401).json({ error: "Authorization required" });
    }

    const base64 = authHeader.split(" ")[1];
    const decoded = Buffer.from(base64, "base64").toString();

    console.log("DECODED RAW:", decoded);

    const [username, password] = decoded.split(":");

    console.log("USERNAME:", `"${username}"`);
    console.log("PASSWORD:", `"${password}"`);
    console.log("USERS ARRAY:", users);

    const user = users.find(
        u => u.username === username && u.password === password
    );

    if (!user) {
        console.log("LOGIN FAILED");
        return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("✅ LOGIN SUCCESS:", user);

    req.user = user;
    next();
}

/* ROUTES */

// GET (public)
app.get('/api/items', (req, res) => {
    const id = req.query.id;

    if (!id) {
        return res.json(items);
    }

    const item = items.find(i => i.id == id);
    if (!item) {
        return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
});

// POST (author or admin)
app.post('/api/items', authenticate, (req, res) => {
    if (!req.body.name) {
        return res.status(400).json({ error: "Name required" });
    }

    const newItem = {
        id: idCounter++,
        name: req.body.name
    };

    items.push(newItem);
    res.json(newItem);
});

// PUT (author or admin)
app.put('/api/items', authenticate, (req, res) => {
    const { id, name } = req.body;

    if (!id || !name) {
        return res.status(400).json({ error: "ID and name required" });
    }

    const item = items.find(i => i.id == id);
    if (!item) {
        return res.status(404).json({ error: "Item not found" });
    }

    item.name = name;
    res.json(item);
});

// DELETE (admin only)
app.delete('/api/items', authenticate, (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: "ID required" });
    }

    const index = items.findIndex(i => i.id == id);
    if (index === -1) {
        return res.status(404).json({ error: "Item not found" });
    }

    items.splice(index, 1);
    res.json({ message: "Item deleted" });
});

/* CREATE USER (ADMIN ONLY) */

app.post('/api/users', authenticate, (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
    }

    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "All fields required" });
    }

    const exists = users.find(u => u.username === username);
    if (exists) {
        return res.status(400).json({ error: "User already exists" });
    }

    users.push({ username, password, role });

    res.json({ message: "User created successfully" });
});

// Login check
app.get('/api/login', authenticate, (req, res) => {
    res.json({ message: "Login successful", role: req.user.role });
});

/* START SERVER */

app.listen(PORT, () => {
    console.log(`Assignment 5 server running on port ${PORT}`);
});
