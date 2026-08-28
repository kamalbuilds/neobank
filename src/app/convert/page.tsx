import type { Metadata } from 'next';
import { ConvertClient } from './ConvertClient';

export const metadata: Metadata = {
  title: 'Sealed: convert privately',
  description: 'Swap shielded STRK and USDC through AVNU without exposing the trade on your public address.',
};

export default function ConvertPage() {
  return <ConvertClient />;
}
