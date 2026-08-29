import type { Metadata } from 'next';
import { ReceiveClient } from './ReceiveClient';

export const metadata: Metadata = {
  title: 'Sealed: receive privately',
  description: 'Build a payment request link or QR code for a private STRK or USDC transfer into your account.',
};

export default function ReceivePage() {
  return <ReceiveClient />;
}
