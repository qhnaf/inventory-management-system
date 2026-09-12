const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("Token autentikasi diperlukan.");
    error.status = 401;
    error.code = "AUTHENTICATION_REQUIRED";

    return next(error);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    const authError = new Error("Token tidak valid atau sudah kedaluwarsa.");
    authError.status = 401;
    authError.code = "INVALID_TOKEN";
    
    next(authError);
}
}

module.exports = authenticateToken;