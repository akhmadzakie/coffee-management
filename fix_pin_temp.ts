import { db } from "./src/db/db.ts";
import * as schema from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function fixPin() {
  try {
    await db
      .update(schema.users)
      .set({ pin: "1234" })
      .where(eq(schema.users.username, "admin"));
    console.log("Successfully updated admin pin to 1234");
  } catch (err) {
    console.error("Failed to update pin:", err);
  } finally {
    process.exit(0);
  }
}

fixPin();
