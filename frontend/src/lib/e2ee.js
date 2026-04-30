/*
  Simple E2EE utilities using Web Crypto API
  - RSA-OAEP (2048) for encrypting AES keys (JWK stored for public key)
  - AES-GCM (256) for message encryption

  Notes:
  - Public key stored on backend as JWK JSON string via POST /users/public-key
  - Private key stored in browser localStorage (for demo). In production use IndexedDB + OS secure storage.
  - AES raw keys are stored per-chat in localStorage under `e2ee:aes:<chatId>` (base64)
  - Keys NEVER leave the browser unencrypted (private key never sent to backend)
*/

import { getPublicKey as apiGetPublicKey, postPublicKey as apiPostPublicKey } from '../api'

const enc = new TextEncoder()
const dec = new TextDecoder()

const arrayBufferToBase64 = (buf) => {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

const base64ToArrayBuffer = (b64) => {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

const storageKeyPrivate = 'e2ee:private_jwk'
const storageAESKey = (chatId) => `e2ee:aes:${chatId}`

const getChatId = (a, b) => {
  // deterministic chat id for storage
  return [a.toString(), b.toString()].sort().join(':')
}

export async function generateRSAKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  )
  return keyPair
}

export async function exportPublicJwk(publicKey) {
  const jwk = await window.crypto.subtle.exportKey('jwk', publicKey)
  return JSON.stringify(jwk)
}

export async function exportPrivateJwk(privateKey) {
  const jwk = await window.crypto.subtle.exportKey('jwk', privateKey)
  return JSON.stringify(jwk)
}

export function privateJwkToPublicJwk(privateJwkJson) {
  const jwk = typeof privateJwkJson === 'string' ? JSON.parse(privateJwkJson) : privateJwkJson
  return JSON.stringify({
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: jwk.alg,
    ext: true,
    key_ops: ['encrypt'],
  })
}

export async function importPrivateJwk(jwkJson) {
  const jwk = typeof jwkJson === 'string' ? JSON.parse(jwkJson) : jwkJson
  return await window.crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'])
}

export async function importPublicJwk(jwkJson) {
  const jwk = typeof jwkJson === 'string' ? JSON.parse(jwkJson) : jwkJson
  return await window.crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
}

export function savePrivateJwk(jwkJson) {
  localStorage.setItem(storageKeyPrivate, typeof jwkJson === 'string' ? jwkJson : JSON.stringify(jwkJson))
}

export function getPrivateJwk() {
  return localStorage.getItem(storageKeyPrivate)
}

export async function generateAndStoreKeyPairAndUpload() {
  const pair = await generateRSAKeyPair()
  const pub = await exportPublicJwk(pair.publicKey)
  const priv = await exportPrivateJwk(pair.privateKey)
  savePrivateJwk(priv)
  // upload public key to backend
  try {
    await apiPostPublicKey(pub)
  } catch (e) {
    console.warn('Failed to upload public key:', e.message || e)
  }
  return { publicKey: pub, privateKey: priv }
}

export async function ensureKeyPairAndUploadIfMissing() {
  let priv = getPrivateJwk()
  if (!priv) {
    return await generateAndStoreKeyPairAndUpload()
  }

  // If a private key already exists locally, re-upload the matching public key.
  // This fixes cases where the browser kept the private key but the server row is empty.
  try {
    const pub = privateJwkToPublicJwk(priv)
    await apiPostPublicKey(pub)
  } catch (e) {
    console.warn('Failed to re-upload public key:', e.message || e)
  }

  return { privateKey: priv }
}

export async function generateAESKey() {
  const key = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  return key
}

export async function exportAESRaw(key) {
  const raw = await window.crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(raw)
}

export async function importAESRaw(b64) {
  const raw = base64ToArrayBuffer(b64)
  return await window.crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

export async function encryptWithAESGCM(key, plaintext) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return { encryptedMessage: arrayBufferToBase64(ct), iv: arrayBufferToBase64(iv.buffer) }
}

export async function decryptWithAESGCM(key, b64cipher, b64iv) {
  const cipher = base64ToArrayBuffer(b64cipher)
  const iv = base64ToArrayBuffer(b64iv)
  const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, cipher)
  return dec.decode(plain)
}

export async function encryptAESKeyWithRSA(publicJwkString, aesRawB64) {
  const pub = await importPublicJwk(publicJwkString)
  const raw = base64ToArrayBuffer(aesRawB64)
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw)
  return arrayBufferToBase64(encrypted)
}

export async function decryptAESKeyWithRSA(privateJwkString, encryptedKeyB64) {
  const priv = await importPrivateJwk(privateJwkString)
  const encrypted = base64ToArrayBuffer(encryptedKeyB64)
  const raw = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, encrypted)
  return arrayBufferToBase64(raw)
}

export function saveAESForChat(chatId, rawBase64) {
  localStorage.setItem(storageAESKey(chatId), rawBase64)
}

export function getAESForChat(chatId) {
  return localStorage.getItem(storageAESKey(chatId))
}

// High-level: encrypt message for chat (senderId, receiverId). Returns encrypted payload
export async function encryptForChat(senderId, receiverId, plaintext) {
  const chatId = getChatId(senderId, receiverId)
  let aesRaw = getAESForChat(chatId)
  let encryptedKey = null

  // Always wrap the chat AES key for the receiver so any message can bootstrap
  // a fresh device/browser without depending on the first message.
  let receiverPublicKey = null

  if (!aesRaw) {
    const aes = await generateAESKey()
    aesRaw = await exportAESRaw(aes)
    // store AES locally for chat
    saveAESForChat(chatId, aesRaw)
  }

  // Fetch receiver public key every time so each message can carry a wrapped key.
  const { data } = await apiGetPublicKey(receiverId)
  if (!data?.publicKey) throw new Error('Receiver public key not available')
  receiverPublicKey = data.publicKey
  encryptedKey = await encryptAESKeyWithRSA(receiverPublicKey, aesRaw)

  const aesKey = await importAESRaw(aesRaw)
  const { encryptedMessage, iv } = await encryptWithAESGCM(aesKey, plaintext)
  return { encryptedMessage, iv, encryptedKey }
}

// High-level decryption for a received message object
// partnerId should be the other participant in the chat.
export async function decryptMessageObject(myId, message, partnerIdOverride = null) {
  const partnerId = partnerIdOverride || (message.sender?._id ? message.sender._id : message.sender)
  const chatId = getChatId(myId, partnerId)
  let aesRaw = getAESForChat(chatId)

  if (!aesRaw && message.encryptedKey) {
    const priv = getPrivateJwk()
    if (!priv) throw new Error('Private key not found for decryption')
    // decrypt AES raw using our private key
    const rawB64 = await decryptAESKeyWithRSA(priv, message.encryptedKey)
    aesRaw = rawB64
    saveAESForChat(chatId, aesRaw)
  }

  if (!aesRaw) {
    throw new Error('AES key not found for chat')
  }
  const aesKey = await importAESRaw(aesRaw)
  const plaintext = await decryptWithAESGCM(aesKey, message.encryptedMessage, message.iv)
  return plaintext
}

export default {
  generateRSAKeyPair,
  exportPublicJwk,
  exportPrivateJwk,
  privateJwkToPublicJwk,
  importPrivateJwk,
  importPublicJwk,
  savePrivateJwk,
  getPrivateJwk,
  ensureKeyPairAndUploadIfMissing,
  encryptForChat,
  decryptMessageObject,
}
