import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// El permiso de Google de cada cuenta (su refresh token) se guarda cifrado con AES-256-GCM. La clave está en Secret
// Manager (CALENDAR_TOKEN_KEY: 32 bytes en base64) y nunca en Firestore. El uid va como dato asociado: un token
// cifrado para una cuenta no se descifra en el documento de otra.

export interface SealedToken {
  iv: string;
  data: string;
  tag: string;
}

export const parseTokenKey = (secret: string) => {
  const key = Buffer.from(secret.trim(), 'base64');
  if (key.length !== 32) throw new Error('CALENDAR_TOKEN_KEY must be 32 bytes in base64');
  return key;
};

export const sealToken = (token: string, key: Buffer, uid: string): SealedToken => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(uid, 'utf8'));
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
};

export const openToken = (sealed: SealedToken, key: Buffer, uid: string) => {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAAD(Buffer.from(uid, 'utf8'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
};
