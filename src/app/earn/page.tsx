import type { Metadata } from 'next';
import { EarnClient } from './EarnClient';

export const metadata: Metadata = {
  title: 'Sotto: earn on restaurant swipes',
  description: 'Live total_assets in the restaurant earn vault, read directly from Sepolia.',
};

export default function EarnPage() {
  return <EarnClient />;
}
