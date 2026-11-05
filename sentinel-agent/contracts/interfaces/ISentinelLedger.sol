// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISentinelLedger
 * @notice Standard interface for Sentinel SOC decentralized audit ledger.
 */
interface ISentinelLedger {
    struct BlockData {
        uint256 blockIndex;
        uint256 timestamp;
        bytes32 merkleRoot;
        string ipfsCid;
        bytes32 prevHash;
        bytes32 blockHash;
        uint256 eventsCount;
        string[] eventIds;
        address miner;
    }

    struct BlockView {
        uint256 blockIndex;
        uint256 timestamp;
        string merkleRoot;
        string ipfsCid;
        string prevHash;
        string blockHash;
        uint256 eventsCount;
        string[] eventIds;
        address miner;
    }

    struct LedgerStatus {
        bool chainValid;
        uint256 blockHeight;
        uint256 totalBlocks;
        uint256 totalAnchoredEvents;
        string latestBlockHash;
        string latestMerkleRoot;
        string latestIpfsCid;
        address contractAddress;
    }

    event BlockAnchored(
        uint256 indexed blockIndex,
        bytes32 indexed blockHash,
        bytes32 merkleRoot,
        string ipfsCid,
        uint256 eventsCount,
        address indexed miner,
        uint256 timestamp
    );

    event LedgerReset(
        uint256 indexed resetTimestamp,
        address indexed operator,
        string genesisIpfsCid
    );

    function anchorBlock(
        bytes32 merkleRoot,
        string calldata ipfsCid,
        uint256 eventsCount,
        string[] calldata eventIds
    ) external returns (uint256);

    function getBlock(uint256 index) external view returns (BlockView memory);

    function getRecentBlocks(uint256 limit) external view returns (BlockView[] memory);

    function getStatus() external view returns (LedgerStatus memory);

    function verifyChainIntegrity() external view returns (
        bool isValid,
        uint256 blocksScanned,
        bytes32 tipHash
    );

    function resetLedger(string calldata genesisIpfsCid, bytes32 genesisMerkleRoot) external;
}
