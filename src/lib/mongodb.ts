import { MongoClient, Db } from "mongodb";

declare global {
  var _mongoClient: MongoClient | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoDb(): Promise<Db> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI");
  }

  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(mongoUri);
    await global._mongoClient.connect();
  }

  return global._mongoClient.db("daily");
}
