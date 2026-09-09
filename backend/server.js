const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Inventory Backend!");
});

app.get("/api/products", (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);

  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);

  const category = req.query.category;

  const sort = req.query.sort || "id";
  const order = req.query.order || "asc";

  const allowedSorts = ["id", "name", "stock", "price"];
  const allowedOrders = ["asc", "desc"];

  if (!allowedSorts.includes(sort)) {
    return res.status(400).json({
      message: "Sort tidak valid.",
    });
  }

  if (!allowedOrders.includes(order)) {
    return res.status(400).json({
      message: "Order tidak valid.",
    });
  }

  if (Number.isNaN(page) || page < 1) {
    return res.status(400).json({
      message: "Page harus berupa angka minimal 1.",
    });
  }

  if (Number.isNaN(limit) || limit < 1) {
    return res.status(400).json({
      message: "Limit harus berupa angka minimal 1.",
    });
  }

  const offset = (page - 1) * limit;

  let sql = `
    SELECT *
    FROM products
  `;

  let countSql = `
    SELECT COUNT(*) AS total
    FROM products
  `;

  const params = [];
  const countParams = [];

  if (category) {
    sql += ` WHERE category = ?`;
    countSql += ` WHERE category = ?`;

    params.push(category);
    countParams.push(category);
  }

  sql += ` ORDER BY ${sort} ${order.toUpperCase()} LIMIT ? OFFSET ?`;

  params.push(limit, offset);

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Gagal mengambil products:", err.message);

      return res.status(500).json({
        message: "Gagal mengambil data products.",
      });
    }

    db.query(countSql, countParams, (err, countResults) => {
      if (err) {
        console.error("Gagal menghitung products:", err.message);

        return res.status(500).json({
          message: "Gagal menghitung total products.",
        });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        data: results,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: totalPages,
        },
      });
    });
  });
});

app.get("/api/products/:id", (req, res) => {
  const productId = req.params.id;

  const sql = `
    SELECT *
    FROM products
    WHERE id = ?
  `;

  db.query(sql, [productId], (err, results) => {
    if (err) {
      console.error("Gagal mengambil product:", err.message);

      return res.status(500).json({
        message: "Gagal mengambil product.",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Product tidak ditemukan.",
      });
    }

    res.json(results[0]);
  });
});

app.post("/api/products", (req, res) => {
  const { name, stock, price, category } = req.body;

  const sql = `
    INSERT INTO products (name, stock, price, category)
    VALUES (?, ?, ?, ?)
  `;

  const values = [name, stock, price, category];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Gagal menambahkan product:", err.message);

      return res.status(500).json({
        message: "Gagal menambahkan product.",
      });
    }

    res.status(201).json({
      id: result.insertId,
      name,
      stock,
      price,
      category,
    });
  });
});

app.put("/api/products/:id", (req, res) => {
  const productId = req.params.id;
  const { name, stock, price, category } = req.body;

  const sql = `
    UPDATE products
    SET name = ?, stock = ?, price = ?, category = ?
    WHERE id = ?
  `;

  const values = [name, stock, price, category, productId];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Gagal mengupdate product:", err.message);

      return res.status(500).json({
        message: "Gagal mengupdate product.",
      });
    }

    res.json({
      id: Number(productId),
      name,
      stock,
      price,
      category,
    });
  });
});

app.delete("/api/products/:id", (req, res) => {
  const productId = req.params.id;

  const sql = `
    DELETE FROM products
    WHERE id = ?
  `;

  db.query(sql, [productId], (err, result) => {
    if (err) {
      console.error("Gagal menghapus product:", err.message);

      return res.status(500).json({
        message: "Gagal menghapus product.",
      });
    }

    res.json({
      message: "Product berhasil dihapus.",
      id: Number(productId),
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
