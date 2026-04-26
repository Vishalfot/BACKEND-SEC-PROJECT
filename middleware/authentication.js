import jwt from "jsonwebtoken";

const authentication = async (req, res, next) => {
  try {
    // 1. Extract Token from Cookies or Authorization Header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. Immediate check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    // 3. Verify Token
    // Ensure JWT_SECRET is defined in your .env file
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * 4. Attach Payload to req.user
     * Important: Ensure your Login/Register logic includes 'role' and 'id' in the JWT payload.
     * This allows isAdmin.js to work without extra database queries.
     */
    req.user = decoded;

    next();

  } catch (error) {
    console.error("Auth Middleware Error:", error.message);

    // Specific error handling for expired tokens
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again."
      });
    }

    return res.status(500).json({ // Changed to 500 for debug if it's not a standard auth error
      success: false,
      message: "Authentication failed: " + error.message
    });
  }
};

export default authentication;