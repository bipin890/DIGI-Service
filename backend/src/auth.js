import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export async function loginHandler(req, res) {
  const { username, password } = req.body ?? {};
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword || !process.env.JWT_SECRET) {
    return res.status(500).json({ error: "Server authentication environment is not configured." });
  }
  const userOk = typeof username === "string" && username === expectedUser;
  // Compare against a bcrypt hash if ADMIN_PASSWORD_HASH is set; otherwise compare configured secret.
  const passOk = process.env.ADMIN_PASSWORD_HASH
    ? await bcrypt.compare(String(password ?? ""), process.env.ADMIN_PASSWORD_HASH)
    : typeof password === "string" && password === expectedPassword;
  if (!userOk || !passOk) return res.status(401).json({ error: "Invalid username or password." });
  const token = jwt.sign({ sub: expectedUser, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, username: expectedUser });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (!token) throw new Error("missing token");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Please log in again." });
  }
}
