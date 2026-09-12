require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizeRole = require("./authorizeRole");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Inventory Backend!");
});

app.get("/api/products", authenticateToken, (req, res, next) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);

  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);

  const category = req.query.category;

  const sort = req.query.sort || "id";
  const order = req.query.order || "asc";

  const allowedSorts = ["id", "name", "stock", "price"];
  const allowedOrders = ["asc", "desc"];

  if (!allowedSorts.includes(sort)) {
    const error = new Error("Sort tidak valid.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (!allowedOrders.includes(order)) {
    const error = new Error("Order tidak valid.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (Number.isNaN(page) || page < 1) {
    const error = new Error("Page harus berupa angka minimal 1.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (Number.isNaN(limit) || limit < 1) {
    const error = new Error("Limit harus berupa angka minimal 1.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
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
      return next(err);
    }

    db.query(countSql, countParams, (err, countResults) => {
      if (err) {
        return next(err);
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
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

app.get("/api/products/:id", authenticateToken, (req, res, next) => {
  const productId = req.params.id;

  const sql = `
    SELECT *
    FROM products
    WHERE id = ?
  `;

  db.query(sql, [productId], (err, results) => {
    if (err) {
      return next(err);
    }

    if (results.length === 0) {
      const error = new Error("Product tidak ditemukan.");

      error.status = 404;
      error.code = "NOT_FOUND";

      return next(error);
    }

    res.json({
      success: true,
      data: results[0],
    });
  });
});

app.post("/api/products", authenticateToken, authorizeRole("admin"), (req, res, next) => {
  const { name, stock, price, category } = req.body;

  if (typeof name !== "string" || name.trim() === "") {
    const error = new Error("Nama product wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (typeof stock !== "number" || stock < 0) {
    const error = new Error(
      "Stock harus berupa angka dan tidak boleh negatif.",
    );

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (typeof price !== "number" || price <= 0) {
    const error = new Error("Price harus berupa angka dan lebih besar dari 0.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (typeof category !== "string" || category.trim() === "") {
    const error = new Error("Category wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  const sql = `
    INSERT INTO products (name, stock, price, category)
    VALUES (?, ?, ?, ?)
  `;

  const values = [name.trim(), stock, price, category.trim()];

  db.query(sql, values, (err, result) => {
    if (err) {
      return next(err);
    }

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name: name.trim(),
        stock,
        price,
        category: category.trim(),
      },
    });
  });
});

app.put("/api/products/:id", authenticateToken, authorizeRole("admin"), (req, res, next) => {
  const productId = req.params.id;
  const { name, stock, price, category } = req.body;

  if (typeof name !== "string" || name.trim() === "") {
    const error = new Error("Nama product wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (typeof stock !== "number" || stock < 0) {
    const error = new Error(
      "Stock harus berupa angka dan tidak boleh negatif.",
    );

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (typeof price !== "number" || price <= 0) {
    const error = new Error("Price harus berupa angka dan lebih besar dari 0.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  if (typeof category !== "string" || category.trim() === "") {
    const error = new Error("Category wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  const sql = `
    UPDATE products
    SET name = ?, stock = ?, price = ?, category = ?
    WHERE id = ?
  `;

  const values = [name.trim(), stock, price, category.trim(), productId];

  db.query(sql, values, (err, result) => {
    if (err) {
      return next(err);
    }

    if (result.affectedRows === 0) {
      const error = new Error("Product tidak ditemukan.");

      error.status = 404;
      error.code = "NOT_FOUND";

      return next(error);
    }

    res.status(200).json({
      success: true,
      data: {
        id: Number(productId),
        name: name.trim(),
        stock,
        price,
        category: category.trim(),
      },
    });
  });
});

app.delete("/api/products/:id", authenticateToken, authorizeRole("admin"), (req, res, next) => {
  const productId = req.params.id;

  const sql = `
    DELETE FROM products
    WHERE id = ?
  `;

  db.query(sql, [productId], (err, result) => {
    if (err) {
      return next(err);
    }

    if (result.affectedRows === 0) {
      const error = new Error("Product tidak ditemukan.");

      error.status = 404;
      error.code = "NOT_FOUND";
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "Product berhasil dihapus.",
      data: {
        id: Number(productId),
      },
    });
  });
});

app.post("/api/auth/register", async (req, res, next) => {
  const { username, password } = req.body;

  // Validasi username
  if (typeof username !== "string" || username.trim() === "") {
    const error = new Error("Username wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  // Validasi password
  if (typeof password !== "string" || password === "") {
    const error = new Error("Password wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  try {
    // Hash password sebelum disimpan ke database
    const passwordHash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (username, password_hash)
      VALUES (?, ?)
    `;

    const values = [username.trim(), passwordHash];

    db.query(sql, values, (err, result) => {
      if (err) {
        // Username sudah digunakan
        if (err.code === "ER_DUP_ENTRY") {
          const error = new Error("Username sudah digunakan.");

          error.status = 409;
          error.code = "CONFLICT";

          return next(error);
        }

        return next(err);
      }

      res.status(201).json({
        success: true,
        message: "User berhasil didaftarkan.",
        data: {
          id: result.insertId,
          username: username.trim(),
        },
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", (req, res, next) => {
  const { username, password } = req.body;

  // Validasi username
  if (typeof username !== "string" || username.trim() === "") {
    const error = new Error("Username wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  // Validasi password
  if (typeof password !== "string" || password === "") {
    const error = new Error("Password wajib diisi.");

    error.status = 400;
    error.code = "VALIDATION_ERROR";

    return next(error);
  }

  const sql = `
    SELECT id, username, password_hash, role
    FROM users
    WHERE username = ?
  `;

  db.query(sql, [username.trim()], async (err, results) => {
    if (err) {
      return next(err);
    }

    // Username tidak ditemukan
    if (results.length === 0) {
      const error = new Error("Username atau password salah.");

      error.status = 401;
      error.code = "INVALID_CREDENTIALS";

      return next(error);
    }

    const user = results[0];

    try {
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash,
      );

      // Password salah
      if (!isPasswordValid) {
        const error = new Error("Username atau password salah.");

        error.status = 401;
        error.code = "INVALID_CREDENTIALS";

        return next(error);
      }

      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h",
        },
      );

      // Login berhasil
      res.status(200).json({
        success: true,
        message: "Login berhasil.",
        data: {
          id: user.id,
          username: user.username,
        },
        token,
      });
    } catch (error) {
      next(error);
    }
  });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token valid.",
    data: {
      user: req.user,
    },
  });
});

app.get(
  "/api/auth/admin-only",
  authenticateToken,
  authorizeRole("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Anda berhasil mengakses area admin.",
      data: {
        user: req.user,
      },
    });
  },
);

app.use((err, req, res, next) => {
  console.error(err);

  const status = err.status || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";
  const message = err.message || "Terjadi kesalahan pada server.";

  res.status(status).json({
    success: false,
    message,
    error: code,
  });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
