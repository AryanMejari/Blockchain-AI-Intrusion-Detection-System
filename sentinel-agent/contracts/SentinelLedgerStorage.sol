// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ISentinelLedger.sol";

/**
 * @title SentinelLedgerStorage
 * @notice State variable layout and access control for SentinelLedger.
 */
abstract contract SentinelLedgerStorage is ISentinelLedger {
    address public owner;
    uint256 public blockHeight;
    uint256 public totalBlocks;
    uint256 public totalAnchoredEvents;

    bytes32 public latestBlockHash;
    bytes32 public latestMerkleRoot;
    string public latestIpfsCid;

    mapping(uint256 => BlockData) internal _blocks;
    mapping(string => uint256) public eventToBlockIndex;

    modifier onlyOwner() {
        require(msg.sender == owner, "SentinelLedger: caller is not the owner");
        _;
    }
}
