// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.35;

import {Test} from "forge-std/Test.sol";
import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";
import {ITIP20RolesAuth} from "tempo-std/interfaces/ITIP20RolesAuth.sol";
import {StdTokens} from "tempo-std/StdTokens.sol";
import {Grabpo} from "../src/Grabpo.sol";

contract GrabpoTest is Test {
    Grabpo public grabpo;

    address public constant CUSTOMER = address(0x100);
    address public constant WORKER = address(0x200);
    address public constant JUDGE = address(0x300);
    address public constant RANDOM = address(0x400);

    uint128 public constant ONE_D6 = 1_000_000;
    uint128 public constant HALF_D6 = 500_000;
    uint128 public constant TEN_D6 = 10_000_000;

    error Unauthorized();
    error ZeroAddress();

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

    function setUp() public {
        StdPrecompiles.TIP_FEE_MANAGER.setUserToken(StdTokens.PATH_USD_ADDRESS);

        grabpo = new Grabpo(JUDGE);

        ITIP20RolesAuth(StdTokens.PATH_USD_ADDRESS).grantRole(
            ITIP20(StdTokens.PATH_USD_ADDRESS).ISSUER_ROLE(),
            address(this)
        );
        ITIP20(StdTokens.PATH_USD_ADDRESS).mint(CUSTOMER, 1_000_000 * 1e6);

        vm.prank(CUSTOMER);
        ITIP20(StdTokens.PATH_USD_ADDRESS).approve(address(grabpo), type(uint256).max);
    }

    function _computeBidId(
        address _customer,
        uint256 _blockNum,
        uint256 _index,
        uint128 _distanceD6,
        uint128 _tipD6
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(_customer, _blockNum, _index, _distanceD6, _tipD6));
    }

    function _totalDebit(
        uint256 _index,
        uint128 _distanceD6,
        uint128 _tipD6
    ) internal pure returns (uint256) {
        return ((_index * 0.01e6) * _distanceD6) / 1e6 + _tipD6;
    }

    function _bal(address _addr) internal view returns (uint256) {
        return ITIP20(StdTokens.PATH_USD_ADDRESS).balanceOf(_addr);
    }

    function testAddBid() public {
        uint256 index = 1;
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;
        uint256 totalDebit = _totalDebit(index, distance, tip);

        uint256 bn = block.number;
        bytes32 expectedId = _computeBidId(CUSTOMER, bn, index, distance, tip);

        uint256 customerBalBefore = _bal(CUSTOMER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.expectEmit(address(grabpo));
        emit BidAdded(index, expectedId, CUSTOMER, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(index, distance, tip);

        (uint128 orderDistance, uint128 orderTip, address orderCustomer) = grabpo.orderbook(index, expectedId);
        assertEq(orderDistance, distance);
        assertEq(orderTip, tip);
        assertEq(orderCustomer, CUSTOMER);

        assertEq(_bal(CUSTOMER), customerBalBefore - totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore + totalDebit);

        assertEq(grabpo.getActiveIndicesCount(), 1);
        assertEq(grabpo.getActiveIndexAt(0), index);
        assertEq(grabpo.getOrderCount(index), 1);
        assertEq(grabpo.getOrderAt(index, 0), expectedId);
    }

    function testCancelBid() public {
        uint256 index = 1;
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;
        uint256 totalDebit = _totalDebit(index, distance, tip);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, index, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(index, distance, tip);

        uint256 customerBalBefore = _bal(CUSTOMER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.expectEmit(address(grabpo));
        emit BidCancelled(index, bidId, CUSTOMER);

        vm.prank(CUSTOMER);
        grabpo.cancelBid(index, bidId);

        (uint128 orderDistance, uint128 orderTip, address orderCustomer) = grabpo.orderbook(index, bidId);
        assertEq(orderDistance, 0);
        assertEq(orderTip, 0);
        assertEq(orderCustomer, address(0));

        assertEq(_bal(CUSTOMER), customerBalBefore + totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore - totalDebit);

        assertEq(grabpo.getActiveIndicesCount(), 0);
        assertEq(grabpo.getOrderCount(index), 0);
    }

    function testCancelBidUnauthorized() public {
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, 1, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(1, distance, tip);

        vm.expectRevert(Unauthorized.selector);
        vm.prank(RANDOM);
        grabpo.cancelBid(1, bidId);
    }

    function testCancelNonExistentBid() public {
        vm.expectRevert(ZeroAddress.selector);
        grabpo.cancelBid(1, bytes32(uint256(0xdead)));
    }

    function testAcceptBid() public {
        uint256 index = 1;
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;
        uint256 totalDebit = _totalDebit(index, distance, tip);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, index, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(index, distance, tip);

        vm.expectEmit(address(grabpo));
        emit BidAccepted(index, bidId, CUSTOMER, WORKER, totalDebit);

        vm.prank(WORKER);
        grabpo.acceptBid(index, bidId);

        (uint128 orderDistance, uint128 orderTip, address orderCustomer) = grabpo.orderbook(index, bidId);
        assertEq(orderDistance, 0);
        assertEq(orderTip, 0);
        assertEq(orderCustomer, address(0));

        (address escrowOwner, address escrowWorker, uint256 escrowAmount) = grabpo.escrow(bidId);
        assertEq(escrowOwner, CUSTOMER);
        assertEq(escrowWorker, WORKER);
        assertEq(escrowAmount, totalDebit);

        assertEq(grabpo.getActiveIndicesCount(), 0);
        assertEq(grabpo.getOrderCount(index), 0);
        assertEq(grabpo.getEscrowCount(), 1);
        assertEq(grabpo.getEscrowAt(0), bidId);
    }

    function testAcceptNonExistentBid() public {
        vm.expectRevert(ZeroAddress.selector);
        grabpo.acceptBid(1, bytes32(uint256(0xdead)));
    }

    function testReleaseEscrow() public {
        uint256 index = 1;
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;
        uint256 totalDebit = _totalDebit(index, distance, tip);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, index, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(index, distance, tip);
        vm.prank(WORKER);
        grabpo.acceptBid(index, bidId);

        uint256 workerBalBefore = _bal(WORKER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.expectEmit(address(grabpo));
        emit EscrowReleased(bidId, CUSTOMER, WORKER, totalDebit);

        vm.prank(CUSTOMER);
        grabpo.release(bidId);

        (address escrowOwner, address escrowWorker, uint256 escrowAmount) = grabpo.escrow(bidId);
        assertEq(escrowOwner, address(0));
        assertEq(escrowWorker, address(0));
        assertEq(escrowAmount, 0);

        assertEq(_bal(WORKER), workerBalBefore + totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore - totalDebit);
        assertEq(grabpo.getEscrowCount(), 0);
    }

    function testReleaseUnauthorized() public {
        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, 1, ONE_D6, HALF_D6);

        vm.prank(CUSTOMER);
        grabpo.addBid(1, ONE_D6, HALF_D6);
        vm.prank(WORKER);
        grabpo.acceptBid(1, bidId);

        vm.expectRevert(Unauthorized.selector);
        vm.prank(RANDOM);
        grabpo.release(bidId);
    }

    function testReleaseNonExistent() public {
        vm.expectRevert(ZeroAddress.selector);
        grabpo.release(bytes32(uint256(0xdead)));
    }

    function testResolveRefund() public {
        uint256 index = 1;
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;
        uint256 totalDebit = _totalDebit(index, distance, tip);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, index, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(index, distance, tip);
        vm.prank(WORKER);
        grabpo.acceptBid(index, bidId);

        uint256 customerBalBefore = _bal(CUSTOMER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.expectEmit(address(grabpo));
        emit EscrowResolved(bidId, true, CUSTOMER, WORKER, totalDebit);

        vm.prank(JUDGE);
        grabpo.resolve(bidId, true);

        (address escrowOwner, address escrowWorker, uint256 escrowAmount) = grabpo.escrow(bidId);
        assertEq(escrowOwner, address(0));
        assertEq(escrowWorker, address(0));
        assertEq(escrowAmount, 0);

        assertEq(_bal(CUSTOMER), customerBalBefore + totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore - totalDebit);
        assertEq(grabpo.getEscrowCount(), 0);
    }

    function testResolvePayWorker() public {
        uint256 index = 1;
        uint128 distance = ONE_D6;
        uint128 tip = HALF_D6;
        uint256 totalDebit = _totalDebit(index, distance, tip);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, index, distance, tip);

        vm.prank(CUSTOMER);
        grabpo.addBid(index, distance, tip);
        vm.prank(WORKER);
        grabpo.acceptBid(index, bidId);

        uint256 workerBalBefore = _bal(WORKER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.expectEmit(address(grabpo));
        emit EscrowResolved(bidId, false, CUSTOMER, WORKER, totalDebit);

        vm.prank(JUDGE);
        grabpo.resolve(bidId, false);

        (address escrowOwner, address escrowWorker, uint256 escrowAmount) = grabpo.escrow(bidId);
        assertEq(escrowOwner, address(0));
        assertEq(escrowWorker, address(0));
        assertEq(escrowAmount, 0);

        assertEq(_bal(WORKER), workerBalBefore + totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore - totalDebit);
        assertEq(grabpo.getEscrowCount(), 0);
    }

    function testResolveUnauthorized() public {
        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, 1, ONE_D6, HALF_D6);

        vm.prank(CUSTOMER);
        grabpo.addBid(1, ONE_D6, HALF_D6);
        vm.prank(WORKER);
        grabpo.acceptBid(1, bidId);

        vm.expectRevert(Unauthorized.selector);
        vm.prank(RANDOM);
        grabpo.resolve(bidId, true);
    }

    function testMultipleBidsSameIndex() public {
        uint256 index = 1;

        uint256 bn1 = block.number;
        bytes32 id1 = _computeBidId(CUSTOMER, bn1, index, ONE_D6, HALF_D6);
        vm.prank(CUSTOMER);
        grabpo.addBid(index, ONE_D6, HALF_D6);

        uint256 bn2 = block.number;
        bytes32 id2 = _computeBidId(CUSTOMER, bn2, index, TEN_D6, HALF_D6);
        vm.prank(CUSTOMER);
        grabpo.addBid(index, TEN_D6, HALF_D6);

        assertEq(grabpo.getOrderCount(index), 2);
        assertEq(grabpo.getActiveIndicesCount(), 1);
        assertEq(grabpo.getActiveIndexAt(0), index);

        bytes32 at0 = grabpo.getOrderAt(index, 0);
        bytes32 at1 = grabpo.getOrderAt(index, 1);
        assertTrue((at0 == id1 && at1 == id2) || (at0 == id2 && at1 == id1));
    }

    function testCancelLastBidRemovesIndex() public {
        uint256 index = 1;

        uint256 bn1 = block.number;
        bytes32 id1 = _computeBidId(CUSTOMER, bn1, index, ONE_D6, HALF_D6);
        vm.prank(CUSTOMER);
        grabpo.addBid(index, ONE_D6, HALF_D6);

        uint256 bn2 = block.number;
        bytes32 id2 = _computeBidId(CUSTOMER, bn2, index, TEN_D6, HALF_D6);
        vm.prank(CUSTOMER);
        grabpo.addBid(index, TEN_D6, HALF_D6);

        assertEq(grabpo.getActiveIndicesCount(), 1);

        vm.prank(CUSTOMER);
        grabpo.cancelBid(index, id1);
        assertEq(grabpo.getOrderCount(index), 1);
        assertEq(grabpo.getActiveIndicesCount(), 1);

        vm.prank(CUSTOMER);
        grabpo.cancelBid(index, id2);
        assertEq(grabpo.getOrderCount(index), 0);
        assertEq(grabpo.getActiveIndicesCount(), 0);
    }

    function testFuzzAddCancel(uint256 _index, uint128 _distanceD6, uint128 _tipD6) public {
        _index = bound(_index, 1, 100);
        _distanceD6 = uint128(bound(_distanceD6, 0, 1000 * 1e6));
        _tipD6 = uint128(bound(_tipD6, 0, 1000 * 1e6));
        vm.assume(_totalDebit(_index, _distanceD6, _tipD6) <= type(uint128).max);

        uint256 totalDebit = _totalDebit(_index, _distanceD6, _tipD6);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, _index, _distanceD6, _tipD6);

        uint256 customerBalBefore = _bal(CUSTOMER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.prank(CUSTOMER);
        grabpo.addBid(_index, _distanceD6, _tipD6);

        assertEq(_bal(CUSTOMER), customerBalBefore - totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore + totalDebit);
        assertEq(grabpo.getOrderCount(_index), 1);

        vm.prank(CUSTOMER);
        grabpo.cancelBid(_index, bidId);

        assertEq(_bal(CUSTOMER), customerBalBefore);
        assertEq(_bal(address(grabpo)), grabpoBalBefore);
        assertEq(grabpo.getOrderCount(_index), 0);
        assertEq(grabpo.getActiveIndicesCount(), 0);
    }

    function testFuzzFullLifecycle(
        uint256 _index,
        uint128 _distanceD6,
        uint128 _tipD6
    ) public {
        _index = bound(_index, 1, 100);
        _distanceD6 = uint128(bound(_distanceD6, 1, 1000 * 1e6));
        _tipD6 = uint128(bound(_tipD6, 0, 1000 * 1e6));

        uint256 totalDebit = _totalDebit(_index, _distanceD6, _tipD6);

        uint256 bn = block.number;
        bytes32 bidId = _computeBidId(CUSTOMER, bn, _index, _distanceD6, _tipD6);

        uint256 customerBalBefore = _bal(CUSTOMER);
        uint256 workerBalBefore = _bal(WORKER);
        uint256 grabpoBalBefore = _bal(address(grabpo));

        vm.prank(CUSTOMER);
        grabpo.addBid(_index, _distanceD6, _tipD6);

        vm.prank(WORKER);
        grabpo.acceptBid(_index, bidId);

        assertEq(grabpo.getEscrowCount(), 1);
        assertEq(grabpo.getEscrowAt(0), bidId);

        vm.prank(CUSTOMER);
        grabpo.release(bidId);

        assertEq(_bal(CUSTOMER), customerBalBefore - totalDebit);
        assertEq(_bal(WORKER), workerBalBefore + totalDebit);
        assertEq(_bal(address(grabpo)), grabpoBalBefore);
        assertEq(grabpo.getEscrowCount(), 0);
    }
}
