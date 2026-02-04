import crypto from 'crypto';

export function hashArtifact(data: string): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}
