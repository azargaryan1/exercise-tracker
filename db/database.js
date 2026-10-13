const path = require('path')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

let db

async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'exercise.db'),
    driver: sqlite3.Database,
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      duration INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  return db
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

module.exports = { initDb, getDb }
