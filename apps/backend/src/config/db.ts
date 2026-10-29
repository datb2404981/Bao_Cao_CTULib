import mongoose from 'mongoose'
import { logger } from './logger.js';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('MONGODB_URI chua duoc khai bao. Kiem tra file .env');
    return;
  }
  try {
    await mongoose.connect(uri);
    logger.info('Da ket noi thanh cong den MongoDB Atlas')
  } catch (error) {
    logger.error(`Loi ket noi MongDB: ${(error as Error).message}`);
    
  }
}