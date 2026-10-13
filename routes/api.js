const crypto = require('crypto')
const express = require('express')
const { getDb } = require('../db/database')

const router = express.Router()

function newObjectId() {
  return crypto.randomBytes(12).toString('hex')
}

function toExerciseDateString(bodyDate) {
  if (bodyDate === undefined || bodyDate === null || String(bodyDate).trim() === '') {
    return new Date().toDateString()
  }
  return new Date(bodyDate).toDateString()
}

function findUser(db, _id) {
  if (_id === undefined || _id === null || String(_id).trim() === '') return null
  return db.get('SELECT _id, username FROM users WHERE _id = ?', String(_id))
}

// POST /api/users
router.post('/users', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim()
    if (!username) return res.status(400).json({ error: 'username is required' })

    const db = getDb()
    const _id = newObjectId()

    try {
      await db.run('INSERT INTO users (_id, username) VALUES (?, ?)', _id, username)
      return res.json({ username, _id })
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT') {
        const existing = await db.get(
          'SELECT _id, username FROM users WHERE username = ?',
          username
        )
        if (existing) {
          return res.json({ username: existing.username, _id: existing._id })
        }
      }
      throw e
    }
  } catch (e) {
    next(e)
  }
})

// GET /api/users
router.get('/users', async (req, res, next) => {
  try {
    const rows = await getDb().all('SELECT _id, username FROM users ORDER BY rowid')
    res.json(rows.map((u) => ({ username: u.username, _id: u._id })))
  } catch (e) {
    next(e)
  }
})

// POST /api/users/:_id/exercises
router.post('/users/:_id/exercises', async (req, res, next) => {
  try {
    const db = getDb()
    const user = await findUser(db, req.params._id)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const description = String(req.body.description || '')
    const duration = parseInt(req.body.duration, 10)
    const date = toExerciseDateString(req.body.date)

    if (!description) return res.status(400).json({ error: 'description is required' })
    if (Number.isNaN(duration)) return res.status(400).json({ error: 'duration is required' })

    await db.run(
      'INSERT INTO exercises (user_id, description, duration, date) VALUES (?, ?, ?, ?)',
      user._id,
      description,
      duration,
      date
    )

    res.json({
      _id: user._id,
      username: user.username,
      description,
      duration,
      date,
    })
  } catch (e) {
    next(e)
  }
})

async function getUserLogs(req, res, next) {
  try {
    const db = getDb()
    const user = await findUser(db, req.params._id)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const { from, to, limit } = req.query

    const rows = await db.all(
      'SELECT description, duration, date FROM exercises WHERE user_id = ? ORDER BY id DESC',
      user._id
    )

    let log = rows.map((row) => ({
      description: String(row.description),
      duration: parseInt(row.duration, 10),
      date: new Date(row.date).toDateString(),
    }))

    if (from) {
      log = log.filter((e) => new Date(e.date) >= new Date(from))
    }
    if (to) {
      log = log.filter((e) => new Date(e.date) <= new Date(to))
    }

    const count = log.length

    if (limit !== undefined && limit !== '') {
      const n = parseInt(limit, 10)
      if (!Number.isNaN(n) && n > 0) {
        log = log.slice(0, n)
      }
    }

    const payload = {
      _id: user._id,
      username: user.username,
      count,
      log,
    }

    if (from) {
      payload.from = new Date(from).toDateString()
    }
    if (to) {
      payload.to = new Date(to).toDateString()
    }

    res.json(payload)
  } catch (e) {
    next(e)
  }
}

router.get('/users/:_id/logs', getUserLogs)
router.get('/users/:_id/logs/', getUserLogs)

module.exports = router
