// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SentinelLedgerStorage.sol";

/**
 * @title SentinelLedgerVerifier
 * @notice Cryptographic chain and block integrity verifier for SentinelLedger.
 */
abstract contract SentinelLedgerVerifier is SentinelLedgerStorage {
    /**
     * @notice Performs on-chain EVM cryptographic chain verification from Genesis to current height.
     *         Checks parent hash linkage and cryptographic integrity of each block header.
     */
    function _verifyChainIntegrity() internal view returns (
        bool isValid,
        uint256 blocksScanned,
        bytes32 tipHash
    ) {
        bytes32 prev = bytes32(0);
        for (uint256 i = 0; i <= blockHeight; i++) {
            BlockData storage b = _blocks[i];
            if (i > 0 && b.prevHash != prev) {
                return (false, i, latestBlockHash);
            }
            bytes32 computed = keccak256(
                abi.encodePacked(
                    b.blockIndex,
                    b.timestamp,
                    b.merkleRoot,
                    b.ipfsCid,
                    b.prevHash
                )
            );
            if (computed != b.blockHash) {
                return (false, i, latestBlockHash);
            }
            prev = b.blockHash;
        }
        return (true, totalBlocks, latestBlockHash);
    }
}
