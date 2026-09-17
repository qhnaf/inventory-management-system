const db = require("./db");

function authorizePermission(requiredPermission) {
  return (req, res, next) => {
    const userId = req.user.userId;

    const sql = `
      SELECT p.id
      FROM users u
      JOIN roles r
        ON u.role_id = r.id
      JOIN role_permissions rp
        ON r.id = rp.role_id
      JOIN permissions p
        ON rp.permission_id = p.id
      WHERE u.id = ?
        AND p.name = ?
      LIMIT 1
    `;

    db.query(sql, [userId, requiredPermission], (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.length === 0) {
        const error = new Error("Anda tidak memiliki izin.");
        error.status = 403;
        error.code = "FORBIDDEN";

        return next(error);
      }

      next();
    });
  };
}

module.exports = authorizePermission;