// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HexStrings
 * @notice Utility library for converting cryptographic bytes32 hashes to lowercase hex strings.
 */
library HexStrings {
    bytes16 private constant _HEX_DIGITS = "0123456789abcdef";

    /**
     * @notice Converts bytes32 to 0x-prefixed 66-character lowercase hex string.
     */
    function toHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = _HEX_DIGITS[uint8(data[i] >> 4)];
            str[3 + i * 2] = _HEX_DIGITS[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
