export const env = {
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/cloudops",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  secureCookies: process.env.NODE_ENV === "production",
  dbName: process.env.MONGODB_DB ?? "cloudops",
};

export function assertProdSecrets() {
  if (process.env.NODE_ENV === "production" && env.jwtSecret === "dev-secret-change-me") {
    throw new Error("JWT_SECRET must be set in production");
  }
}
