// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ISentinelLedger.sol";
import "./libraries/HexStrings.sol";
import "./SentinelLedgerStorage.sol";
import "./SentinelLedgerVerifier.sol";

/**
 * @title SentinelLedger
 * @notice Decentralized, non-repudiation cryptographic audit ledger for Sentinel AI SOC operations.
 *         Anchors security telemetry event hashes, Merkle root trees, and content-addressed IPFS CIDs
 *         directly onto Ethereum EVM blockchain (Ganache).
 */
contract SentinelLedger is SentinelLedgerVerifier {
    using HexStrings for bytes32;

    constructor(string memory genesisIpfsCid, bytes32 genesisMerkleRoot) {
        owner = msg.sender;
        _initGenesis(genesisIpfsCid, genesisMerkleRoot);
    }

    function _initGenesis(string memory genesisIpfsCid, bytes32 genesisMerkleRoot) internal {
        bytes32 prevHash = bytes32(0);
        uint256 genesisTime = block.timestamp;
        bytes32 blockHash = keccak256(
            abi.encodePacked(
                uint256(0),
                genesisTime,
                genesisMerkleRoot,
                genesisIpfsCid,
                prevHash
            )
        );

        string[] memory emptyIds = new string[](0);
        _blocks[0] = BlockData({
            blockIndex: 0,
            timestamp: genesisTime,
            merkleRoot: genesisMerkleRoot,
            ipfsCid: genesisIpfsCid,
            prevHash: prevHash,
            blockHash: blockHash,
            eventsCount: 0,
            eventIds: emptyIds,
            miner: msg.sender
        });

        blockHeight = 0;
        totalBlocks = 1;
        totalAnchoredEvents = 0;
        latestBlockHash = blockHash;
        latestMerkleRoot = genesisMerkleRoot;
        latestIpfsCid = genesisIpfsCid;

        emit BlockAnchored(
            0,
            blockHash,
            genesisMerkleRoot,
            genesisIpfsCid,
            0,
            msg.sender,
            genesisTime
        );
    }

    /**
     * @notice Mines and anchors a new cryptographic block of security events into Ganache blockchain.
     * @param merkleRoot The pairwise SHA-256 / Keccak-256 Merkle root of the telemetry batch.
     * @param ipfsCid Content Identifier of the complete forensic snapshot pinned on IPFS Desktop.
     * @param eventsCount Count of events included.
     * @param eventIds List of event identifier strings sealed in this block.
     */
    function anchorBlock(
        bytes32 merkleRoot,
        string calldata ipfsCid,
        uint256 eventsCount,
        string[] calldata eventIds
    ) external override returns (uint256) {
        require(eventsCount > 0, "SentinelLedger: events count must be greater than zero");
        require(bytes(ipfsCid).length > 0, "SentinelLedger: ipfsCid required");

        uint256 newIndex = blockHeight + 1;
        bytes32 prevHash = latestBlockHash;
        uint256 nowTs = block.timestamp;

        bytes32 blockHash = keccak256(
            abi.encodePacked(
                newIndex,
                nowTs,
                merkleRoot,
                ipfsCid,
                prevHash
            )
        );

        _blocks[newIndex] = BlockData({
            blockIndex: newIndex,
            timestamp: nowTs,
            merkleRoot: merkleRoot,
            ipfsCid: ipfsCid,
            prevHash: prevHash,
            blockHash: blockHash,
            eventsCount: eventsCount,
            eventIds: eventIds,
            miner: msg.sender
        });

        for (uint256 i = 0; i < eventIds.length; i++) {
            eventToBlockIndex[eventIds[i]] = newIndex;
        }

        blockHeight = newIndex;
        totalBlocks = newIndex + 1;
        totalAnchoredEvents += eventsCount;
        latestBlockHash = blockHash;
        latestMerkleRoot = merkleRoot;
        latestIpfsCid = ipfsCid;

        emit BlockAnchored(
            newIndex,
            blockHash,
            merkleRoot,
            ipfsCid,
            eventsCount,
            msg.sender,
            nowTs
        );

        return newIndex;
    }

    /**
     * @notice Retrieves a specific block by index formatted for client APIs.
     */
    function getBlock(uint256 index) external view override returns (BlockView memory) {
        require(index <= blockHeight, "SentinelLedger: block index out of bounds");
        BlockData storage b = _blocks[index];
        return BlockView({
            blockIndex: b.blockIndex,
            timestamp: b.timestamp,
            merkleRoot: b.merkleRoot.toHexString(),
            ipfsCid: b.ipfsCid,
            prevHash: b.prevHash.toHexString(),
            blockHash: b.blockHash.toHexString(),
            eventsCount: b.eventsCount,
            eventIds: b.eventIds,
            miner: b.miner
        });
    }

    /**
     * @notice Returns recent blocks in reverse chronological order (newest first).
     */
    function getRecentBlocks(uint256 limit) external view override returns (BlockView[] memory) {
        uint256 count = limit;
        if (count == 0 || count > totalBlocks) {
            count = totalBlocks;
        }

        BlockView[] memory list = new BlockView[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 idx = blockHeight - i;
            BlockData storage b = _blocks[idx];
            list[i] = BlockView({
                blockIndex: b.blockIndex,
                timestamp: b.timestamp,
                merkleRoot: b.merkleRoot.toHexString(),
                ipfsCid: b.ipfsCid,
                prevHash: b.prevHash.toHexString(),
                blockHash: b.blockHash.toHexString(),
                eventsCount: b.eventsCount,
                eventIds: b.eventIds,
                miner: b.miner
            });
        }
        return list;
    }

    /**
     * @notice Returns comprehensive status of the Solidity smart contract ledger.
     */
    function getStatus() external view override returns (LedgerStatus memory) {
        return LedgerStatus({
            chainValid: true,
            blockHeight: blockHeight,
            totalBlocks: totalBlocks,
            totalAnchoredEvents: totalAnchoredEvents,
            latestBlockHash: latestBlockHash.toHexString(),
            latestMerkleRoot: latestMerkleRoot.toHexString(),
            latestIpfsCid: latestIpfsCid,
            contractAddress: address(this)
        });
    }

    /**
     * @notice On-chain EVM cryptographic chain verification from Genesis to tip.
     */
    function verifyChainIntegrity() external view override returns (
        bool isValid,
        uint256 blocksScanned,
        bytes32 tipHash
    ) {
        return _verifyChainIntegrity();
    }

    /**
     * @notice Resets ledger state back to Genesis Block #0 for automated lab / test resets.
     */
    function resetLedger(string calldata genesisIpfsCid, bytes32 genesisMerkleRoot) external override onlyOwner {
        _initGenesis(genesisIpfsCid, genesisMerkleRoot);
        emit LedgerReset(block.timestamp, msg.sender, genesisIpfsCid);
    }
}
