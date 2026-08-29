import type { Metadata } from 'next';
import { SpendClient } from './SpendClient';

export const metadata: Metadata = {
  title: 'Sealed: spend privately',
  description: 'Settle a payment from your shielded STRK balance. The recipient sees an address, never your identity.',
};

export default function SpendPage() {
  return <SpendClient />;
}
