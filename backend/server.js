require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizePermission = require("./authorizePermission");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Inventory Backend!");
});

app.get(
  "/api/products",
  authenticateToken,
  authorizePermission("products.read"),
  (req, res, next) => {
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
  },
);

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

app.post(
  "/api/products",
  authenticateToken,
  authorizePermission("products.create"),
  (req, res, next) => {
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
      const error = new Error(
        "Price harus berupa angka dan lebih besar dari 0.",
      );

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
  },
);

app.post(
  "/api/products/:id/stock",
  authenticateToken,
  authorizePermission("stock.update"),
  (req, res, next) => {
    const productId = Number(req.params.id);
    const { quantity, type, reason } = req.body;

    // =========================
    // 1. VALIDASI PRODUCT ID
    // =========================
    if (!Number.isInteger(productId) || productId <= 0) {
      const error = new Error("ID product tidak valid.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    // =========================
    // 2. VALIDASI QUANTITY
    // =========================
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error(
        "Quantity harus berupa bilangan bulat lebih dari 0.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    // =========================
    // 3. VALIDASI TYPE
    // =========================
    if (!["IN", "OUT"].includes(type)) {
      const error = new Error("Type harus berupa IN atau OUT.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    // =========================
    // 4. VALIDASI REASON
    // =========================
    if (
      typeof reason !== "string" ||
      reason.trim() === "" ||
      reason.trim().length > 255
    ) {
      const error = new Error("Reason wajib diisi dan maksimal 255 karakter.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    // =========================
    // 5. MULAI TRANSACTION
    // =========================
    db.beginTransaction((err) => {
      if (err) {
        return next(err);
      }

      // =========================
      // 6. CEK PRODUCT
      // =========================
      const selectSql = `
        SELECT id, name, stock
        FROM products
        WHERE id = ?
        FOR UPDATE
      `;

      db.query(selectSql, [productId], (err, results) => {
        if (err) {
          return db.rollback(() => next(err));
        }

        if (results.length === 0) {
          const error = new Error("Product tidak ditemukan.");

          error.status = 404;
          error.code = "NOT_FOUND";

          return db.rollback(() => next(error));
        }

        const product = results[0];

        // =========================
        // 7. HITUNG STOCK BARU
        // =========================
        let newStock;

        if (type === "IN") {
          newStock = product.stock + quantity;
        } else {
          newStock = product.stock - quantity;
        }

        // =========================
        // 8. CEK STOCK NEGATIF
        // =========================
        if (newStock < 0) {
          const error = new Error(
            "Stock tidak mencukupi untuk melakukan pengurangan.",
          );

          error.status = 400;
          error.code = "INSUFFICIENT_STOCK";

          return db.rollback(() => next(error));
        }

        // =========================
        // 9. UPDATE STOCK
        // =========================
        const updateSql = `
          UPDATE products
          SET stock = ?
          WHERE id = ?
        `;

        db.query(updateSql, [newStock, productId], (err, updateResult) => {
          if (err) {
            return db.rollback(() => next(err));
          }

          if (updateResult.affectedRows !== 1) {
            const error = new Error("Gagal memperbarui stock product.");

            error.status = 500;
            error.code = "STOCK_UPDATE_FAILED";

            return db.rollback(() => next(error));
          }

          // =========================
          // 10. INSERT STOCK HISTORY
          // =========================
          const historySql = `
              INSERT INTO stock_history (
                product_id,
                quantity,
                type,
                reason,
                user_id
              )
              VALUES (?, ?, ?, ?, ?)
            `;

          db.query(
            historySql,
            [productId, quantity, type, reason.trim(), req.user.userId],
            (err, historyResult) => {
              if (err) {
                return db.rollback(() => next(err));
              }

              // =========================
              // 11. COMMIT TRANSACTION
              // =========================
              db.commit((err) => {
                if (err) {
                  return db.rollback(() => next(err));
                }

                // =========================
                // 12. RESPONSE
                // =========================
                res.status(200).json({
                  success: true,
                  message: "Stock berhasil diperbarui.",
                  data: {
                    productId,
                    productName: product.name,
                    previousStock: product.stock,
                    quantity,
                    type,
                    newStock,
                    historyId: historyResult.insertId,
                  },
                });
              });
            },
          );
        });
      });
    });
  },
);

app.put(
  "/api/products/:id",
  authenticateToken,
  authorizePermission("products.update"),
  (req, res, next) => {
    const productId = Number(req.params.id);
    const { name, price, category } = req.body;

    if (!Number.isInteger(productId) || productId <= 0) {
      const error = new Error("ID product tidak valid.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (typeof name !== "string" || name.trim() === "") {
      const error = new Error("Nama product wajib diisi.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (typeof price !== "number" || price <= 0) {
      const error = new Error(
        "Price harus berupa angka dan lebih besar dari 0.",
      );

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

    const checkProductSql = `
      SELECT id
      FROM products
      WHERE id = ?
    `;

    db.query(checkProductSql, [productId], (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        const error = new Error("Product tidak ditemukan.");

        error.status = 404;
        error.code = "NOT_FOUND";

        return next(error);
      }

      const updateSql = `
        UPDATE products
        SET name = ?, price = ?, category = ?
        WHERE id = ?
      `;

      const values = [
        name.trim(),
        price,
        category.trim(),
        productId,
      ];

      db.query(updateSql, values, (err) => {
        if (err) {
          return next(err);
        }

        res.status(200).json({
          success: true,
          data: {
            id: productId,
            name: name.trim(),
            price,
            category: category.trim(),
          },
        });
      });
    });
  },
);

app.delete(
  "/api/products/:id",
  authenticateToken,
  authorizePermission("products.delete"),
  (req, res, next) => {
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
  },
);

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
  SELECT
    u.id,
    u.username,
    u.password_hash,
    r.name AS role
  FROM users u
  JOIN roles r
    ON u.role_id = r.id
  WHERE u.username = ?
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

app.get(
  "/api/products/:id/stock-history",
  authenticateToken,
  authorizePermission("stock.read"),
  (req, res, next) => {
    const productId = Number(req.params.id);
    const { type } = req.query;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (!Number.isInteger(productId) || productId <= 0) {
      const error = new Error("ID product tidak valid.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (!Number.isInteger(page) || page <= 0) {
      const error = new Error("Page harus berupa bilangan bulat lebih dari 0.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      const error = new Error("Limit harus berupa bilangan bulat lebih dari 0.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (type !== undefined && !["IN", "OUT"].includes(type)) {
      const error = new Error("Type harus berupa IN atau OUT.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total
      FROM stock_history sh
      WHERE sh.product_id = ?
    `;

    const countValues = [productId];

    if (type !== undefined) {
      countSql += ` AND sh.type = ?`;
      countValues.push(type);
    }

    db.query(countSql, countValues, (err, countResults) => {
      if (err) {
        return next(err);
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      let sql = `
        SELECT
          sh.id,
          sh.product_id,
          p.name AS product_name,
          sh.quantity,
          sh.type,
          sh.reason,
          u.username,
          sh.created_at
        FROM stock_history sh
        JOIN products p
          ON sh.product_id = p.id
        JOIN users u
          ON sh.user_id = u.id
        WHERE sh.product_id = ?
      `;

      const values = [productId];

      if (type !== undefined) {
        sql += ` AND sh.type = ?`;
        values.push(type);
      }

      sql += `
        ORDER BY sh.created_at DESC, sh.id DESC
        LIMIT ? OFFSET ?
      `;

      values.push(limit, offset);

      db.query(sql, values, (err, results) => {
        if (err) {
          return next(err);
        }

        res.status(200).json({
          success: true,
          data: results,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        });
      });
    });
  },
);

app.get(
  "/api/suppliers",
  authenticateToken,
  authorizePermission("suppliers.read"),
  (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (!Number.isInteger(page) || page <= 0) {
      const error = new Error(
        "Page harus berupa bilangan bulat lebih dari 0.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      const error = new Error(
        "Limit harus berupa bilangan bulat lebih dari 0.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const offset = (page - 1) * limit;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM suppliers
    `;

    db.query(countSql, (err, countResults) => {
      if (err) {
        return next(err);
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      const sql = `
        SELECT
          id,
          name,
          phone,
          email,
          address,
          created_at
        FROM suppliers
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `;

      db.query(sql, [limit, offset], (err, results) => {
        if (err) {
          return next(err);
        }

        res.status(200).json({
          success: true,
          data: results,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        });
      });
    });
  },
);

app.get(
  "/api/suppliers/:id",
  authenticateToken,
  authorizePermission("suppliers.read"),
  (req, res, next) => {
    const supplierId = Number(req.params.id);

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      const error = new Error("ID supplier tidak valid.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const sql = `
      SELECT
        id,
        name,
        phone,
        email,
        address,
        created_at
      FROM suppliers
      WHERE id = ?
    `;

    db.query(sql, [supplierId], (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        const error = new Error("Supplier tidak ditemukan.");

        error.status = 404;
        error.code = "NOT_FOUND";

        return next(error);
      }

      res.status(200).json({
        success: true,
        data: results[0],
      });
    });
  },
);

app.post(
  "/api/suppliers",
  authenticateToken,
  authorizePermission("suppliers.create"),
  (req, res, next) => {
    const { name, phone, email, address } = req.body;

    if (typeof name !== "string" || name.trim() === "") {
      const error = new Error("Nama supplier wajib diisi.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (name.trim().length > 100) {
      const error = new Error(
        "Nama supplier maksimal 100 karakter.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (
      phone !== undefined &&
      phone !== null &&
      typeof phone !== "string"
    ) {
      const error = new Error("Phone harus berupa string.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (
      email !== undefined &&
      email !== null &&
      typeof email !== "string"
    ) {
      const error = new Error("Email harus berupa string.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (
      address !== undefined &&
      address !== null &&
      typeof address !== "string"
    ) {
      const error = new Error("Address harus berupa string.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (phone && phone.trim().length > 20) {
      const error = new Error(
        "Phone maksimal 20 karakter.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (email && email.trim().length > 100) {
      const error = new Error(
        "Email maksimal 100 karakter.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const sql = `
      INSERT INTO suppliers (
        name,
        phone,
        email,
        address
      )
      VALUES (?, ?, ?, ?)
    `;

    const values = [
      name.trim(),
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      address ? address.trim() : null,
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        return next(err);
      }

      res.status(201).json({
        success: true,
        message: "Supplier berhasil dibuat.",
        data: {
          id: result.insertId,
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          address: address ? address.trim() : null,
        },
      });
    });
  },
);

app.put(
  "/api/suppliers/:id",
  authenticateToken,
  authorizePermission("suppliers.update"),
  (req, res, next) => {
    const supplierId = Number(req.params.id);
    const { name, phone, email, address } = req.body;

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      const error = new Error("ID supplier tidak valid.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (typeof name !== "string" || name.trim() === "") {
      const error = new Error("Nama supplier wajib diisi.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (name.trim().length > 100) {
      const error = new Error(
        "Nama supplier maksimal 100 karakter.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (
      phone !== undefined &&
      phone !== null &&
      typeof phone !== "string"
    ) {
      const error = new Error("Phone harus berupa string.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (
      email !== undefined &&
      email !== null &&
      typeof email !== "string"
    ) {
      const error = new Error("Email harus berupa string.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (
      address !== undefined &&
      address !== null &&
      typeof address !== "string"
    ) {
      const error = new Error("Address harus berupa string.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (phone && phone.trim().length > 20) {
      const error = new Error(
        "Phone maksimal 20 karakter.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    if (email && email.trim().length > 100) {
      const error = new Error(
        "Email maksimal 100 karakter.",
      );

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const checkSupplierSql = `
      SELECT id
      FROM suppliers
      WHERE id = ?
    `;

    db.query(checkSupplierSql, [supplierId], (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        const error = new Error("Supplier tidak ditemukan.");

        error.status = 404;
        error.code = "NOT_FOUND";

        return next(error);
      }

      const updateSql = `
        UPDATE suppliers
        SET
          name = ?,
          phone = ?,
          email = ?,
          address = ?
        WHERE id = ?
      `;

      const values = [
        name.trim(),
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
        supplierId,
      ];

      db.query(updateSql, values, (err) => {
        if (err) {
          return next(err);
        }

        res.status(200).json({
          success: true,
          message: "Supplier berhasil diperbarui.",
          data: {
            id: supplierId,
            name: name.trim(),
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null,
            address: address ? address.trim() : null,
          },
        });
      });
    });
  },
);

app.delete(
  "/api/suppliers/:id",
  authenticateToken,
  authorizePermission("suppliers.delete"),
  (req, res, next) => {
    const supplierId = Number(req.params.id);

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      const error = new Error("ID supplier tidak valid.");

      error.status = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const checkSupplierSql = `
      SELECT id, name
      FROM suppliers
      WHERE id = ?
    `;

    db.query(checkSupplierSql, [supplierId], (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        const error = new Error("Supplier tidak ditemukan.");

        error.status = 404;
        error.code = "NOT_FOUND";

        return next(error);
      }

      const supplier = results[0];

      const deleteSql = `
        DELETE FROM suppliers
        WHERE id = ?
      `;

      db.query(deleteSql, [supplierId], (err, result) => {
        if (err) {
          return next(err);
        }

        if (result.affectedRows !== 1) {
          const error = new Error("Gagal menghapus supplier.");

          error.status = 500;
          error.code = "DELETE_FAILED";

          return next(error);
        }

        res.status(200).json({
          success: true,
          message: "Supplier berhasil dihapus.",
          data: {
            id: supplier.id,
            name: supplier.name,
          },
        });
      });
    });
  },
);

app.get(
  "/api/products/:id/suppliers",
  authenticateToken,
  authorizePermission("suppliers.read"),
  (req, res, next) => {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      const error = new Error("ID product tidak valid.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      return next(error);
    }

    const checkProductSql = `
      SELECT id, name
      FROM products
      WHERE id = ?
    `;

    db.query(checkProductSql, [productId], (err, productResults) => {
      if (err) return next(err);

      if (productResults.length === 0) {
        const error = new Error("Product tidak ditemukan.");
        error.status = 404;
        error.code = "NOT_FOUND";
        return next(error);
      }

      const sql = `
        SELECT
          s.id,
          s.name,
          s.phone,
          s.email,
          s.address
        FROM product_suppliers ps
        JOIN suppliers s
          ON ps.supplier_id = s.id
        WHERE ps.product_id = ?
        ORDER BY s.id ASC
      `;

      db.query(sql, [productId], (err, results) => {
        if (err) return next(err);

        res.status(200).json({
          success: true,
          data: {
            product: productResults[0],
            suppliers: results,
          },
        });
      });
    });
  },
);

app.post(
  "/api/products/:id/suppliers",
  authenticateToken,
  authorizePermission("suppliers.update"),
  (req, res, next) => {
    const productId = Number(req.params.id);
    const { supplierId } = req.body;

    if (!Number.isInteger(productId) || productId <= 0) {
      const error = new Error("ID product tidak valid.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      return next(error);
    }

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      const error = new Error("ID supplier tidak valid.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      return next(error);
    }

    const checkProductSql = `
      SELECT id, name
      FROM products
      WHERE id = ?
    `;

    db.query(checkProductSql, [productId], (err, productResults) => {
      if (err) return next(err);

      if (productResults.length === 0) {
        const error = new Error("Product tidak ditemukan.");
        error.status = 404;
        error.code = "NOT_FOUND";
        return next(error);
      }

      const checkSupplierSql = `
        SELECT id, name
        FROM suppliers
        WHERE id = ?
      `;

      db.query(checkSupplierSql, [supplierId], (err, supplierResults) => {
        if (err) return next(err);

        if (supplierResults.length === 0) {
          const error = new Error("Supplier tidak ditemukan.");
          error.status = 404;
          error.code = "NOT_FOUND";
          return next(error);
        }

        const checkRelationshipSql = `
          SELECT product_id, supplier_id
          FROM product_suppliers
          WHERE product_id = ?
            AND supplier_id = ?
        `;

        db.query(
          checkRelationshipSql,
          [productId, supplierId],
          (err, relationshipResults) => {
            if (err) return next(err);

            if (relationshipResults.length > 0) {
              const error = new Error(
                "Supplier sudah terhubung dengan product.",
              );
              error.status = 409;
              error.code = "CONFLICT";
              return next(error);
            }

            const insertSql = `
              INSERT INTO product_suppliers (product_id, supplier_id)
              VALUES (?, ?)
            `;

            db.query(
              insertSql,
              [productId, supplierId],
              (err) => {
                if (err) return next(err);

                res.status(201).json({
                  success: true,
                  message: "Supplier berhasil ditambahkan ke product.",
                  data: {
                    product: productResults[0],
                    supplier: supplierResults[0],
                  },
                });
              },
            );
          },
        );
      });
    });
  },
);

app.delete(
  "/api/products/:id/suppliers/:supplierId",
  authenticateToken,
  authorizePermission("suppliers.update"),
  (req, res, next) => {
    const productId = Number(req.params.id);
    const supplierId = Number(req.params.supplierId);

    if (!Number.isInteger(productId) || productId <= 0) {
      const error = new Error("ID product tidak valid.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      return next(error);
    }

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      const error = new Error("ID supplier tidak valid.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      return next(error);
    }

    const checkRelationshipSql = `
      SELECT
        ps.product_id,
        ps.supplier_id,
        p.name AS product_name,
        s.name AS supplier_name
      FROM product_suppliers ps
      JOIN products p
        ON ps.product_id = p.id
      JOIN suppliers s
        ON ps.supplier_id = s.id
      WHERE ps.product_id = ?
        AND ps.supplier_id = ?
    `;

    db.query(
      checkRelationshipSql,
      [productId, supplierId],
      (err, results) => {
        if (err) return next(err);

        if (results.length === 0) {
          const error = new Error(
            "Relationship product dan supplier tidak ditemukan.",
          );
          error.status = 404;
          error.code = "NOT_FOUND";
          return next(error);
        }

        const relationship = results[0];

        const deleteSql = `
          DELETE FROM product_suppliers
          WHERE product_id = ?
            AND supplier_id = ?
        `;

        db.query(
          deleteSql,
          [productId, supplierId],
          (err, result) => {
            if (err) return next(err);

            if (result.affectedRows !== 1) {
              const error = new Error(
                "Gagal menghapus relationship product dan supplier.",
              );
              error.status = 500;
              error.code = "DELETE_FAILED";
              return next(error);
            }

            res.status(200).json({
              success: true,
              message:
                "Supplier berhasil dilepas dari product.",
              data: {
                product: {
                  id: relationship.product_id,
                  name: relationship.product_name,
                },
                supplier: {
                  id: relationship.supplier_id,
                  name: relationship.supplier_name,
                },
              },
            });
          },
        );
      },
    );
  },
);

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token valid.",
    data: {
      user: req.user,
    },
  });
});

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
