import type { Metadata } from 'next';
import { UnshieldClient } from './UnshieldClient';

export const metadata: Metadata = {
  title: 'Sotto: unshield to public',
  description: 'Withdraw shielded STRK or USDC back to a public Starknet address.',
};

export default function UnshieldPage() {
  return <UnshieldClient />;
}
