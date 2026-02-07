import { PublicKey, Transaction } from '@solana/web3.js';
import { KMSClient, SignCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';
import nacl from 'tweetnacl';

let kmsClient: KMSClient | null = null;
let kmsPublicKey: PublicKey | null = null;
let rawPublicKey: Uint8Array | null = null;

const KMS_KEY_ID = process.env.KMS_KEY_ID;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

function extractEd25519PublicKey(derBytes: Uint8Array): Uint8Array {
  // Ed25519 public keys in DER format have a fixed prefix
  // The actual 32-byte key is at the end
  if (derBytes.length < 32) {
    throw new Error('Invalid DER public key: too short');
  }
  return derBytes.slice(-32);
}

export async function initKmsSigner(): Promise<void> {
  if (!KMS_KEY_ID) {
    console.log('[kms] KMS_KEY_ID not set, using local keypairs');
    return;
  }

  try {
    kmsClient = new KMSClient({ region: AWS_REGION });

    const command = new GetPublicKeyCommand({ KeyId: KMS_KEY_ID });
    const response = await kmsClient.send(command);

    if (!response.PublicKey) {
      throw new Error('No public key returned from KMS');
    }

    rawPublicKey = extractEd25519PublicKey(new Uint8Array(response.PublicKey));
    kmsPublicKey = new PublicKey(rawPublicKey);

    console.log('[kms] Initialized with pubkey:', kmsPublicKey.toBase58());
  } catch (err) {
    console.error('[kms] Failed to initialize:', err);
    kmsClient = null;
    kmsPublicKey = null;
    rawPublicKey = null;
  }
}

export function getKmsPublicKey(): PublicKey | null {
  return kmsPublicKey;
}

export function isKmsEnabled(): boolean {
  return kmsClient !== null && kmsPublicKey !== null;
}

async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (!kmsClient || !rawPublicKey) {
    throw new Error('KMS signer not initialized');
  }

  const command = new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: message,
    MessageType: 'RAW',
    SigningAlgorithm: 'ED25519_SHA_512',
  });

  const response = await kmsClient.send(command);

  if (!response.Signature) {
    throw new Error('No signature returned from KMS');
  }

  const signature = new Uint8Array(response.Signature);

  // Verify signature locally
  if (!nacl.sign.detached.verify(message, signature, rawPublicKey)) {
    throw new Error('KMS signature verification failed');
  }

  return signature;
}

export async function signTransactionWithKms(
  transaction: Transaction
): Promise<Transaction> {
  if (!kmsClient || !kmsPublicKey) {
    throw new Error('KMS signer not initialized');
  }

  const message = transaction.serializeMessage();
  const signature = await signMessage(message);

  transaction.addSignature(kmsPublicKey, Buffer.from(signature));

  return transaction;
}

export { kmsClient as kmsSigner };
