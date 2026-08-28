import type { Metadata } from 'next';
import { VaultShell } from '../components/v2/VaultShell';

export const metadata: Metadata = {
  title: 'Sealed: hold your shielded balance',
  description: 'Your STRK and USDC balance, shielded behind the live STRK20 pool on Starknet.',
};

export default function AccountHome() {
  return <VaultShell />;
}
