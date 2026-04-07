// Import server, filesystem, crypto, and database dependencies.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();

// Define app settings and important file paths.
const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'assignment6.db');
const scrypt = promisify(crypto.scrypt);

fs.mkdirSync(DATA_DIR, { recursive: true });

// Open the SQLite database connection.
const db = new sqlite3.Database(DB_PATH);

// Parse incoming request bodies and serve static frontend files.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// allow cors so the frontend can talk to this
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
});

// helper to run insert/update/delete queries
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

// get one row
function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

// get all rows
function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// Create a salted hash for storing user passwords securely.
async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const key = await scrypt(password, salt, 64);
    return {
        salt,
        hash: Buffer.from(key).toString('hex')
    };
}

// Compare a provided password to the stored salted hash.
async function verifyPassword(password, salt, storedHash) {
    const key = await scrypt(password, salt, 64);
    const stored = Buffer.from(storedHash, 'hex');
    if (stored.length !== key.length) return false;
    return crypto.timingSafeEqual(stored, key);
}

// add default users if the table is empty
async function seedDefaultUsers() {
    const res = await getQuery('SELECT COUNT(*) AS count FROM users');
    if (res.count > 0) return;

    const defaults = [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'author', password: 'author123', role: 'author' }
    ];

    for (const u of defaults) {
        const pw = await hashPassword(u.password);
        await runQuery(
            'INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)',
            [u.username, pw.hash, pw.salt, u.role]
        );
    }
}

// Create tables if needed and seed starter data.
async function initializeDatabase() {
    await runQuery('PRAGMA foreign_keys = ON');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'author'))
        )
    `);
    await runQuery(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (username)
        )
    `);
    await seedDefaultUsers();
}

// decode the basic auth header
function parseBasicAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Basic ')) return null;

    const encoded = authHeader.split(' ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString();
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;

    return {
        username: decoded.slice(0, idx),
        password: decoded.slice(idx + 1)
    };
}

// middleware to check credentials before protected routes
async function authenticate(req, res, next) {
    try {
        const creds = parseBasicAuthHeader(req.headers.authorization);

        if (!creds || !creds.username || !creds.password) {
            res.set('WWW-Authenticate', 'Basic');
            return res.status(401).json({ error: 'Authorization required' });
        }

        const user = await getQuery(
            'SELECT username, password_hash, salt, role FROM users WHERE username = ?',
            [creds.username]
        );

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await verifyPassword(creds.password, user.salt, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        req.user = { username: user.username, role: user.role };
        next();
    } catch (err) {
        next(err);
    }
}

// get all items, or just one if ?id= is passed
app.get('/api/items', async (req, res, next) => {
    try {
        const { id } = req.query;

        if (!id) {
            const items = await allQuery('SELECT id, name, created_by, created_at FROM items ORDER BY id ASC');
            return res.json(items);
        }

        const item = await getQuery(
            'SELECT id, name, created_by, created_at FROM items WHERE id = ?', [id]
        );

        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (err) {
        next(err);
    }
});

// create a new item for the logged-in user
app.post('/api/items', authenticate, async (req, res, next) => {
    try {
        const name = req.body.name ? req.body.name.trim() : '';
        if (!name) return res.status(400).json({ error: 'Name required' });

        const result = await runQuery(
            'INSERT INTO items (name, created_by) VALUES (?, ?)',
            [name, req.user.username]
        );
        const newItem = await getQuery(
            'SELECT id, name, created_by, created_at FROM items WHERE id = ?',
            [result.lastID]
        );

        res.status(201).json(newItem);
    } catch (err) {
        next(err);
    }
});

// update an existing item by id
app.put('/api/items', authenticate, async (req, res, next) => {
    try {
        const id = Number.parseInt(req.body.id, 10);
        const name = req.body.name ? req.body.name.trim() : '';

        if (!Number.isInteger(id) || !name) {
            return res.status(400).json({ error: 'ID and name required' });
        }

        const result = await runQuery('UPDATE items SET name = ? WHERE id = ?', [name, id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });

        const updated = await getQuery(
            'SELECT id, name, created_by, created_at FROM items WHERE id = ?', [id]
        );
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

// only admins can delete
app.delete('/api/items', authenticate, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const id = Number.parseInt(req.body.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID required' });

        const result = await runQuery('DELETE FROM items WHERE id = ?', [id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });

        res.json({ message: 'Item deleted' });
    } catch (err) {
        next(err);
    }
});

// only admins can create users
app.post('/api/users', authenticate, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const username = req.body.username ? req.body.username.trim() : '';
        const password = req.body.password ? req.body.password.trim() : '';
        const role = req.body.role ? req.body.role.trim() : '';

        if (!username || !password || !role) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (!['admin', 'author'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or author' });
        }

        const existing = await getQuery('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) return res.status(400).json({ error: 'User already exists' });

        const pw = await hashPassword(password);
        await runQuery(
            'INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)',
            [username, pw.hash, pw.salt, role]
        );

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        next(err);
    }
});

// check credentials and return login status
app.get('/api/login', authenticate, (req, res) => {
    res.json({ message: 'Login successful', role: req.user.role });
});

// catch-all error handler
app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize the database, then start listening for requests.
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`server running on port ${PORT}`);
            console.log(`db at ${DB_PATH}`);
        });
    })
    .catch(err => {
        console.error('db init failed', err);
        process.exit(1);
    });
