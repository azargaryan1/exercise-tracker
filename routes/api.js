const express = require('express')
const { getDb } = require('../db/database')

const router = express.Router()
const YMD = /^\d{4}-\d{2}-\d{2}$/

function toYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ymdToDateString(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toDateString()
}

function parseExerciseInputDate(input) {
  if (input === undefined || input === null || String(input).trim() === '') {
    return toYmd(new Date())
  }
  const s = String(input).trim()
  if (YMD.test(s)) return s
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return toYmd(parsed)
  return null
}

function parseUserId(param) {
  const id = Number(param)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}

// POST /api/users
router.post('/users', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim()
    if (!username) return res.status(400).json({ error: 'username is required' })

    const { lastID } = await getDb().run('INSERT INTO users (username) VALUES (?)', username)
    res.json({ username, _id: String(lastID) })
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'username must be unique' })
    }
    next(e)
  }
})

// GET /api/users
router.get('/users', async (req, res, next) => {
  try {
    const rows = await getDb().all('SELECT id, username FROM users ORDER BY id')
    res.json(rows.map((u) => ({ username: u.username, _id: String(u.id) })))
  } catch (e) {
    next(e)
  }
})

// POST /api/users/:_id/exercises
router.post('/users/:_id/exercises', async (req, res, next) => {
  try {
    const userId = parseUserId(req.params._id)
    if (userId === null) return res.status(400).json({ error: 'invalid user id' })

    const db = getDb()
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const description = String(req.body.description || '').trim()
    const duration = Number(req.body.duration)
    const storedDate = parseExerciseInputDate(req.body.date)
    if (!storedDate) return res.status(400).json({ error: 'invalid date' })

    if (!description) return res.status(400).json({ error: 'description is required' })
    if (!Number.isInteger(duration)) return res.status(400).json({ error: 'duration must be an integer' })

    await db.run(
      'INSERT INTO exercises (user_id, description, duration, date) VALUES (?, ?, ?, ?)',
      userId,
      description,
      duration,
      storedDate
    )

    res.json({
      username: user.username,
      _id: String(user.id),
      description,
      duration,
      date: ymdToDateString(storedDate),
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/users/:_id/logs
router.get('/users/:_id/logs', async (req, res, next) => {
  try {
    const userId = parseUserId(req.params._id)
    if (userId === null) return res.status(400).json({ error: 'invalid user id' })

    const db = getDb()
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const { from, to, limit } = req.query

    let where = 'WHERE user_id = ?'
    const params = [userId]
    if (from) {
      where += ' AND date >= ?'
      params.push(from)
    }
    if (to) {
      where += ' AND date <= ?'
      params.push(to)
    }

    const { count } = await db.get(`SELECT COUNT(*) AS count FROM exercises ${where}`, params)

    let logsSql = `SELECT description, duration, date FROM exercises ${where} ORDER BY date ASC, id ASC`
    const logsParams = [...params]
    if (limit !== undefined && limit !== '') {
      const n = Number(limit)
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'limit must be a positive integer' })
      }
      logsSql += ' LIMIT ?'
      logsParams.push(n)
    }

    const rows = await db.all(logsSql, logsParams)
    const log = rows.map((row) => ({
      description: row.description,
      duration: row.duration,
      date: ymdToDateString(row.date),
    }))

    res.json({
      username: user.username,
      _id: String(user.id),
      count,
      log,
    })
  } catch (e) {
    next(e)
  }
})

module.exports = router
