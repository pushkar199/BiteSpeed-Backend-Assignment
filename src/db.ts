import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";

export async function initDB(): Promise<Database> {
  const dbPath = process.env.DB_FILE || path.resolve(process.cwd(), "contacts.db");
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT CHECK(linkPrecedence IN ('primary','secondary')),
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      deletedAt TEXT
    );
  `);

  return db;
}
