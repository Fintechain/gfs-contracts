import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { WormholeSettlementReceiver, MockWormholeRelayer, MockSettlementController, MockERC20Token } from "../../../typechain";

describe("WormholeSettlementReceiver", function () {
    let wormholeReceiver: WormholeSettlementReceiver;
    let mockWormholeRelayer: MockWormholeRelayer;
    let mockSettlementController: MockSettlementController;
    let mockToken: MockERC20Token;
    let admin: string;
    let user: string;
    let operator: string;

    // Test constants
    const sourceChain = 2; // e.g., Arbitrum
    const testAmount = ethers.parseEther("100");
    const testMessageId = ethers.id("TEST_MESSAGE");
    const testDeliveryHash = ethers.id("TEST_DELIVERY");

    beforeEach(async function () {
        await deployments.fixture(['mocks', 'WormholeSettlementReceiver']);

        const signers = await ethers.getSigners();
        [admin, operator, user] = await Promise.all([
            getNamedAccounts().then(accounts => accounts.admin),
            signers[1].address,
            signers[2].address
        ]);

        // Deploy mock contracts
        mockWormholeRelayer = await ethers.deployContract("MockWormholeRelayer");
        mockSettlementController = await ethers.deployContract("MockSettlementController");
        mockToken = await ethers.deployContract("MockERC20Token", ["Mock Token", "MTK"]);

        // Deploy WormholeSettlementReceiver
        const WormholeSettlementReceiver = await ethers.getContractFactory("WormholeSettlementReceiver");
        wormholeReceiver = await WormholeSettlementReceiver.deploy(
            await mockWormholeRelayer.getAddress(),
            await mockSettlementController.getAddress()
        );

        // Setup roles
        const operatorRole = await wormholeReceiver.OPERATOR_ROLE();
        await wormholeReceiver.connect(await ethers.getSigner(admin))
            .grantRole(operatorRole, operator);

        // Register source chain sender
        const sourceAddress = ethers.zeroPadValue(ethers.toBeHex(mockWormholeRelayer.target), 32);
        await wormholeReceiver.connect(await ethers.getSigner(operator))
            .setRegisteredSender(sourceChain, sourceAddress);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const defaultAdminRole = await wormholeReceiver.DEFAULT_ADMIN_ROLE();
            expect(await wormholeReceiver.hasRole(defaultAdminRole, admin)).to.be.true;
        });

        it("Should set dependencies correctly", async function () {
            expect(await wormholeReceiver.wormholeRelayer()).to.equal(await mockWormholeRelayer.getAddress());
            expect(await wormholeReceiver.settlementController()).to.equal(await mockSettlementController.getAddress());
        });

        it("Should revert deployment with zero addresses", async function () {
            const WormholeSettlementReceiver = await ethers.getContractFactory("WormholeSettlementReceiver");
            
            await expect(WormholeSettlementReceiver.deploy(
                ethers.ZeroAddress,
                await mockSettlementController.getAddress()
            )).to.be.revertedWith("Invalid wormhole relayer");

            await expect(WormholeSettlementReceiver.deploy(
                await mockWormholeRelayer.getAddress(),
                ethers.ZeroAddress
            )).to.be.revertedWith("Invalid settlement controller");
        });
    });

    describe("Sender Registration", function () {
        it("Should allow operator to register sender", async function () {
            const newSourceAddress = ethers.id("NEW_SOURCE");
            const newSourceChain = 3;

            await expect(wormholeReceiver.connect(await ethers.getSigner(operator))
                .setRegisteredSender(newSourceChain, newSourceAddress))
                .to.emit(wormholeReceiver, "RegisteredSenderUpdated")
                .withArgs(newSourceChain, newSourceAddress);

            expect(await wormholeReceiver.registeredSenders(newSourceChain))
                .to.equal(newSourceAddress);
        });

        it("Should reject zero address registration", async function () {
            await expect(wormholeReceiver.connect(await ethers.getSigner(operator))
                .setRegisteredSender(sourceChain, ethers.ZeroHash))
                .to.be.revertedWith("Invalid source address");
        });

        it("Should prevent non-operator from registering sender", async function () {
            await expect(wormholeReceiver.connect(await ethers.getSigner(user))
                .setRegisteredSender(sourceChain, ethers.id("NEW_SOURCE")))
                .to.be.revertedWith("Caller is not an operator");
        });
    });

    describe("Message Processing", function () {
        let encodedPayload: string;
        let sourceAddress: string;

        beforeEach(async function () {
            // Prepare settlement payload
            const settlementPayload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "address"],
                [await mockToken.getAddress(), testAmount, user]
            );

            // Prepare VAA payload
            encodedPayload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "address", "bytes"],
                [testMessageId, admin, await wormholeReceiver.getAddress(), settlementPayload]
            );

            sourceAddress = ethers.zeroPadValue(ethers.toBeHex(mockWormholeRelayer.target), 32);
        });

        it("Should process valid message successfully", async function () {
            await expect(wormholeReceiver.connect(await ethers.getSigner(await mockWormholeRelayer.getAddress()))
                .receiveWormholeMessages(
                    encodedPayload,
                    [],
                    sourceAddress,
                    sourceChain,
                    testDeliveryHash
                ))
                .to.emit(wormholeReceiver, "SettlementInstructionReceived")
                .withArgs(
                    testMessageId,
                    admin,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                );
        });

        it("Should reject message from unregistered sender", async function () {
            const invalidSourceAddress = ethers.id("INVALID_SOURCE");
            
            await expect(wormholeReceiver.connect(await ethers.getSigner(await mockWormholeRelayer.getAddress()))
                .receiveWormholeMessages(
                    encodedPayload,
                    [],
                    invalidSourceAddress,
                    sourceChain,
                    testDeliveryHash
                ))
                .to.be.revertedWith("Not registered sender");
        });

        it("Should reject message with invalid target", async function () {
            // Prepare payload with wrong target
            const invalidPayload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "address", "bytes"],
                [testMessageId, admin, ethers.Wallet.createRandom().address, "0x"]
            );

            await expect(wormholeReceiver.connect(await ethers.getSigner(await mockWormholeRelayer.getAddress()))
                .receiveWormholeMessages(
                    invalidPayload,
                    [],
                    sourceAddress,
                    sourceChain,
                    testDeliveryHash
                ))
                .to.be.revertedWith("Invalid target");
        });

        it("Should reject calls from non-relayer", async function () {
            await expect(wormholeReceiver.connect(await ethers.getSigner(user))
                .receiveWormholeMessages(
                    encodedPayload,
                    [],
                    sourceAddress,
                    sourceChain,
                    testDeliveryHash
                ))
                .to.be.revertedWith("Only Wormhole relayer can call");
        });
    });

    describe("Emergency Controls", function () {
        let encodedPayload: string;
        let sourceAddress: string;

        beforeEach(async function () {
            const settlementPayload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "address"],
                [await mockToken.getAddress(), testAmount, user]
            );

            encodedPayload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "address", "bytes"],
                [testMessageId, admin, await wormholeReceiver.getAddress(), settlementPayload]
            );

            sourceAddress = ethers.zeroPadValue(ethers.toBeHex(mockWormholeRelayer.target), 32);
        });

        it("Should allow admin to pause", async function () {
            await wormholeReceiver.connect(await ethers.getSigner(admin)).pause();
            expect(await wormholeReceiver.paused()).to.be.true;
        });

        it("Should prevent message processing when paused", async function () {
            await wormholeReceiver.connect(await ethers.getSigner(admin)).pause();

            await expect(wormholeReceiver.connect(await ethers.getSigner(await mockWormholeRelayer.getAddress()))
                .receiveWormholeMessages(
                    encodedPayload,
                    [],
                    sourceAddress,
                    sourceChain,
                    testDeliveryHash
                ))
                .to.be.revertedWithCustomError(wormholeReceiver, "EnforcedPause");
        });

        it("Should prevent non-admin from pausing", async function () {
            await expect(wormholeReceiver.connect(await ethers.getSigner(user))
                .pause())
                .to.be.revertedWith("Caller is not admin");
        });

        it("Should allow admin to unpause", async function () {
            await wormholeReceiver.connect(await ethers.getSigner(admin)).pause();
            await wormholeReceiver.connect(await ethers.getSigner(admin)).unpause();
            expect(await wormholeReceiver.paused()).to.be.false;
        });

        it("Should prevent non-admin from unpausing", async function () {
            await wormholeReceiver.connect(await ethers.getSigner(admin)).pause();
            await expect(wormholeReceiver.connect(await ethers.getSigner(user))
                .unpause())
                .to.be.revertedWith("Caller is not admin");
        });
    });
});