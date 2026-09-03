// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UD60x18, ud, convert} from "prb-math/UD60x18.sol";

/// @notice Pure Solidity twins of the placeholder-free math in
/// packages/engine — see docs/ARCHITECTURE.md §4 and docs/LAW.md.
///
/// This is an audit-narrative reference, not a deployed contract: it exists
/// so an auditor can check the TS engine's formulas against a second,
/// independent implementation. All amounts are WAD (1e18) fixed-point,
/// matching the engine's bigint/1e18 convention exactly, so values pass
/// between the two without rescaling.
///
/// The TS engine computes the Dutch decay with IEEE-754 doubles (via
/// `Math.pow`); Solidity has no floating point, so `dutchPrice` here uses
/// PRBMath's UD60x18.pow (ln/exp under the hood) instead. The two are not
/// bit-exact — the shared test vectors in test/LawMath.t.sol assert
/// agreement within a small relative tolerance, not equality. Fidelity of
/// policy accounting matters more than bit-parity of a power function.
library LawMath {
    uint256 internal constant DAY_SECONDS = 86_400;
    uint256 internal constant BPS_DENOM = 10_000;

    /// @notice P(t) = P_start * (P_floor / P_start) ^ (t / 86400), t clamped
    /// to [0, 86400]. Mirrors packages/engine/src/auctions.ts `dutchPrice`.
    /// @param pStart Auction opening price (WAD).
    /// @param pFloor Auction floor price (WAD).
    /// @param elapsedSec Seconds since the auction opened.
    function dutchPrice(uint256 pStart, uint256 pFloor, uint256 elapsedSec) internal pure returns (uint256) {
        if (pStart == 0) return pFloor;

        uint256 t = elapsedSec > DAY_SECONDS ? DAY_SECONDS : elapsedSec;
        if (t == 0) return pStart;
        if (t == DAY_SECONDS) return pFloor;

        UD60x18 ratio = ud(pFloor).div(ud(pStart));
        // The engine floors the ratio at 1e-12 rather than letting it
        // collapse to exactly 0 (whether pFloor is literally 0, or pStart
        // is so much larger that pFloor/pStart underflows UD60x18's 1e-18
        // precision) -- pow(0, y) returns a hard 0, which would make the
        // price cliff to zero mid-auction instead of decaying to it.
        if (UD60x18.unwrap(ratio) == 0) {
            ratio = ud(1e6); // 1e-12 in UD60x18 (1e18 * 1e-12 = 1e6)
        }
        UD60x18 exponent = convert(t).div(convert(DAY_SECONDS));
        UD60x18 price = ud(pStart).mul(ratio.pow(exponent));
        uint256 result = UD60x18.unwrap(price);

        // dutchPrice must always lie in [pFloor, pStart] by construction
        // (it decays monotonically from one to the other) -- but pow()'s
        // ln/exp implementation loses relative precision when the ratio is
        // extreme (pStart many orders of magnitude above pFloor) and t is
        // very close to DAY_SECONDS, and can undershoot below pFloor.
        // Clamp rather than chase perfect precision at the tail: this is
        // an audit-narrative reference, and the invariant is exact math,
        // not a numerical-precision compromise.
        if (result < pFloor) return pFloor;
        if (result > pStart) return pStart;
        return result;
    }

    /// @notice feeRate = feeFloor + (feeCeil - feeFloor) * P^2, clamped to
    /// [feeFloor, feeCeil]. Mirrors packages/engine/src/exits.ts
    /// `computeFeeRate`. feeFloor/feeCeil/p are WAD fractions (1e18 = 1.0).
    function resolutionFeeRate(uint256 feeFloorWad, uint256 feeCeilWad, uint256 pWad) internal pure returns (uint256) {
        uint256 p = pWad > 1e18 ? 1e18 : pWad;
        uint256 pSquared = (p * p) / 1e18;
        uint256 rate = feeFloorWad + ((feeCeilWad - feeFloorWad) * pSquared) / 1e18;
        if (rate < feeFloorWad) return feeFloorWad;
        if (rate > feeCeilWad) return feeCeilWad;
        return rate;
    }

    /// @notice spend = min(10% of vaultEth, 0.2% of poolEthReserve).
    /// Mirrors packages/engine/src/epoch.ts `contractionBuybackOnce`.
    function contractionSpend(uint256 vaultEth, uint256 poolEthReserve) internal pure returns (uint256) {
        uint256 tenPctVault = vaultEth / 10;
        uint256 twentyBpsPool = (poolEthReserve * 20) / BPS_DENOM;
        return tenPctVault < twentyBpsPool ? tenPctVault : twentyBpsPool;
    }
}
