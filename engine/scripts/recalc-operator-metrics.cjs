const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

function loadEnvIfExists(envPath) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath })
    return true
  }
  return false
}

const projectRoot = path.resolve(__dirname, '..')
const envCandidates = [
  path.join(projectRoot, '.env'),
  path.join(projectRoot, '.env.development'),
  path.join(projectRoot, '.env.local')
]

for (const envPath of envCandidates) {
  if (loadEnvIfExists(envPath)) break
}

const dbUrl = process.env.DB_URL || 'mongodb://localhost:27018'
const dbName = process.env.DB_NAME || 'nxzap_db'

async function run() {
  const client = new MongoClient(dbUrl)
  try {
    await client.connect()
    const db = client.db(dbName)
    const operators = db.collection('operators')
    const conversations = db.collection('conversations')

    const ops = await operators.find({}).toArray()
    let updated = 0

    for (const op of ops) {
      const opId = op._id?.toString()
      if (!opId) continue

      const active = await conversations.countDocuments({
        operatorId: opId,
        archived: false
      })

      await operators.updateOne(
        { _id: op._id },
        {
          $set: {
            'metrics.activeChats': active,
            updatedAt: new Date()
          }
        }
      )

      updated += 1
    }

    console.log(`✅ Recalculated metrics for ${updated} operator(s).`)
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error('❌ Failed to recalc operator metrics:', err)
  process.exit(1)
})
