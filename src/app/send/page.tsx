import type { Metadata } from 'next';
import { SendClient } from './SendClient';

export const metadata: Metadata = {
  title: 'Sealed: send privately',
  description: 'Send shielded STRK or USDC to a recipient already registered in the STRK20 pool.',
};

export default function SendPage() {
  return <SendClient />;
}
