// src/lib/encryption.ts

import CryptoJS from 'crypto-js';

const SALT = 'madartech_bot_salt_2024_secure';

export function encrypt(text: string, password: string): string {
  return CryptoJS.AES.encrypt(text, password + SALT).toString();
}

export function decrypt(encrypted: string, password: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, password + SALT);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) throw new Error('فشل فك التشفير');
    return result;
  } catch {
    throw new Error('كلمة المرور غير صحيحة');
  }
}

export function verifyPassword(encrypted: string, password: string): boolean {
  try {
    decrypt(encrypted, password);
    return true;
  } catch {
    return false;
  }
}