import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { MessageRouter, MockWormhole, MockWormholeRelayer, MockTargetRegistry } from "../../typechain";

describe("MessageRouter", function () {
    let messageRouter: MessageRouter;
    let mockWormhole: MockWormhole;
    let mockWormholeRelayer: MockWormholeRelayer;
    let mockTargetRegistry: MockTargetRegistry;

    // Constants for testing
    const testMessageId = ethers.id("TEST_MESSAGE");
    const testPayload = ethers.toUtf8Bytes("test-payload");
    const sourceChain = 1;  // e.g., Ethereum
    const targetChain = 6;  // e.g., Avalanche
    const GAS_LIMIT = 250_000;
    const MESSAGE_FEE = ethers.parseEther("0.001");

    beforeEach(async function () {
        await deployments.fixture(['MessageRouter']);

        const { admin, router, relayer } = await getNamedAccounts();

        // Deploy mock contracts
        const WormholeFactory = await ethers.getContractFactory("MockWormhole");
        mockWormhole = await WormholeFactory.deploy();
        await mockWormhole.setMessageFee(MESSAGE_FEE);

        const WormholeRelayerFactory = await ethers.getContractFactory("MockWormholeRelayer");
        mockWormholeRelayer = await WormholeRelayerFactory.deploy();

        const TargetRegistryFactory = await ethers.getContractFactory("MockTargetRegistry");
        mockTargetRegistry = await TargetRegistryFactory.deploy();

        // Deploy MessageRouter
        const MessageRouterFactory = await ethers.getContractFactory("MessageRouter");
        messageRouter = await MessageRouterFactory.deploy(
            mockWormholeRelayer.getAddress(),
            mockWormhole.getAddress(),
            mockTargetRegistry.getAddress()
        );

        // Grant roles
        const routerRole = await messageRouter.ROUTER_ROLE();
        const relayerRole = await messageRouter.RELAYER_ROLE();

        await messageRouter.connect(await ethers.getSigner(admin))
            .grantRole(routerRole, router);
        await messageRouter.connect(await ethers.getSigner(admin))
            .grantRole(relayerRole, relayer);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await messageRouter.hasRole(await messageRouter.DEFAULT_ADMIN_ROLE(), admin))
                .to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            const { router, relayer } = await getNamedAccounts();
            expect(await messageRouter.hasRole(await messageRouter.ROUTER_ROLE(), router))
                .to.be.true;
            expect(await messageRouter.hasRole(await messageRouter.RELAYER_ROLE(), relayer))
                .to.be.true;
        });

        it("Should set correct dependencies", async function () {
            expect(await messageRouter.wormhole()).to.equal(await mockWormhole.getAddress());
            expect(await messageRouter.wormholeRelayer()).to.equal(await mockWormholeRelayer.getAddress());
            expect(await messageRouter.targetRegistry()).to.equal(await mockTargetRegistry.getAddress());
        });
    });

    describe("Message Routing", function () {
        let targetAddress: string;

        beforeEach(async function () {
            // Setup mock target
            targetAddress = ethers.Wallet.createRandom().address;
            await mockTargetRegistry.setValidTarget(targetAddress, targetChain, true);
        });

        it("Should route local message successfully", async function () {
            const { router } = await getNamedAccounts();
            const mockTarget = await (await ethers.getContractFactory("MockTarget")).deploy();

            await mockTargetRegistry.setValidTarget(await mockTarget.getAddress(), sourceChain, true);

            await expect(messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    await mockTarget.getAddress(),
                    sourceChain,
                    testPayload,
                    { value: ethers.parseEther("0.1") }
                ))
                .to.emit(messageRouter, "MessageRouted")
                .withArgs(
                    testMessageId,
                    router,
                    await mockTarget.getAddress(),
                    sourceChain,
                    expect.any(String) // deliveryHash
                );
        });

        it("Should route cross-chain message successfully", async function () {
            const { router } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            await expect(messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    testPayload,
                    { value: fee }
                ))
                .to.emit(messageRouter, "MessageRouted");
        });

        it("Should track delivery status correctly", async function () {
            const { router, relayer } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            const tx = await messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    testPayload,
                    { value: fee }
                );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(x => x.eventSignature === "MessageRouted(bytes32,address,address,uint16,bytes32)");
            const deliveryHash = event?.args?.[4];

            // Check initial status
            expect(await messageRouter.getDeliveryStatus(deliveryHash)).to.be.false;

            // Mark as completed
            await messageRouter.connect(await ethers.getSigner(relayer))
                .markDeliveryCompleted(deliveryHash);

            // Check final status
            expect(await messageRouter.getDeliveryStatus(deliveryHash)).to.be.true;
        });
    });

    describe("Fee Management", function () {
        let targetAddress: string;

        beforeEach(async function () {
            targetAddress = ethers.Wallet.createRandom().address;
            await mockTargetRegistry.setValidTarget(targetAddress, targetChain, true);
        });

        it("Should calculate correct routing fee", async function () {
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
            expect(fee).to.be.gt(0);
        });

        it("Should require sufficient fee", async function () {
            const { router } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            await expect(messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    testPayload,
                    { value: fee.sub(1) }
                )).to.be.revertedWith("MessageRouter: Insufficient fee");
        });

        it("Should allow admin to withdraw fees", async function () {
            const { admin, router } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            // Route message to accumulate fees
            await messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    testPayload,
                    { value: fee }
                );

            // Withdraw fees
            const adminSigner = await ethers.getSigner(admin);
            const balanceBefore = await ethers.provider.getBalance(admin);
            
            await messageRouter.connect(adminSigner).withdrawFees();

            const balanceAfter = await ethers.provider.getBalance(admin);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });
    });

    describe("Gas Limit Management", function () {
        it("Should allow admin to set chain gas limit", async function () {
            const { admin } = await getNamedAccounts();
            const newGasLimit = 300_000;

            await expect(messageRouter.connect(await ethers.getSigner(admin))
                .setChainGasLimit(targetChain, newGasLimit))
                .to.emit(messageRouter, "ChainGasLimitUpdated")
                .withArgs(targetChain, newGasLimit);
        });

        it("Should use custom gas limit in fee calculation", async function () {
            const { admin } = await getNamedAccounts();
            const newGasLimit = 300_000;

            await messageRouter.connect(await ethers.getSigner(admin))
                .setChainGasLimit(targetChain, newGasLimit);

            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
            const defaultFee = await messageRouter.quoteRoutingFee(sourceChain, testPayload.length);
            
            expect(fee).to.not.equal(defaultFee);
        });
    });

    describe("Security Features", function () {
        let targetAddress: string;

        beforeEach(async function () {
            targetAddress = ethers.Wallet.createRandom().address;
            await mockTargetRegistry.setValidTarget(targetAddress, targetChain, true);
        });

        it("Should validate target before routing", async function () {
            const { router } = await getNamedAccounts();
            const invalidTarget = ethers.Wallet.createRandom().address;
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            await expect(messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    invalidTarget,
                    targetChain,
                    testPayload,
                    { value: fee }
                )).to.be.revertedWith("MessageRouter: Invalid target");
        });

        it("Should prevent empty payload", async function () {
            const { router } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, 0);

            await expect(messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    [],
                    { value: fee }
                )).to.be.revertedWith("MessageRouter: Empty payload");
        });
    });

    describe("Emergency Controls", function () {
        let targetAddress: string;

        beforeEach(async function () {
            targetAddress = ethers.Wallet.createRandom().address;
            await mockTargetRegistry.setValidTarget(targetAddress, targetChain, true);
        });

        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await messageRouter.connect(await ethers.getSigner(admin)).pause();
            expect(await messageRouter.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { admin, router } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            await messageRouter.connect(await ethers.getSigner(admin)).pause();
            
            await expect(messageRouter.connect(await ethers.getSigner(router))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    testPayload,
                    { value: fee }
                )).to.be.reverted;
        });

        it("Should allow admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            await messageRouter.connect(await ethers.getSigner(admin)).pause();
            await messageRouter.connect(await ethers.getSigner(admin)).unpause();
            expect(await messageRouter.paused()).to.be.false;
        });
    });
});