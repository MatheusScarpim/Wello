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

const name = process.env.SEED_ADMIN_NAME || 'Admin'
const email = process.env.SEED_ADMIN_EMAIL || 'admin@wello.local'
const password = process.env.SEED_ADMIN_PASSWORD || 'admin123'

async function run() {
  const client = new MongoClient(dbUrl)
  try {
    await client.connect()
    const db = client.db(dbName)
    const operators = db.collection('operators')

    const now = new Date()
    const operatorDoc = {
      name,
      email,
      password,
      role: 'admin',
      status: 'online',
      departmentIds: [],
      settings: {
        maxConcurrentChats: 5,
        receiveNotifications: true,
        soundEnabled: true,
        autoAcceptChats: false
      },      createdAt: now,
      updatedAt: now
    }

    const result = await operators.updateOne(
      { email },
      { $set: operatorDoc },
      { upsert: true }
    )

    const action = result.upsertedId ? 'created' : 'updated'
    console.log(`✅ Operator ${action}: ${email}`)
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error('❌ Failed to seed operator:', err)
  process.exit(1)
})

