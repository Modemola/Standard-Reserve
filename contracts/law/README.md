# `contracts/law` — audit-narrative Solidity twins

Phase E of [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md). **Not deployed, ever** — see the repo's non-goals (§0). This subproject exists so an auditor can check the TS engine's pure math (`packages/engine`) against an independent Solidity implementation of the same formulas.

`src/LawMath.sol` is a `library` of `pure` functions:

- `dutchPrice` — the license/charter Dutch decay, `P(t) = P_start * (P_floor/P_start)^(t/86400)`
- `resolutionFeeRate` — the exit-fee quadratic, `feeFloor + (feeCeil-feeFloor) * P^2`
- `contractionSpend` — the hourly contraction buyback tick, `min(10% vaultEth, 0.2% poolEthReserve)`

`test/LawMath.t.sol` runs a fuzz suite plus shared vectors generated from the live TS engine (`test/vectors/generate.ts` — run with `pnpm --filter @standard-law/engine exec tsx test/vectors/generate.ts` from the repo root, writes `test/vectors/*.json` here) so both implementations are checked against the same inputs.

`dutchPrice` is **not bit-exact** with the TS engine: the engine computes the decay with IEEE-754 `Math.pow`, Solidity has no floating point, so this uses [PRBMath](https://github.com/PaulRBerg/prb-math)'s fixed-point `ln`/`exp`-based `pow` instead. Vectors assert agreement within a small relative tolerance, not equality — see the comment atop `LawMath.sol`.

`lib/forge-std` and `lib/prb-math` are vendored (committed, not gitignored) rather than tracked as git submodules — this project has no submodule relationship to the parent repo, and vendoring keeps a fresh clone reproducible with a plain `forge test`, no separate install step.

## Usage

```shell
forge test
forge fmt --check
```
