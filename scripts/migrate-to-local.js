/**
 * ============================================================
 * CLOUD → LOCAL DATABASE MIGRATION SCRIPT (Node.js version)
 * ============================================================
 * এই স্ক্রিপ্টটি MongoDB Atlas (Cloud) থেকে সমস্ত ডেটা
 * আপনার লোকাল MongoDB তে কপি করবে। 
 * এর জন্য mongodump বা mongorestore এর দরকার নেই।
 *
 * চালানোর নিয়ম:
 *   node scripts/migrate-to-local.js
 * ============================================================
 */

const { MongoClient } = require('mongodb');

// ── কনফিগারেশন ───────────────────────────────────────────────
const CLOUD_URI = 'mongodb+srv://alfa131431_db_user:lKqeu30JI9vAvXbH@cluster0.ms30jes.mongodb.net/pos_db?retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_URI = 'mongodb://127.0.0.1:27017/pos_db';
// ─────────────────────────────────────────────────────────────

async function migrate() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Cloud → Local Database Migration Starting...    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');

  let cloudClient, localClient;

  try {
    console.log('🔄 Connecting to Cloud Database...');
    cloudClient = await MongoClient.connect(CLOUD_URI);
    const cloudDb = cloudClient.db();
    console.log('✅ Connected to Cloud!');

    console.log('🔄 Connecting to Local Database...');
    localClient = await MongoClient.connect(LOCAL_URI);
    const localDb = localClient.db();
    console.log('✅ Connected to Local!');

    // Get all collections from the cloud database
    const collections = await cloudDb.listCollections().toArray();

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      
      // Skip system collections
      if (collectionName.startsWith('system.')) continue;

      console.log(`\n📦 Migrating collection: ${collectionName}...`);
      
      const cloudCollection = cloudDb.collection(collectionName);
      const localCollection = localDb.collection(collectionName);

      // Fetch all documents from the cloud collection
      const documents = await cloudCollection.find({}).toArray();

      if (documents.length > 0) {
        // Clear the local collection first (optional, but good for a fresh start)
        await localCollection.deleteMany({});
        
        // Insert documents into the local collection
        await localCollection.insertMany(documents);
        console.log(`   ✅ Copied ${documents.length} documents.`);
      } else {
        console.log(`   ⚠️ Collection is empty. Skipping.`);
      }
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║   ✅ Migration Complete! All data copied!         ║');
    console.log('║                                                   ║');
    console.log('║   Your data is now in Local MongoDB:              ║');
    console.log('║   mongodb://127.0.0.1:27017/pos_db               ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR DURING MIGRATION:', error.message);
    console.error('Make sure your local MongoDB server is running (Step 1).');
  } finally {
    if (cloudClient) await cloudClient.close();
    if (localClient) await localClient.close();
  }
}

migrate();
