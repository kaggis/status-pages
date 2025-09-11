import CryptoJS from 'crypto-js';
import { SECRET_KEY } from './env';

export const encryptSecret = (secret: string): string => {
  const secretKey = SECRET_KEY
  if (!secretKey) {
    throw new Error('SECRET_KEY environment variable is required');
  }
  
  return CryptoJS.AES.encrypt(secret, secretKey).toString();
};

export const decryptSecret = (encryptedSecret: string): string => {
  const secretKey = SECRET_KEY
  if (!secretKey) {
    throw new Error('SECRET_KEY environment variable is required');
  }
  
  const bytes = CryptoJS.AES.decrypt(encryptedSecret, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};