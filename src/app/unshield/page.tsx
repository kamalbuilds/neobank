import type { Metadata } from 'next';
import { UnshieldClient } from './UnshieldClient';

export const metadata: Metadata = {
  title: 'Sotto: withdraw',
  description: 'Move STRK or USDC from your shielded balance back to a public Starknet address.',
};

export default function UnshieldPage() {
  return <UnshieldClient />;
}
