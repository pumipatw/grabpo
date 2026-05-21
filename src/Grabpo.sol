// SPDX-License-Identifier: AGPLv3.0
pragma solidity 0.8.35;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {StdTokens} from "tempo-std/StdTokens.sol";
import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract Grabpo {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    struct Order {
        uint128 distanceD6;
        uint128 tipD6;
        address customer;
    }

    struct Escrow {
        address owner;
        address worker;
        uint256 amount;
    }

    address public judge;
    mapping(uint256 index => mapping(bytes32 id => Order)) public orderbook;
    mapping(bytes32 => Escrow) public escrow;

    EnumerableSet.UintSet private _activeIndices;
    mapping(uint256 => EnumerableSet.Bytes32Set) private _orderIds;
    EnumerableSet.Bytes32Set private _escrowIds;

    event BidAdded(
        uint256 indexed index,
        bytes32 indexed id,
        address indexed customer,
        uint128 distanceD6,
        uint128 tipD6
    );
    event BidCancelled(
        uint256 indexed index,
        bytes32 indexed id,
        address indexed customer
    );
    event BidAccepted(
        uint256 indexed index,
        bytes32 indexed id,
        address customer,
        address indexed worker,
        uint256 amount
    );
    event EscrowReleased(
        bytes32 indexed id,
        address owner,
        address indexed worker,
        uint256 amount
    );
    event EscrowResolved(
        bytes32 indexed id,
        bool refund,
        address owner,
        address indexed worker,
        uint256 amount
    );

    address internal constant PATH_USD_ADDRESS =
        0x20C0000000000000000000000000000000000000;
    ITIP20 internal constant PATH_USD = ITIP20(PATH_USD_ADDRESS);

    error Unauthorized();
    error ZeroAddress();

    constructor(address _judge) {
        judge = _judge;
    }

    function addBid(
        uint256 _index,
        uint128 _distanceD6,
        uint128 _tipD6
    ) external {
        uint256 totalDebit = ((_index * 0.01e6) * _distanceD6) / 1e6 + _tipD6;
        bytes32 newId = keccak256(
            abi.encode(msg.sender, block.number, _index, _distanceD6, _tipD6)
        );
        orderbook[_index][newId] = Order({
            distanceD6: _distanceD6,
            tipD6: _tipD6,
            customer: msg.sender
        });
        _orderIds[_index].add(newId);
        _activeIndices.add(_index);
        emit BidAdded(_index, newId, msg.sender, _distanceD6, _tipD6);
        require(
            PATH_USD.transferFromWithMemo(
                msg.sender,
                address(this),
                totalDebit,
                newId
            )
        );
    }

    function cancelBid(uint256 _index, bytes32 _id) external {
        Order memory order = orderbook[_index][_id];
        if (order.customer == address(0)) {
            revert ZeroAddress();
        }
        if (order.customer != msg.sender) {
            revert Unauthorized();
        }
        uint256 totalCredit = ((_index * 0.01e6) * order.distanceD6) /
            1e6 +
            order.tipD6;
        delete orderbook[_index][_id];
        _orderIds[_index].remove(_id);
        if (_orderIds[_index].length() == 0) {
            _activeIndices.remove(_index);
        }
        emit BidCancelled(_index, _id, order.customer);
        require(PATH_USD.transfer(msg.sender, totalCredit));
    }

    function acceptBid(uint256 _index, bytes32 _id) external {
        Order memory order = orderbook[_index][_id];
        if (order.customer == address(0)) {
            revert ZeroAddress();
        }
        uint256 totalCredit = ((_index * 0.01e6) * order.distanceD6) /
            1e6 +
            order.tipD6;
        delete orderbook[_index][_id];
        _orderIds[_index].remove(_id);
        if (_orderIds[_index].length() == 0) {
            _activeIndices.remove(_index);
        }
        emit BidAccepted(_index, _id, order.customer, msg.sender, totalCredit);
        escrow[_id] = Escrow({
            owner: order.customer,
            worker: msg.sender,
            amount: totalCredit
        });
        _escrowIds.add(_id);
    }

    function release(bytes32 _id) external {
        Escrow memory e = escrow[_id];
        if (e.owner == address(0)) {
            revert ZeroAddress();
        }
        if (e.owner != msg.sender) {
            revert Unauthorized();
        }
        delete escrow[_id];
        _escrowIds.remove(_id);
        emit EscrowReleased(_id, e.owner, e.worker, e.amount);
        PATH_USD.transferWithMemo(e.worker, e.amount, _id);
    }

    function resolve(bytes32 _id, bool _refund) external {
        if (msg.sender != judge) {
            revert Unauthorized();
        }
        Escrow memory e = escrow[_id];
        if (e.owner == address(0)) {
            revert ZeroAddress();
        }
        delete escrow[_id];
        _escrowIds.remove(_id);
        emit EscrowResolved(_id, _refund, e.owner, e.worker, e.amount);
        if (_refund) {
            require(PATH_USD.transfer(e.owner, e.amount));
        } else {
            PATH_USD.transferWithMemo(e.worker, e.amount, _id);
        }
    }

    function getActiveIndicesCount() external view returns (uint256) {
        return _activeIndices.length();
    }

    function getActiveIndexAt(uint256 _pos) external view returns (uint256) {
        return _activeIndices.at(_pos);
    }

    function getOrderCount(uint256 _index) external view returns (uint256) {
        return _orderIds[_index].length();
    }

    function getOrderAt(
        uint256 _index,
        uint256 _pos
    ) external view returns (bytes32) {
        return _orderIds[_index].at(_pos);
    }

    function getEscrowCount() external view returns (uint256) {
        return _escrowIds.length();
    }

    function getEscrowAt(uint256 _pos) external view returns (bytes32) {
        return _escrowIds.at(_pos);
    }
}
