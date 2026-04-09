import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { create, mplCore, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import {
  generateSigner,
  signerIdentity,
  publicKey,
  createSignerFromKeypair,
  type PublicKey as UmiPublicKey,
} from '@metaplex-foundation/umi';
import { PublicKey as Web3PublicKey, Keypair } from '@solana/web3.js';
import { RPC_URL } from '../config';

const s3 = new S3Client({});
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET || 'blockhelix-dev-storage';
const PUBLIC_BUCKET_URL = `https://${UPLOAD_BUCKET}.s3.amazonaws.com`;

// Runtime mint wallet: uses the same wallet the runtime already holds
// (via AGENT_WALLET_PRIVATE_KEY env var). This wallet pays the ~0.003 SOL
// mint cost and then transfers the NFT ownership to the creator in the
// same transaction via the `owner` field on `create`.
function getUmiWithSigner() {
  const umi = createUmi(RPC_URL).use(mplCore());
  const secretKeyJson = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!secretKeyJson) {
    throw new Error('AGENT_WALLET_PRIVATE_KEY not set — cannot mint NFTs');
  }
  const secretKey = Uint8Array.from(JSON.parse(secretKeyJson));
  const web3kp = Keypair.fromSecretKey(secretKey);
  const umiKp = umi.eddsa.createKeypairFromSecretKey(web3kp.secretKey);
  const signer = createSignerFromKeypair(umi, umiKp);
  umi.use(signerIdentity(signer));
  return umi;
}

// Palette per archetype — the orb color at birth. Matches what MoodOrb shows
// for a freshly born, neutral vault.
const ARCHETYPE_COLORS: Record<string, { primary: string; accent: string }> = {
  scout: { primary: '#60a5fa', accent: '#93c5fd' },      // blue
  critic: { primary: '#a78bfa', accent: '#c4b5fd' },     // violet
  trader: { primary: '#34d399', accent: '#6ee7b7' },     // emerald
  oracle: { primary: '#fbbf24', accent: '#fcd34d' },     // amber
  custom: { primary: '#a7f3d0', accent: '#d1fae5' },     // pale emerald (default)
};

function orbSvg(archetype: string | undefined): string {
  const key = (archetype || 'custom').toLowerCase();
  const colors = ARCHETYPE_COLORS[key] || ARCHETYPE_COLORS.custom;
  const { primary, accent } = colors;

  // Static SVG — a radial-gradient orb on black, same visual language as the
  // live MoodOrb but frozen at birth. 1024x1024 for crisp wallet display.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0f0f0f"/>
      <stop offset="100%" stop-color="#050505"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.14"/>
      <stop offset="70%" stop-color="${primary}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb" cx="42%" cy="38%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="1"/>
      <stop offset="40%" stop-color="${primary}" stop-opacity="0.95"/>
      <stop offset="85%" stop-color="${primary}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shine" cx="42%" cy="38%" r="25%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="30"/>
    </filter>
  </defs>

  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="420" fill="url(#halo)" filter="url(#glow)"/>
  <circle cx="512" cy="512" r="250" fill="url(#orb)"/>
  <circle cx="430" cy="430" r="90" fill="url(#shine)"/>
</svg>`;
}

async function uploadSvg(svg: string, key: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: svg,
    ContentType: 'image/svg+xml',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${PUBLIC_BUCKET_URL}/${key}`;
}

async function uploadJson(obj: unknown, key: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: JSON.stringify(obj, null, 2),
    ContentType: 'application/json',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${PUBLIC_BUCKET_URL}/${key}`;
}

export interface MintVaultNftParams {
  vault: string;                  // the vault pubkey (used in metadata + key path)
  name: string;
  archetype?: string;
  ownerPubkey: string;             // Solana pubkey that will own the NFT
  liveUrl: string;                 // URL to the vault's public page
}

export interface MintVaultNftResult {
  mint: string;
  metadataUri: string;
  imageUri: string;
  txSignature: string;
}

export async function mintVaultNft(params: MintVaultNftParams): Promise<MintVaultNftResult> {
  const umi = getUmiWithSigner();

  // 1. Generate and upload the orb avatar
  const svg = orbSvg(params.archetype);
  const imageKey = `nft/${params.vault}/avatar.svg`;
  const imageUri = await uploadSvg(svg, imageKey);

  // 2. Build metadata JSON (Metaplex standard, works with all marketplaces)
  const metadata = {
    name: params.name,
    description: `BlockHelix vault-agent. Born ${new Date().toISOString().slice(0, 10)}. Live view: ${params.liveUrl}`,
    image: imageUri,
    external_url: params.liveUrl,
    attributes: [
      { trait_type: 'Archetype', value: params.archetype || 'custom' },
      { trait_type: 'Platform', value: 'BlockHelix' },
      { trait_type: 'Vault', value: params.vault },
      { trait_type: 'Born', value: new Date().toISOString().slice(0, 10) },
      { trait_type: 'Level', value: 'Hatchling' },
    ],
    properties: {
      category: 'image',
      files: [{ uri: imageUri, type: 'image/svg+xml' }],
    },
  };

  const metadataKey = `nft/${params.vault}/metadata.json`;
  const metadataUri = await uploadJson(metadata, metadataKey);

  // 3. Mint the NFT via Metaplex Core.
  // The runtime signer pays the mint cost; `owner` is set to the creator's
  // pubkey so the NFT lands directly in their wallet — no separate transfer.
  const asset = generateSigner(umi);
  const ownerUmi = publicKey(params.ownerPubkey) as UmiPublicKey;

  const result = await create(umi, {
    asset,
    name: params.name,
    uri: metadataUri,
    owner: ownerUmi,
  }).sendAndConfirm(umi);

  const signature = typeof result.signature === 'string'
    ? result.signature
    : Buffer.from(result.signature).toString('base64');

  return {
    mint: asset.publicKey.toString(),
    metadataUri,
    imageUri,
    txSignature: signature,
  };
}

// Returns the current holder of a vault's NFT by reading the asset on-chain.
// Lightly cached to avoid hammering RPC on every chat request.
interface HolderCacheEntry {
  holder: string;
  checkedAt: number;
}
const holderCache = new Map<string, HolderCacheEntry>();
const HOLDER_CACHE_TTL = 60 * 1000; // 60 seconds

export async function getVaultNftHolder(mintAddress: string): Promise<string | null> {
  const cached = holderCache.get(mintAddress);
  if (cached && Date.now() - cached.checkedAt < HOLDER_CACHE_TTL) {
    return cached.holder;
  }

  try {
    const umi = createUmi(RPC_URL).use(mplCore());
    const asset = await fetchAssetV1(umi, publicKey(mintAddress) as UmiPublicKey);
    const holder = asset.owner.toString();
    holderCache.set(mintAddress, { holder, checkedAt: Date.now() });
    return holder;
  } catch (err) {
    console.error(`[vault-nft] Failed to fetch holder for ${mintAddress}:`, err);
    return null;
  }
}

export function isNftHolder(holder: string | null, wallet: string): boolean {
  if (!holder) return false;
  return holder === wallet;
}

// Validate a Solana pubkey string before using it in a mint call.
export function isValidSolanaPubkey(pubkey: string): boolean {
  try {
    new Web3PublicKey(pubkey);
    return true;
  } catch {
    return false;
  }
}
