const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { initDb } = require('./db/database')
const apiRouter = require('./routes/api')

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

app.use('/api', apiRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

async function start() {
  await initDb()

  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
