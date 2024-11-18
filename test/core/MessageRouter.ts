import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { MessageRouter, MockWormhole, MockWormholeRelayer, MockTargetRegistry, MockMessageProcessor, MockMessageHandler } from "../../typechain";
import { Address } from "hardhat-deploy/types";

describe("MessageRouter", function () {
    let messageRouter: MessageRouter;
    let mockWormhole: MockWormhole;
    let mockWormholeRelayer: MockWormholeRelayer;
    let mockTargetRegistry: MockTargetRegistry;
    let mockMessageProcessor: MockMessageProcessor;

    // Constants for testing
    const testMessageId = ethers.keccak256(ethers.toUtf8Bytes("TEST_MESSAGE"));
    const testPayload = ethers.toUtf8Bytes("test-payload");
    const sourceChain = 1; // e.g., Ethereum
    const targetChain = 6; // e.g., Avalanche
    const GAS_LIMIT = 250_000n;
    const MESSAGE_FEE = ethers.parseEther("0.001");

    // Store target address at the describe level
    let targetAddress: Address;

    beforeEach(async function () {
        await deployments.fixture(['MessageRouter_Test']);

        const mockWormholeDeployment = await deployments.get('MockWormhole');
        const mockWormholeRelayerDeployment = await deployments.get('MockWormholeRelayer');
        const mockTargetRegistryDeployment = await deployments.get('MockTargetRegistry');
        const mockMessageProcessorDeployment = await deployments.get('MockMessageProcessor');
        const messageRouterDeployment = await deployments.get('MessageRouter');

        mockWormhole = await ethers.getContractAt("MockWormhole", mockWormholeDeployment.address);
        mockWormholeRelayer = await ethers.getContractAt("MockWormholeRelayer", mockWormholeRelayerDeployment.address);
        mockTargetRegistry = await ethers.getContractAt("MockTargetRegistry", mockTargetRegistryDeployment.address);
        mockMessageProcessor = await ethers.getContractAt("MockMessageProcessor", mockMessageProcessorDeployment.address);
        messageRouter = await ethers.getContractAt("MessageRouter", messageRouterDeployment.address);

        // Set initial mock states
        await mockWormhole.setMessageFee(MESSAGE_FEE);

        // Set initial mock relayer prices
        await mockWormholeRelayer.setDeliveryPrice(
            targetChain,
            ethers.parseEther("0.1"), // Base delivery price
            ethers.parseEther("0.00001") // Refund per unused gas
        );
        await mockWormholeRelayer.setGasAndBytePrices(
            ethers.parseUnits("1", "gwei"), // 1 gwei per gas
            ethers.parseUnits("100", "wei") // 100 wei per byte
        );

        // Initialize targetAddress
        const { voter } = await getNamedAccounts();
        targetAddress = voter;
        await mockTargetRegistry.setValidTarget(targetAddress, targetChain, true);
    });

    describe("Message Routing", function () {
        let mockTarget: MockMessageHandler;
        let adminSigner: any;
        let currentChainId: number;

        beforeEach(async function () {
            const { admin } = await getNamedAccounts();
            adminSigner = await ethers.getSigner(admin);
            currentChainId = Number(await ethers.provider.getNetwork().then(n => n.chainId));

            // Deploy and setup mock handler
            mockTarget = await ethers.deployContract("MockMessageHandler");
            await mockTarget.setMockResult(ethers.toUtf8Bytes("processed"));
            await mockTarget.setSupportedTypes([ethers.id("TEST_MESSAGE_TYPE")]);

            // Setup permissions
            const routerRole = await messageRouter.ROUTER_ROLE();
            await messageRouter.connect(adminSigner).grantRole(routerRole, adminSigner.address);
            
            // Set target as valid
            await mockTargetRegistry.setValidTarget(
                await mockTarget.getAddress(),
                currentChainId,
                true
            );
        });

        it("Should route local message successfully", async function () {
            // Calculate required fee
            const localFee = await messageRouter.calculateLocalRoutingFee(testPayload.length);

            const tx = await messageRouter.connect(adminSigner).routeMessage(
                testMessageId,
                await mockTarget.getAddress(),
                currentChainId,
                testPayload,
                { value: localFee }
            );

            // Verify events
            await expect(tx)
                .to.emit(messageRouter, "MessageRouted")
                .withArgs(
                    testMessageId,
                    adminSigner.address,
                    await mockTarget.getAddress(),
                    currentChainId,
                    (arg: any) => typeof arg === "string"
                );

            await expect(tx)
                .to.emit(messageRouter, "MessageDelivered")
                .withArgs(
                    testMessageId,
                    (arg: any) => typeof arg === "string",
                    true
                );

            await expect(tx)
                .to.emit(messageRouter, "DeliveryCompleted");

            // Verify delivery status
            const receipt = await tx.wait();
            if (!receipt) throw new Error("No receipt");

            const block = await ethers.provider.getBlock(receipt.blockNumber);
            if (!block) throw new Error("No block");

            const deliveryHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "uint256"],
                    [testMessageId, block.timestamp]
                )
            );
            
            expect(await messageRouter.getDeliveryStatus(deliveryHash)).to.be.true;
        });

        it("Should refund excess fee for local routing", async function () {
            // Calculate fees
            const localFee = await messageRouter.calculateLocalRoutingFee(testPayload.length);
            const excessFee = localFee * 2n;

            // Track initial balance
            const initialBalance = await ethers.provider.getBalance(adminSigner.address);

            // Route message with excess fee
            const tx = await messageRouter.connect(adminSigner).routeMessage(
                testMessageId,
                await mockTarget.getAddress(),
                currentChainId,
                testPayload,
                { value: excessFee }
            );

            const receipt = await tx.wait();
            if (!receipt) throw new Error("No receipt");

            // Calculate gas costs
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            // Get final balance
            const finalBalance = await ethers.provider.getBalance(adminSigner.address);

            // Verify balance changes (should only lose localFee + gasCost)
            const expectedBalance = initialBalance - localFee - gasCost;
            expect(finalBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.0001"));
        });

        it("Should route cross-chain message successfully", async function () {
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            const tx = await messageRouter.connect(adminSigner).routeMessage(
                testMessageId,
                targetAddress,
                targetChain,
                testPayload,
                { value: fee }
            );

            await expect(tx)
                .to.emit(messageRouter, "MessageRouted")
                .withArgs(
                    testMessageId,
                    adminSigner.address,
                    targetAddress,
                    targetChain,
                    (arg: any) => typeof arg === "string"
                );
        });

        it("Should fail for invalid target", async function () {
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
            const invalidTarget = ethers.Wallet.createRandom().address;

            await expect(
                messageRouter.connect(adminSigner).routeMessage(
                    testMessageId,
                    invalidTarget,
                    targetChain,
                    testPayload,
                    { value: fee }
                )
            ).to.be.revertedWith("MessageRouter: Invalid target");
        });

        it("Should fail for empty payload", async function () {
            const fee = await messageRouter.quoteRoutingFee(targetChain, 0);

            await expect(
                messageRouter.connect(adminSigner).routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    "0x",
                    { value: fee }
                )
            ).to.be.revertedWith("MessageRouter: Empty payload");
        });
    });

    describe("Fee Management", function () {
        it("Should calculate local routing fee correctly", async function () {
            const fee = await messageRouter.calculateLocalRoutingFee(testPayload.length);
            const expectedFee = ethers.parseEther("0.001") + (BigInt(testPayload.length) * 100n);
            expect(fee).to.equal(expectedFee);
        });

        it("Should calculate cross-chain processing fee correctly", async function () {
            const fee = await messageRouter.calculateCrossChainProcessingFee(testPayload.length);
            const expectedFee = ethers.parseEther("0.002") + (BigInt(testPayload.length) * 200n);
            expect(fee).to.equal(expectedFee);
        });

        it("Should quote correct total fee for cross-chain routing", async function () {
            const totalFee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
            const processingFee = await messageRouter.calculateCrossChainProcessingFee(testPayload.length);
            const [wormholeDeliveryCost] = await mockWormholeRelayer.quoteEVMDeliveryPrice(
                targetChain,
                testPayload.length,
                GAS_LIMIT
            );
            const wormholeMsgFee = await mockWormhole.messageFee();

            expect(totalFee).to.equal(processingFee + wormholeDeliveryCost + wormholeMsgFee);
        });

        it("Should update cross-chain fee parameters", async function () {
            const { admin } = await getNamedAccounts();
            const newBaseFee = ethers.parseEther("0.003");
            const newMultiplier = 300n;

            await expect(
                messageRouter.connect(await ethers.getSigner(admin))
                    .setCrossChainFeeParameters(newBaseFee, newMultiplier)
            )
                .to.emit(messageRouter, "CrossChainFeesUpdated")
                .withArgs(newBaseFee, newMultiplier);

            const newFee = await messageRouter.calculateCrossChainProcessingFee(testPayload.length);
            const expectedFee = newBaseFee + (BigInt(testPayload.length) * newMultiplier);
            expect(newFee).to.equal(expectedFee);
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
            const adminSigner = await ethers.getSigner(admin);
            
            // Set base delivery price in mock relayer
            const baseGasPrice = ethers.parseUnits("1", "gwei"); // 1 gwei
            await mockWormholeRelayer.setGasAndBytePrices(
                baseGasPrice, // price per gas
                0n  // price per byte
            );
            
            // Set base delivery parameters
            await mockWormholeRelayer.setDeliveryPrice(
                targetChain,
                0, // no base price
                ethers.parseEther("0.00001") // some refund rate
            );
    
            // Get fee with default gas limit
            const defaultGasLimit = 250_000n; // From contract constant
            const defaultFee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
    
            // Set new higher gas limit
            const newGasLimit = 300_000n;
            await messageRouter.connect(adminSigner).setChainGasLimit(targetChain, newGasLimit);
    
            // Get fee with new gas limit
            const customFee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
    
            // Calculate expected difference based on gas price
            const gasDifference = (newGasLimit - defaultGasLimit) * baseGasPrice;
            
            // Add some buffer for potential rounding
            const tolerance = ethers.parseUnits("1", "wei");
            
            // Verify the difference is within expected range
            const actualDifference = customFee - defaultFee;
            expect(actualDifference).to.be.closeTo(gasDifference, tolerance);
            expect(customFee).to.be.gt(defaultFee);
        });
    
        it("Should fail to set gas limit to zero", async function () {
            const { admin } = await getNamedAccounts();
            await expect(
                messageRouter.connect(await ethers.getSigner(admin))
                    .setChainGasLimit(targetChain, 0)
            ).to.be.revertedWith("MessageRouter: Invalid gas limit");
        });
        
        it("Should properly calculate fees based on gas limit changes", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
    
            // Set precise fee components
            await mockWormholeRelayer.setGasAndBytePrices(
                ethers.parseUnits("1", "gwei"), // 1 gwei per gas
                ethers.parseUnits("1", "wei")  // 1 wei per byte
            );
            
            await mockWormholeRelayer.setDeliveryPrice(
                targetChain,
                ethers.parseEther("0.1"), // base price
                ethers.parseEther("0.00001") // refund rate
            );
    
            // Test multiple gas limit changes
            const gasLimits = [250_000n, 300_000n, 400_000n];
            let previousFee = 0n;
    
            for (const gasLimit of gasLimits) {
                await messageRouter.connect(adminSigner).setChainGasLimit(targetChain, gasLimit);
                const currentFee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);
                
                if (previousFee > 0n) {
                    const expectedIncrease = (gasLimit - (gasLimits[gasLimits.indexOf(gasLimit) - 1])) * 
                                          ethers.parseUnits("1", "gwei");
                    const actualIncrease = currentFee - previousFee;
                    expect(actualIncrease).to.be.closeTo(expectedIncrease, ethers.parseUnits("1", "wei"));
                }
                
                previousFee = currentFee;
            }
        });
    });

    describe("Security Features", function () {
        let targetAddress: string;

        beforeEach(async function () {
            targetAddress = ethers.Wallet.createRandom().address;
            await mockTargetRegistry.setValidTarget(targetAddress, targetChain, true);
        });

        it("Should validate target before routing", async function () {
            const { admin } = await getNamedAccounts();
            const invalidTarget = ethers.Wallet.createRandom().address;
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            await expect(messageRouter.connect(await ethers.getSigner(admin))
                .routeMessage(
                    testMessageId,
                    invalidTarget,
                    targetChain,
                    testPayload,
                    { value: fee }
                )).to.be.revertedWith("MessageRouter: Invalid target");
        });

        it("Should prevent empty payload", async function () {
            const { admin } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, 0);

            await expect(messageRouter.connect(await ethers.getSigner(admin))
                .routeMessage(
                    testMessageId,
                    targetAddress,
                    targetChain,
                    "0x",
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
            const { admin } = await getNamedAccounts();
            const fee = await messageRouter.quoteRoutingFee(targetChain, testPayload.length);

            await messageRouter.connect(await ethers.getSigner(admin)).pause();

            await expect(messageRouter.connect(await ethers.getSigner(admin))
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