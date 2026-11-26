module.exports = function errorHandler(error, req, res, next) {
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: "Validation error", errors: error.errors });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "A conflicting record already exists" });
  }
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Server error" });
};
