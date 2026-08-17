# Issuer outreach log, 2026-08-14

Filled from the `neobank` Brave profile (port 9381) using identity in `~/.config/identity/profile.md`. No passwords invented. No KYC documents uploaded. No secrets.

Use-case text used everywhere: non-custodial STRK20 private money account, demo https://neobank-six.vercel.app, last mile is unshield then Circle CCTP V2 to Base/Solana, then a standing wallet an issuer can JIT-pull. Visa cannot debit a note.

## Results

| Issuer | URL | What happened |
|---|---|---|
| Bridge (Stripe) | https://www.bridge.xyz/requestfreedemo | Form is HubSpot portal `47053228` form `cfa456b2-5feb-4c0e-a5b5-8a5c4fdf61e7`. Filled in the iframe (name, Gmail, github repo, Starter, Cards + Orchestration, volume under 10k, not ready this quarter, use case). UI submit stuck on "Form is submitting" (Brave blocks hsforms API). Direct POST to `forms.hubspot.com/uploads/form/v2/...` returned **BLOCKED_EMAIL** for both `kamalthedev7+letsbuild@gmail.com` and `geniusamansingh@gmail.com`. Bridge wants a company domain email. |
| Rain | https://www.rain.xyz/contact-us | Multi-step form filled (Cards, pre-launch, 1-5 people, B2C + web3, US/Asia, TPV 0). Submit returned **"We couldn't send your message."** Likely business-email and/or LinkedIn URL (we do not have a LinkedIn in identity; github was not accepted as a substitute). |
| Thredd | https://www.thredd.ai/get-in-touch | Cloudflare Turnstile: "Performing security verification". Did not pass from this profile. |
| Gnosis Pay partners | https://partners.gnosispay.com/ | Reached WorkOS/auth email sign-in for `geniusamansingh@gmail.com`. Next screen is password or email code plus **"we need to be sure you are human."** Stopped. No password invented. |
| HypurrFi card | https://app.hypurrfi.com/card | Verifier is Privy (586 wallets, no Ready) then identity check then points. Not an issuer for Starknet. Not submitted. |

## What you need to finish (user-only)

1. A **company-domain email** (not Gmail). Put it in `~/.config/identity/profile.md` if you want forms retried. Bridge and Rain both treat Gmail as invalid or drop the post.
2. A real **LinkedIn URL** for Rain.
3. Solve Thredd Cloudflare and Gnosis human-check in this Brave window, or open those two URLs yourself.
4. After that, I can resubmit Bridge and Rain without touching passwords.

No issuer agreement exists yet. No card UI was added from these attempts.
