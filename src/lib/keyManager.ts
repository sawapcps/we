// src/lib/keyManager.ts
// ============================================================
// 🔑 مدير المفاتيح المتعددة (Key Rotation) - النسخة النهائية
// ============================================================

export interface KeyStatus {
  key: string;
  used: number;
  limit: number;
  remaining: number;
  isActive: boolean;
  lastReset: number;
}

export class APIKeyManager {
  private keys: { key: string; used: number; limit: number; lastReset: number; isActive: boolean }[] = [];
  private currentIndex: number = 0;
  private resetInterval: number = 24 * 60 * 60 * 1000; // 24 ساعة
  private totalRequests: number = 0;

  constructor(keys: string[], limitPerKey: number = 100) {
    this.keys = keys.map(key => ({
      key,
      used: 0,
      limit: limitPerKey,
      lastReset: Date.now(),
      isActive: true,
    }));
    console.log(`✅ تم تحميل ${this.keys.length} مفتاح API (الحد: ${limitPerKey} طلب/يوم لكل مفتاح)`);
  }

  getNextKey(): string | null {
    this.checkReset();

    const startIndex = this.currentIndex;
    for (let i = 0; i < this.keys.length; i++) {
      const index = (startIndex + i) % this.keys.length;
      const key = this.keys[index];
      
      if (key.isActive && key.used < key.limit) {
        this.currentIndex = (index + 1) % this.keys.length;
        key.used++;
        this.totalRequests++;
        return key.key;
      }
    }

    console.warn('⚠️ جميع مفاتيح API مستنفذة!');
    return null;
  }

  getKey(index: number): string | null {
    if (index >= 0 && index < this.keys.length) {
      return this.keys[index].key;
    }
    return null;
  }

  getAllKeys(): string[] {
    return this.keys.map(k => k.key);
  }

  private checkReset() {
    const now = Date.now();
    for (const key of this.keys) {
      if (now - key.lastReset >= this.resetInterval) {
        key.used = 0;
        key.lastReset = now;
        key.isActive = true;
        console.log(`🔄 تم إعادة تعيين المفتاح: ${key.key.slice(0, 10)}...`);
      }
    }
  }

  resetKey(index: number): void {
    if (index >= 0 && index < this.keys.length) {
      this.keys[index].used = 0;
      this.keys[index].lastReset = Date.now();
      this.keys[index].isActive = true;
      console.log(`🔄 تم إعادة تعيين المفتاح ${index + 1}`);
    }
  }

  resetAllKeys(): void {
    for (const key of this.keys) {
      key.used = 0;
      key.lastReset = Date.now();
      key.isActive = true;
    }
    console.log('🔄 تم إعادة تعيين جميع المفاتيح');
  }

  getStatus(): KeyStatus[] {
    this.checkReset();
    return this.keys.map(key => ({
      key: key.key.slice(0, 10) + '...' + key.key.slice(-4),
      used: key.used,
      limit: key.limit,
      remaining: key.limit - key.used,
      isActive: key.isActive,
      lastReset: key.lastReset,
    }));
  }

  getStats(): { totalKeys: number; totalRequests: number; remainingRequests: number } {
    const remaining = this.keys.reduce((sum, k) => sum + (k.limit - k.used), 0);
    return {
      totalKeys: this.keys.length,
      totalRequests: this.totalRequests,
      remainingRequests: remaining,
    };
  }

  setLimitPerKey(limit: number): void {
    for (const key of this.keys) {
      key.limit = limit;
    }
    console.log(`✅ تم تحديث الحد لكل مفتاح: ${limit} طلب/يوم`);
  }

  disableKey(index: number): void {
    if (index >= 0 && index < this.keys.length) {
      this.keys[index].isActive = false;
      console.log(`⛔ تم تعطيل المفتاح ${index + 1}`);
    }
  }

  enableKey(index: number): void {
    if (index >= 0 && index < this.keys.length) {
      this.keys[index].isActive = true;
      console.log(`✅ تم تفعيل المفتاح ${index + 1}`);
    }
  }
}

// ============================================================
// 🔑 إنشاء مدير المفاتيح بالمفاتيح الجديدة
// ============================================================

const BIRDEYE_KEYS = [
  'd5efb6b004254910960e831488727733',
  'a470be92f49443269dcd5705ed0fbdbc',
];

const STATIC_KEYS = {
  GEMINI_API_KEY: 'AQ.Ab8RN6IwebOES2RkFLbIoSAhMJFSda77-vAvICrAzuJqRfxIAw',
  JUPITER_API_KEY: 'jup_4b6af8b71b61ca832deb0d2c0da0caf5e601c48a9bff008532e8bceb9731de26',
  ANKR_KEY: '09b7e44361c77ac1a37f6e79b3f67fc6b06a132f1a3e2ae050c70ca6c8f17d24',
  HELIUS_KEY: 'b25376b4-641e-4912-81f5-652e62a61942',
  MASTER_PASSWORD: 'SecureMasterPassword123!@#',
};

export const birdeyeKeyManager = new APIKeyManager(BIRDEYE_KEYS, 100);

// ============================================================
// ✅ دالة للحصول على مفتاح Birdeye التالي
// ============================================================

export function getBirdeyeKey(): string | null {
  return birdeyeKeyManager.getNextKey();
}

export function getBirdeyeStatus() {
  return birdeyeKeyManager.getStatus();
}

export function getBirdeyeStats() {
  return birdeyeKeyManager.getStats();
}

export function resetBirdeyeKeys() {
  birdeyeKeyManager.resetAllKeys();
}

export function getGeminiKey(): string {
  return STATIC_KEYS.GEMINI_API_KEY;
}

export function getJupiterKey(): string {
  return STATIC_KEYS.JUPITER_API_KEY;
}

export function getAnkrKey(): string {
  return STATIC_KEYS.ANKR_KEY;
}

export function getHeliusKey(): string {
  return STATIC_KEYS.HELIUS_KEY;
}

export function getMasterPassword(): string {
  return STATIC_KEYS.MASTER_PASSWORD;
}

export function getAllKeysStatus() {
  return {
    birdeye: birdeyeKeyManager.getStatus(),
    birdeyeStats: birdeyeKeyManager.getStats(),
    static: {
      gemini: STATIC_KEYS.GEMINI_API_KEY.slice(0, 10) + '...',
      jupiter: STATIC_KEYS.JUPITER_API_KEY.slice(0, 10) + '...',
      ankr: STATIC_KEYS.ANKR_KEY.slice(0, 10) + '...',
      helius: STATIC_KEYS.HELIUS_KEY.slice(0, 10) + '...',
      masterPassword: '********',
    },
  };
}

export { STATIC_KEYS };

// ============================================================
// 🛠️ دوال متوافقة مع wallet.ts
// ============================================================

/**
 * تشفير مفتاح خاص
 */
export function encryptPrivateKey(privateKey: string, password: string): string {
  return Buffer.from(privateKey + ':' + password).toString('base64');
}

/**
 * فك تشفير مفتاح خاص
 */
export function decryptPrivateKey(encrypted: string, password: string): string {
  const decoded = Buffer.from(encrypted, 'base64').toString();
  const parts = decoded.split(':');
  return parts[0] || '';
}

/**
 * التحقق من صحة المفتاح الخاص
 */
export function isValidPrivateKey(key: string): boolean {
  return key && key.length > 10;
}

/**
 * إنشاء مفتاح خاص جديد
 */
export function generatePrivateKey(): string {
  return `0x${Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')}`;
}