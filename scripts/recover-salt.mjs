// Recovers the deployment salt for an undeployed Starknet account by testing
// candidate (class, constructor-calldata, salt) triples against the funded address.
import { hash, num } from "starknet";
import { readFileSync } from "node:fs";

const TARGET = process.argv[2];
if (!TARGET) { console.error("usage: node scripts/recover-salt.mjs <funded-address>"); process.exit(1); }

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const priv = env.match(/^SEPOLIA_PRIVATE_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!priv) { console.error("missing SEPOLIA_PRIVATE_KEY in .env"); process.exit(1); }

// starkCurve lives under stark.ec.starkCurve (newer) or exported flat (older)
const ec = (await import("starknet")).stark?.ec?.starkCurve ?? (await import("starknet")).ec?.starkCurve;
if (!ec) { console.error("cannot locate starkCurve in installed starknet pkg"); process.exit(1); }
const pubkey = ec.getStarkKey(priv);
console.log("derived pubkey:", pubkey);

// Ready/Argent Cairo accounts: constructor(owner: ContractAddress, guardian: ContractAddress)
// OZ Cairo accounts: constructor(public_key: felt252)
const CLASSES = {
  ready_v0_4_0_owner_guardian_zero: ["0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f", [pubkey, "0x0"]],
  ready_v0_4_0_owner_only: ["0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f", [pubkey]],
  oz_v1_0_0_pubkey: ["0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564", [pubkey]],
};

const targetBig = BigInt(TARGET);
const MAX_SALT = 50000;

for (const [name, [cls, ctor]] of Object.entries(CLASSES)) {
  for (let salt = 0; salt <= MAX_SALT; salt++) {
    const addr = BigInt(hash.calculateContractAddressFromHash(
      num.toHex(salt), cls, ctor, "0x0"
    ));
    if (addr === targetBig) {
      console.log(`MATCH variant=${name} salt=${salt} hex=0x${salt.toString(16)}`);
      process.exit(0);
    }
  }
  console.error(`exhausted ${name} to ${MAX_SALT}`);
}
console.log("NO_MATCH");
