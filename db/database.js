const path = require('path')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

let db

async function resetTablesIfSchemaOutdated(database) {
  const usersTable = await database.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  )

  if (!usersTable) return

  const userCols = await database.all('PRAGMA table_info(users)')
  const usersOk = userCols.some((col) => col.name === '_id')

  const exercisesTable = await database.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='exercises'"
  )

  let exercisesOk = !exercisesTable
  if (exercisesTable) {
    const exerciseCols = await database.all('PRAGMA table_info(exercises)')
    const userIdCol = exerciseCols.find((col) => col.name === 'user_id')
    exercisesOk = Boolean(userIdCol) && userIdCol.type.toUpperCase() === 'TEXT'
  }

  if (!usersOk || !exercisesOk) {
    await database.exec('DROP TABLE IF EXISTS exercises; DROP TABLE IF EXISTS users;')
  }
}

async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'exercise.db'),
    driver: sqlite3.Database,
  })

  await resetTablesIfSchemaOutdated(db)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      _id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      duration INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(_id)
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
