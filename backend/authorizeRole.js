function authorizeRole(requiredRole) {
  return (req, res, next) => {
    if (req.user.role !== requiredRole) {
      const error = new Error("Anda tidak memiliki izin.");
      error.status = 403;
      error.code = "FORBIDDEN";

      return next(error);
    }

    next();
  };
}

module.exports = authorizeRole;