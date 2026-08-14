# Sprint field, 2026-08-14

Hub: https://strk20.starknet.io/hackathon
Registry: 10 entries on `starkience/strk20-hackathon` main. Ours is `neobank`.

This is an 18-day public sprint. Scoring is the public repo plus live mainnet txs. Do not put prize amounts in product copy.

## What we already have

First shield on mainnet: `0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193`.
Account deploy: `0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735`.
App now submits deploy then deposit from Shield.

## Field (not us)

| Slug / name | Repo | Bet |
|---|---|---|
| Quietline | gstohl/quietline | Encrypted on-chain mail; memos on private transfers |
| Veilcast | zkasuran/veilcast | Private prediction markets: public odds, hidden bettors |
| Veyl | codeswithroh/veyl | Private launch and trading terminal |
| offbook | Akinbola247/offbook | Private OTC settlement |
| Cutout | dmetagame/cutout | unnamed on hub |
| envelope | 0xrlawrence/envelope | unnamed |
| erebus | PoulavBhowmick03/erebus | unnamed |
| stk402 | Sarthib7/stk402 | unnamed |
| ZylithFi | ZylithFi/client | unnamed |

We are the only Consumer money account: hold, send, receive, unshield. Do not become a DEX, mail app, or OTC desk this sprint.

## Harsh Bajpai / Zcash Labs (adjacent, not on this hub)

Tweets: https://x.com/bajpaiharsh244
Zcash Labs launch: https://x.com/ZcashLabs/status/2087561557253267919
Repos: https://github.com/bajpai244 (Aztec payroll, Aztec counters, Fuel, Starknet tooling). Not a STRK20 sprint entry.

He is shipping **encrypted money that still spends in the real world**:

- zcashtocash: shielded ZEC to fiat apps via Peer + TEE. Privacy must not die at cash-out.
- Activity section he praised on zcashtocash.
- zecgift: first-ZEC gift cards now landing in Vizor.

Steal for STRK20, do not copy Zcash:

1. Activity from pool `Deposit` topic1, never `tx.sender`.
2. Honest last mile: unshield to public USDC, then an issuer later. Merchant still sees a card.
3. Receive is a registered pool address, not a new stealth scheme.

Do not start card, Peer, or native mobile today.

## Today close

1. Activity tab (public deposit legs).
2. Consented shielded balances + 10-block maturity copy.
3. Third mainnet tx: unshield of the 0.1 [STRK] once mature.
4. Public demo URL.
5. Private send only if a second registered Ready wallet exists.
