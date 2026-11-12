import mongoose from 'mongoose'
import { logger } from './logger.js';

const migrateLegacyAccountCollection = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Khong the truy cap database sau khi ket noi MongoDB');

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = new Set(collections.map(({ name }) => name));

  if (!collectionNames.has('acounts')) return;

  if (!collectionNames.has('accounts')) {
    await db.collection('acounts').rename('accounts');
    logger.info('Da doi ten collection acounts thanh accounts');
    return;
  }

  const [legacyCount, accountCount] = await Promise.all([
    db.collection('acounts').estimatedDocumentCount(),
    db.collection('accounts').estimatedDocumentCount(),
  ]);

  if (legacyCount === 0) {
    await db.collection('acounts').drop();
    logger.info('Da xoa collection acounts rong');
    return;
  }

  if (accountCount === 0) {
    await db.collection('accounts').drop();
    await db.collection('acounts').rename('accounts');
    logger.info('Da chuyen du lieu tu collection acounts sang accounts');
    return;
  }

  const legacyCollection = db.collection('acounts');
  const accountCollection = db.collection('accounts');
  const legacyAccounts = await legacyCollection.find({}).toArray();
  let migratedCount = 0;
  const conflicts: string[] = [];

  for (const legacyAccount of legacyAccounts) {
    const ctuIdentifier = typeof legacyAccount.ctuIdentifier === 'string'
      ? legacyAccount.ctuIdentifier
      : '';
    const email = typeof legacyAccount.email === 'string' ? legacyAccount.email : '';
    const conflictFilters: Record<string, unknown>[] = [{ _id: legacyAccount._id }];
    if (ctuIdentifier) conflictFilters.push({ ctuIdentifier });
    if (email) conflictFilters.push({ email });

    const existing = await accountCollection.findOne({ $or: conflictFilters });
    if (existing) {
      const sameAccount = existing._id.equals(legacyAccount._id)
        && existing.ctuIdentifier === legacyAccount.ctuIdentifier
        && existing.email === legacyAccount.email;
      if (!sameAccount) conflicts.push(ctuIdentifier || legacyAccount._id.toString());
      continue;
    }

    await accountCollection.insertOne(legacyAccount);
    migratedCount += 1;
  }

  if (conflicts.length === 0) {
    await legacyCollection.drop();
    logger.info(
      `Da gop ${migratedCount}/${legacyCount} tai khoan tu acounts sang accounts va xoa collection cu`,
    );
    return;
  }

  logger.warn(
    `Da gop ${migratedCount}/${legacyCount} tai khoan legacy. Con xung dot: ${conflicts.join(', ')}`,
  );
};

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('MONGODB_URI chua duoc khai bao. Kiem tra file .env');
    return;
  }
  try {
    await mongoose.connect(uri);
    await migrateLegacyAccountCollection();
    logger.info('Da ket noi thanh cong den MongoDB Atlas')
  } catch (error) {
    logger.error(`Loi ket noi MongDB: ${(error as Error).message}`);
    throw error;
  }
}
