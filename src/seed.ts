import "dotenv/config";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { putItem, scanByEntityPrefix } from "./db/repo.js";
import type { UserRecord } from "./types.js";

async function main() {
  const users = await scanByEntityPrefix("USER#");
  if (users.length > 0) {
    console.log("Users already exist; skip seed.");
    return;
  }
  const id = uuid();
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const rec: UserRecord = {
    pk: `USER#${id}`,
    sk: "PROFILE",
    entityType: "USER",
    email: "admin@laundry.local",
    passwordHash,
    name: "Administrator",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putItem(rec);
  console.log("Seeded admin user:", rec.email, "/ password:", password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
