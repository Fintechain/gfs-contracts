/* import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { TransactionManager, IAccountManager, IParticipantRegistry, ERC20Token } from "../../typechain";  // Adjust imports according to your contract path

describe("TransactionManager", function () {
    let transactionManager: TransactionManager;
    let mockERC20: ERC20Token;
    let mockERC20Address: string;
    let admin: string;
    let processor: string;
    let accountManager: IAccountManager;
    let participantRegistry: IParticipantRegistry;

    const currency = ethers.encodeBytes32String("USDT");

    beforeEach(async function () {
        await deployments.fixture(['TransactionManager', 'Tokens', 'AccountManager', 'ParticipantRegistry', 'InitContracts']);

        const { platformAdmin, user, user2 } = await getNamedAccounts();

        processor = user2;
        admin = platformAdmin;

        const TransactionManagerDeployment = await deployments.get('TransactionManager');
        transactionManager = await ethers.getContractAt('TransactionManager', TransactionManagerDeployment.address);

        const AccountManagerDeployment = await deployments.get('AccountManager');
        accountManager = await ethers.getContractAt('AccountManager', AccountManagerDeployment.address);

        const ParticipantRegistryDeployment = await deployments.get('ParticipantRegistry');
        participantRegistry = await ethers.getContractAt('ParticipantRegistry', ParticipantRegistryDeployment.address);

        const  mockERC20Address = (await deployments.get('ERC20Token')).address;
        mockERC20 = await ethers.getContractAt('ERC20Token', mockERC20Address);

        // Setup mock data
        await mockERC20.connect(await ethers.getSigner(admin)).mint(user, 5000);
        
        await participantRegistry.connect(await ethers.getSigner(user)).registerParticipant(user);
        await participantRegistry.connect(await ethers.getSigner(processor)).registerParticipant(processor);

        await transactionManager.connect(await ethers.getSigner(admin)).addProcessor(processor);
    });

    describe("Deployment", function () {
        it("Should set the correct admin and processor roles", async function () {
            expect(await transactionManager.hasRole(await transactionManager.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
            expect(await transactionManager.hasRole(await transactionManager.PROCESSOR_ROLE(), processor)).to.be.true;
        });
    });

    describe("Transaction Submission", function () {
        it("Should submit a transaction successfully", async function () {
            const { user } = await getNamedAccounts();
            const contractResponse = await transactionManager.submitTransaction(user, 1000, currency);
            console.log('@@@@@@@@@@@@@', contractResponse.data);
            const tx = await transactionManager.getTransaction(contractResponse.data);
            expect(tx.from).to.equal(user);
            expect(tx.to).to.equal(user);
            expect(tx.amount).to.equal(1000);
            expect(tx.currency).to.equal(currency);
            expect(tx.status).to.equal(0); // Pending
        });

        it("Should revert when submitting a transaction with an inactive participant", async function () {
            const { user, processor } = await getNamedAccounts();
            await participantRegistry.connect(await ethers.getSigner(user)).removeUser(user); // Make user inactive
            await expect(transactionManager.connect(await ethers.getSigner(user)).submitTransaction(processor, 1000, currency))
                .to.be.revertedWith("Sender is not an active participant");
        });
    });

    describe("Transaction Processing", function () {
        beforeEach(async function () {
            const { user } = await getNamedAccounts();
            await transactionManager.connect(await ethers.getSigner(user)).submitTransaction(user, 1000, currency);
        });

        it("Should process the next transaction", async function () {
            const { processor } = await getNamedAccounts();
            await transactionManager.connect(await ethers.getSigner(processor)).processNextTransaction();
            const queueLength = await transactionManager.getQueueLength();
            expect(queueLength).to.equal(0);
        });

        it("Should revert if no transactions in the queue", async function () {
            const { processor } = await getNamedAccounts();
            await transactionManager.connect(await ethers.getSigner(processor)).processNextTransaction();
            await expect(transactionManager.connect(await ethers.getSigner(processor)).processNextTransaction())
                .to.be.revertedWith("No transactions in queue");
        });
    });

    describe("Batch Operations", function () {
        beforeEach(async function () {
            const { user, processor } = await getNamedAccounts();
            await transactionManager.connect(await ethers.getSigner(user)).submitTransaction(user, 1000, currency);
            await transactionManager.connect(await ethers.getSigner(user)).submitTransaction(user, 2000, currency);
            await transactionManager.connect(await ethers.getSigner(processor)).processNextTransaction(); // Queue the transaction
        });

        it("Should create a batch of transactions", async function () {
            const { processor } = await getNamedAccounts();
            const batchId = await transactionManager.createBatch(2);
            expect(batchId).to.be.a('string');
        });

        it("Should settle a batch of transactions", async function () {
            const { processor } = await getNamedAccounts();
            const batchId = await transactionManager.createBatch(2);

            console.log(">>>>>>>>>>>>>>", batchId)

            await transactionManager.connect(await ethers.getSigner(processor)).settleBatch(batchId);
            const tx = await transactionManager.getTransaction(batchId);
            expect(await transactionManager.createBatch(2)).not.to.be.reverted; // Settled
        });
    });

    describe("Access Control", function () {
        it("Should revert if non-processor tries to process a transaction", async function () {
            const { user } = await getNamedAccounts();
            await expect(transactionManager.connect(await ethers.getSigner(user)).processNextTransaction())
                .to.be.revertedWith("Caller is not a processor");
        });

        it("Should revert if non-admin tries to add a processor", async function () {
            const { user, processor } = await getNamedAccounts();
            await expect(transactionManager.connect(await ethers.getSigner(user)).addProcessor(processor))
                .to.be.revertedWith("Caller is not an admin");
        });
    });

    describe("Pause and Unpause", function () {
        it("Should allow admin to pause and unpause the contract", async function () {
            const { admin } = await getNamedAccounts();
            await transactionManager.connect(await ethers.getSigner(admin)).pause();
            await expect(transactionManager.submitTransaction(admin, 1000, currency))
                .to.be.revertedWith("Pausable: paused");
            await transactionManager.connect(await ethers.getSigner(admin)).unpause();
            await expect(transactionManager.submitTransaction(admin, 1000, currency))
                .to.not.be.reverted;
        });
    });
});
 */