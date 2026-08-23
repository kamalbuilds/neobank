#!/usr/bin/env node
/* print-deploy-plan.mjs
 *
 * Prints the sncast declare+deploy command list for the Sepolia STRK20
 * dress rehearsal. Reads nothing secret. Reminds about the owner argument
 * for ProgrammableSpendAnonymizer.
 *
 * Usage: node scripts/print-deploy-plan.mjs
 */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { format } from "node:util";

const __dirname = new URL(".", import.meta.url).pathname;

const SCRIPT_PATH = pathToFileURL(new URL("./print-deploy-plan.mjs", import.meta.url)).pathname;

// — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
// Configuration: contract names and placeholder notes
// — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

const CONTRACTS = [
  {
    name: "PrivatePayoutAnonymizer",
    declare: "sncast declare --contract-name PrivatePayoutAnonymizer --network sepolia",
    deploy: "sncast deploy --class-hash <PRIVATE_PAYOUT_CLASS_HASH> --network sepolia",
    note: "no constructor arguments",
  },
  {
    name: "PrivateSpendAnonymizer",
    declare: "sncast declare --contract-name PrivateSpendAnonymizer --network sepolia",
    deploy: "sncast deploy --class-hash <PRIVATE_SPEND_CLASS_HASH> --network sepolia",
    note: "no constructor arguments",
  },
  {
    name: "ProgrammableSpendAnonymizer",
    declare: "sncast declare --contract-name ProgrammableSpendAnonymizer --network sepolia",
    deploy: 'sncast deploy --class-hash <PROGRAMMABLE_SPEND_CLASS_HASH> --constructor-calldata <DEPLOYER_ADDRESS> --network sepolia',
    note: "owner arg = deployer address — do not forget to pass it!",
  },
];

const RPC = "https://starknet-sepolia.infura.io/v3/<project-id>";
const POOL_SEPOLIA = "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const POOL_MAINNET = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

// — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
// Output
// — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

const timestamp = new Date().toISOString();

console.log("\n=== Sepolia STRK20 Dress Rehearsal — Deploy Plan ===\n");
console.log(`Generated: ${timestamp}\n`);

// Declare phase
console.log("1. DECLARE CONTRACTS");
console.log("   (fetch Sierra from Starknet, get class hashes)");
CONTRACTS.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.declare}`);
  console.log(`      → ${c.name}: ${c.note}\n`);
});

// Deploy phase
console.log("2. DEPLOY CONTRACTS");
console.log("   (send constructor calldata, receive contract addresses)");
CONTRACTS.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.deploy}`);
  console.log(`      → ${c.name}: ${c.note}\n`);
});

// Sepolia pool note
console.log(`3. STRK20 POOL (Sepolia): ${POOL_SEPOLIA}`);
console.log   `   Fee read live via get_fee_amount (was 2 STRK on Sepolia, 6 STRK on mainnet)\n`;

// Reminder about owner arg
console.log("⚠️  REMINDER:");
console.log(
  `   The ${CONTRACTS[2].name} deploy command requires --constructor-calldata <DEPLOYER_ADDRESS>.`,
);
console.log(
  "   This is the owner argument. Omitting it will cause the deployment to fail \
   or default to zero address.",
);
console.log();

// Next steps
console.log("4. NEXT:");
// console.log("   • Run: node scripts/print-deploy-plan.mjs  (prints this plan)");
console.log("   • Compile the three Cairo contracts (sierra/casm artifacts).");
console.log("   • Execute the declare commands above, recording class hashes.");
console.log("   • Execute the deploy commands above, recording contract addresses.");
console.log("   • Run the Sepolia dress rehearsal per docs/submission/SEPOLIA_REHEARSAL.md.");
console.log("   • Append class hashes + addresses to strk20.json \"contracts\" array.");
console.log("   • Execute the app-level rehearsal order (shield → wait → private send → unshield → programmable spend).");
console.log("   • Run: npm run verify:claim  to validate strk20.json.\n");