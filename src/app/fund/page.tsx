import type { Metadata } from 'next';
import { FundClient } from './FundClient';

export const metadata: Metadata = {
  title: 'Sealed: fund your account',
  description: 'Bring USDC in from Base over CCTP, or hop shielded USDC out to Base and Solana.',
};

export default function FundPage() {
  return <FundClient />;
}
