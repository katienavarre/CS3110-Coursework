let items = [];
let idCounter = 1;

// GET
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

// POST
app.post('/api/items', (req, res) => {
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

// PUT
app.put('/api/items', (req, res) => {
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

// DELETE
app.delete('/api/items', (req, res) => {
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

app.post('/delete-item', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).send("ID required");
    }

    const index = items.findIndex(i => i.id == id);
    if (index === -1) {
        return res.status(404).send("Item not found");
    }

    items.splice(index, 1);
    res.send("Item deleted successfully");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});