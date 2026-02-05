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
    const conversations = db.collection('conversations')
    const queue = db.collection('queue')

    const cursor = conversations.find({ archived: false })
    let created = 0

    while (await cursor.hasNext()) {
      const convo = await cursor.next()
      if (!convo?._id) continue

      const existing = await queue.findOne({ conversationId: convo._id.toString() })
      if (existing) continue

      await queue.insertOne({
        conversationId: convo._id.toString(),
        departmentId: null,
        operatorId: null,
        status: 'waiting',
        priority: 1,
        waitTime: 0,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      created += 1
    }

    console.log(`✅ Queue backfill complete. Created ${created} item(s).`)
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error('❌ Failed to backfill queue:', err)
  process.exit(1)
})
