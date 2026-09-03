// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {LawMath} from "../src/LawMath.sol";

contract LawMathTest is Test {
    using stdJson for string;

    uint256 internal constant DAY_SECONDS = 86_400;

    // Relative-tolerance budgets, expressed as a WAD fraction (1e18 = 100%).
    // dutchPrice compares an IEEE-754-double power function (the TS engine)
    // against PRBMath's fixed-point ln/exp-based pow — not bit-exact by
    // construction, see the comment atop LawMath.sol.
    uint256 internal constant DUTCH_PRICE_TOL = 1e12; // 1e-6 relative
    uint256 internal constant FEE_RATE_TOL = 1e9; // 1e-9 relative
    // contractionSpend is pure integer arithmetic in both languages at the
    // same WAD scale, so it must match exactly.

    // ---------------------------------------------------------------
    // Shared vectors, generated from the live TS engine by
    // packages/engine/scripts/generate-law-vectors.ts. Regenerate with
    // `pnpm --filter @standard-law/engine run gen:law-vectors`.
    // ---------------------------------------------------------------

    function test_vectors_dutchPrice() public view {
        string memory json = vm.readFile("test/vectors/dutch-price.json");
        uint256[] memory pStart = json.readUintArray(".pStart");
        uint256[] memory pFloor = json.readUintArray(".pFloor");
        uint256[] memory elapsedSec = json.readUintArray(".elapsedSec");
        uint256[] memory expected = json.readUintArray(".expected");

        for (uint256 i = 0; i < pStart.length; i++) {
            uint256 actual = LawMath.dutchPrice(pStart[i], pFloor[i], elapsedSec[i]);
            assertApproxRel(actual, expected[i], DUTCH_PRICE_TOL, "dutchPrice vector mismatch");
        }
    }

    function test_vectors_resolutionFeeRate() public view {
        string memory json = vm.readFile("test/vectors/resolution-fee.json");
        uint256[] memory feeFloorWad = json.readUintArray(".feeFloorWad");
        uint256[] memory feeCeilWad = json.readUintArray(".feeCeilWad");
        uint256[] memory pWad = json.readUintArray(".pWad");
        uint256[] memory expected = json.readUintArray(".expected");

        for (uint256 i = 0; i < feeFloorWad.length; i++) {
            uint256 actual = LawMath.resolutionFeeRate(feeFloorWad[i], feeCeilWad[i], pWad[i]);
            assertApproxRel(actual, expected[i], FEE_RATE_TOL, "resolutionFeeRate vector mismatch");
        }
    }

    function test_vectors_contractionSpend() public view {
        string memory json = vm.readFile("test/vectors/contraction-spend.json");
        uint256[] memory vaultEth = json.readUintArray(".vaultEth");
        uint256[] memory poolEthReserve = json.readUintArray(".poolEthReserve");
        uint256[] memory expected = json.readUintArray(".expected");

        for (uint256 i = 0; i < vaultEth.length; i++) {
            uint256 actual = LawMath.contractionSpend(vaultEth[i], poolEthReserve[i]);
            assertEq(actual, expected[i], "contractionSpend vector mismatch: exact integer arithmetic in both langs");
        }
    }

    // ---------------------------------------------------------------
    // Property tests (fuzzed), independent of the TS vectors.
    // ---------------------------------------------------------------

    function testFuzz_dutchPrice_boundsAtOpenAndFloor(uint256 pStart, uint256 pFloor) public pure {
        pStart = bound(pStart, 1, 1e30);
        pFloor = bound(pFloor, 0, pStart);

        assertEq(LawMath.dutchPrice(pStart, pFloor, 0), pStart, "t=0 must equal pStart");
        assertEq(LawMath.dutchPrice(pStart, pFloor, DAY_SECONDS), pFloor, "t=DAY must equal pFloor");
    }

    function testFuzz_dutchPrice_monotonicDecay(uint256 pStart, uint256 pFloor, uint256 t1, uint256 t2) public pure {
        pStart = bound(pStart, 1e6, 1e30);
        pFloor = bound(pFloor, 0, pStart);
        t1 = bound(t1, 0, DAY_SECONDS);
        t2 = bound(t2, 0, DAY_SECONDS);
        vm.assume(t1 <= t2);

        uint256 priceAtT1 = LawMath.dutchPrice(pStart, pFloor, t1);
        uint256 priceAtT2 = LawMath.dutchPrice(pStart, pFloor, t2);
        assertGe(priceAtT1, priceAtT2, "price must not increase as the auction decays");
    }

    function testFuzz_dutchPrice_clampsElapsedPastDay(uint256 pStart, uint256 pFloor, uint256 extra) public pure {
        pStart = bound(pStart, 1, 1e30);
        pFloor = bound(pFloor, 0, pStart);
        extra = bound(extra, 0, 365 days);

        assertEq(
            LawMath.dutchPrice(pStart, pFloor, DAY_SECONDS + extra),
            LawMath.dutchPrice(pStart, pFloor, DAY_SECONDS),
            "elapsed beyond a day must clamp to the same result as exactly one day"
        );
    }

    function testFuzz_resolutionFeeRate_boundedAndMonotonic(
        uint256 feeFloorWad,
        uint256 feeCeilWad,
        uint256 p1,
        uint256 p2
    ) public pure {
        feeFloorWad = bound(feeFloorWad, 0, 1e18);
        feeCeilWad = bound(feeCeilWad, feeFloorWad, 1e18);
        p1 = bound(p1, 0, 1e18);
        p2 = bound(p2, 0, 1e18);
        vm.assume(p1 <= p2);

        uint256 rate1 = LawMath.resolutionFeeRate(feeFloorWad, feeCeilWad, p1);
        uint256 rate2 = LawMath.resolutionFeeRate(feeFloorWad, feeCeilWad, p2);

        assertGe(rate1, feeFloorWad, "rate must be >= feeFloor");
        assertLe(rate1, feeCeilWad, "rate must be <= feeCeil");
        assertLe(rate1, rate2, "rate must be non-decreasing in P");
    }

    function testFuzz_contractionSpend_boundedByBothCaps(uint256 vaultEth, uint256 poolEthReserve) public pure {
        vaultEth = bound(vaultEth, 0, 1e30);
        poolEthReserve = bound(poolEthReserve, 0, 1e30);

        uint256 spend = LawMath.contractionSpend(vaultEth, poolEthReserve);
        assertLe(spend, vaultEth / 10, "spend must never exceed 10% of the vault");
        assertLe(spend, (poolEthReserve * 20) / 10_000, "spend must never exceed 0.2% of pool reserves");
    }

    // ---------------------------------------------------------------

    function assertApproxRel(uint256 a, uint256 b, uint256 maxRelWad, string memory label) internal pure {
        if (a == 0 && b == 0) return;
        uint256 diff = a > b ? a - b : b - a;
        uint256 base = a > b ? a : b;
        uint256 relWad = (diff * 1e18) / base;
        assertLe(relWad, maxRelWad, label);
    }
}
