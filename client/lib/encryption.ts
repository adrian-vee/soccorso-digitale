import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ENCRYPTION_KEY_STORAGE = "@soccorso_digitale_encryption_key";

async function getWebStoredKey(): Promise<string | null> {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem(ENCRYPTION_KEY_STORAGE);
  }
  return null;
}

async function setWebStoredKey(key: string): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(ENCRYPTION_KEY_STORAGE, key);
  }
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== "undefined") {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }
  
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    
    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b2 & 15) << 2) | (b3 >> 6)] : "=";
    result += i + 2 < len ? BASE64_CHARS[b3 & 63] : "=";
  }
  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  
  const paddingLength = (base64.match(/=+$/) || [""])[0].length;
  const cleanBase64 = base64.replace(/=/g, "");
  const len = cleanBase64.length;
  const byteLen = Math.floor((len * 6) / 8);
  const bytes = new Uint8Array(byteLen);
  
  let byteIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = BASE64_CHARS.indexOf(cleanBase64[i] || "A");
    const c2 = BASE64_CHARS.indexOf(cleanBase64[i + 1] || "A");
    const c3 = BASE64_CHARS.indexOf(cleanBase64[i + 2] || "A");
    const c4 = BASE64_CHARS.indexOf(cleanBase64[i + 3] || "A");
    
    if (byteIdx < byteLen) bytes[byteIdx++] = (c1 << 2) | (c2 >> 4);
    if (byteIdx < byteLen) bytes[byteIdx++] = ((c2 & 15) << 4) | (c3 >> 2);
    if (byteIdx < byteLen) bytes[byteIdx++] = ((c3 & 3) << 6) | c4;
  }
  return bytes;
}

export async function generateEncryptionKey(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return uint8ArrayToBase64(new Uint8Array(randomBytes));
}

export async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    let storedKey: string | null = null;
    
    if (Platform.OS === "web") {
      storedKey = await getWebStoredKey();
    } else {
      storedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
    }
    
    if (storedKey) {
      return storedKey;
    }
    
    const newKey = await generateEncryptionKey();
    
    if (Platform.OS === "web") {
      await setWebStoredKey(newKey);
    } else {
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, newKey);
    }
    
    return newKey;
  } catch (error) {
    console.error("Error getting encryption key:", error);
    return await generateEncryptionKey();
  }
}

function isSubtleCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && 
         crypto.subtle !== undefined &&
         typeof crypto.subtle.encrypt === "function";
}

async function encryptWithSubtleCrypto(data: string, keyBase64: string): Promise<string> {
  const keyBytes = base64ToUint8Array(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    dataBytes
  );
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return uint8ArrayToBase64(combined);
}

async function decryptWithSubtleCrypto(encryptedBase64: string, keyBase64: string): Promise<string> {
  const keyBytes = base64ToUint8Array(keyBase64);
  const combined = base64ToUint8Array(encryptedBase64);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

function obfuscateData(data: string, keyBase64: string): string {
  const keyBytes = base64ToUint8Array(keyBase64);
  const dataBytes = new TextEncoder().encode(data);
  const result = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return "OBF:" + uint8ArrayToBase64(result);
}

function deobfuscateData(obfuscated: string, keyBase64: string): string {
  if (!obfuscated.startsWith("OBF:")) {
    throw new Error("Invalid obfuscated data format");
  }
  
  const keyBytes = base64ToUint8Array(keyBase64);
  const dataBytes = base64ToUint8Array(obfuscated.slice(4));
  const result = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(result);
}

export async function encryptData(data: any, keyBase64: string): Promise<string> {
  const dataString = JSON.stringify(data);
  
  if (isSubtleCryptoAvailable()) {
    return await encryptWithSubtleCrypto(dataString, keyBase64);
  }
  
  return obfuscateData(dataString, keyBase64);
}

export async function decryptData<T = any>(encryptedData: string, keyBase64: string): Promise<T> {
  let dataString: string;
  
  if (encryptedData.startsWith("OBF:")) {
    dataString = deobfuscateData(encryptedData, keyBase64);
  } else if (isSubtleCryptoAvailable()) {
    dataString = await decryptWithSubtleCrypto(encryptedData, keyBase64);
  } else {
    throw new Error("Cannot decrypt: SubtleCrypto not available and data is not obfuscated");
  }
  
  return JSON.parse(dataString) as T;
}

const SENSITIVE_FIELDS = [
  "patientBirthYear",
  "patientGender",
  "originAddress",
  "destinationAddress",
  "notes",
];

export async function encryptTripData(tripData: any): Promise<{ data: any; encrypted: boolean; encryptedFields: string[] }> {
  try {
    const key = await getOrCreateEncryptionKey();
    const encryptedData = { ...tripData };
    const encryptedFields: string[] = [];
    
    for (const field of SENSITIVE_FIELDS) {
      if (tripData[field] !== null && tripData[field] !== undefined && tripData[field] !== "") {
        const encrypted = await encryptData(tripData[field], key);
        encryptedData[field] = encrypted;
        encryptedFields.push(field);
      }
    }
    
    encryptedData._encrypted = true;
    encryptedData._encryptedFields = encryptedFields;
    encryptedData._encryptionMethod = isSubtleCryptoAvailable() ? "AES-GCM" : "XOR-OBF";
    
    return {
      data: encryptedData,
      encrypted: true,
      encryptedFields,
    };
  } catch (error) {
    console.error("Error encrypting trip data:", error);
    return {
      data: tripData,
      encrypted: false,
      encryptedFields: [],
    };
  }
}

export async function decryptTripData(tripData: any): Promise<any> {
  if (!tripData._encrypted || !tripData._encryptedFields) {
    return tripData;
  }
  
  try {
    const key = await getOrCreateEncryptionKey();
    const decryptedData = { ...tripData };
    
    for (const field of tripData._encryptedFields) {
      if (decryptedData[field]) {
        try {
          decryptedData[field] = await decryptData(decryptedData[field], key);
        } catch {
          console.warn(`Failed to decrypt field: ${field}`);
        }
      }
    }
    
    delete decryptedData._encrypted;
    delete decryptedData._encryptedFields;
    delete decryptedData._encryptionMethod;
    
    return decryptedData;
  } catch (error) {
    console.error("Error decrypting trip data:", error);
    return tripData;
  }
}

export function isEncryptionSupported(): boolean {
  return false;
}

export function isSecureEncryptionAvailable(): boolean {
  return isSubtleCryptoAvailable();
}
