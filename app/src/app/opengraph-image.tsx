import { ImageResponse } from 'next/og';

export const alt = 'BlockHelix: Execution policy for onchain vaults';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: '#2beead',
            fontSize: 30,
            letterSpacing: 10,
          }}
        >
          BLOCKHELIX
        </div>
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: 78,
            fontWeight: 700,
            marginTop: 36,
            lineHeight: 1.1,
          }}
        >
          Execution policy for onchain vaults
        </div>
        <div
          style={{
            display: 'flex',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 34,
            marginTop: 36,
          }}
        >
          Checked before every trade. Re-verified on-chain.
        </div>
      </div>
    ),
    { ...size },
  );
}
