import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { MessageProtocol } from "../../../typechain";

describe("MessageProtocol", function () {
    let messageProtocol: MessageProtocol;
    const testMessageType = ethers.encodeBytes32String("TEST_MESSAGE");
    const testSchema = ethers.toUtf8Bytes("test-schema");
    const testRequiredFields = [
        ethers.hexlify(ethers.randomBytes(4)),
        ethers.hexlify(ethers.randomBytes(4))
    ];
    const testPayload = ethers.concat([
        testRequiredFields[0],
        testRequiredFields[1],
        ethers.randomBytes(32)
    ]);

    let formatAdmin: string, validator: string, user: string

    beforeEach(async function () {
        // Deploy contracts
        await deployments.fixture(['mocks', 'core']);

        // Get named accounts
        const { admin } = await getNamedAccounts();
        
        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 3) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }
        formatAdmin = signers[2].address;
        validator = signers[3].address;
        user = signers[4].address;

        // Get the deployed contract
        const MessageProtocolDeployment = await deployments.get('MessageProtocol');
        messageProtocol = await ethers.getContractAt('MessageProtocol', MessageProtocolDeployment.address);

        // Grant roles
        const protocolAdminRole = await messageProtocol.PROTOCOL_ADMIN_ROLE();
        const formatAdminRole = await messageProtocol.FORMAT_ADMIN_ROLE();
        const validatorRole = await messageProtocol.VALIDATOR_ROLE();

        await messageProtocol.connect(await ethers.getSigner(admin)).grantRole(protocolAdminRole, admin);
        await messageProtocol.connect(await ethers.getSigner(admin)).grantRole(formatAdminRole, formatAdmin);
        await messageProtocol.connect(await ethers.getSigner(admin)).grantRole(validatorRole, validator);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await messageProtocol.hasRole(await messageProtocol.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set the correct initial version", async function () {
            const version = await messageProtocol.getProtocolVersion();
            expect(version.major).to.equal(1);
            expect(version.minor).to.equal(0);
            expect(version.patch).to.equal(0);
            expect(version.active).to.be.true;
        });
    });

    describe("Message Format Registration", function () {
        it("Should allow format admin to register a message format", async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema);

            const format = await messageProtocol.getMessageFormat(testMessageType);
            expect(format.isSupported).to.be.true;
            expect(format.messageType).to.equal(testMessageType);
            expect(format.schema).to.equal(ethers.hexlify(testSchema));
        });

        it("Should emit MessageFormatRegistered event", async function () {
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema))
                .to.emit(messageProtocol, "MessageFormatRegistered")
                .withArgs(testMessageType, testSchema);
        });

        it("Should revert if non-admin tries to register format", async function () {
            await expect(messageProtocol.connect(await ethers.getSigner(validator))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema))
                .to.be.rejectedWith("MessageProtocol: Caller must have FORMAT_ADMIN_ROLE");
        });

        it("Should revert if schema is empty", async function () {
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, "0x"))
                .to.be.rejectedWith("MessageProtocol: Schema cannot be empty");
        });
    });

    describe("Message Validation", function () {
        beforeEach(async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema);
        });

        it("Should validate correct message format", async function () {
            const isValid = await messageProtocol.connect(await ethers.getSigner(validator))
                .validateMessage(testMessageType, testPayload);
            expect(isValid).to.be.true;
        });

        it("Should reject message with missing required fields", async function () {
            const invalidPayload = ethers.concat([testRequiredFields[0], ethers.randomBytes(32)]);
            const isValid = await messageProtocol.connect(await ethers.getSigner(validator))
                .validateMessage(testMessageType, invalidPayload);
            expect(isValid).to.be.false;
        });

        it("Should reject unregistered message type", async function () {
            const unknownType = ethers.encodeBytes32String("UNKNOWN");
            const isValid = await messageProtocol.connect(await ethers.getSigner(validator))
                .validateMessage(unknownType, testPayload);
            expect(isValid).to.be.false;
        });

        it("Should revert if non-validator tries to validate", async function () {
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .validateMessage(testMessageType, testPayload))
                .to.be.rejectedWith("MessageProtocol: Caller must have VALIDATOR_ROLE");
        });
    });

    describe("Protocol Version Management", function () {
        it("Should allow protocol admin to update version", async function () {
            const { admin } = await getNamedAccounts();
            await messageProtocol.connect(await ethers.getSigner(admin))
                .updateProtocolVersion(2, 0, 0);

            const version = await messageProtocol.getProtocolVersion();
            expect(version.major).to.equal(2);
            expect(version.minor).to.equal(0);
            expect(version.patch).to.equal(0);
        });

        it("Should emit ProtocolVersionUpdated event", async function () {
            const { admin } = await getNamedAccounts();
            await expect(messageProtocol.connect(await ethers.getSigner(admin))
                .updateProtocolVersion(2, 0, 0))
                .to.emit(messageProtocol, "ProtocolVersionUpdated")
                .withArgs(2, 0, 0);
        });

        it("Should revert if non-admin tries to update version", async function () {
            await expect(messageProtocol.connect(await ethers.getSigner(validator))
                .updateProtocolVersion(2, 0, 0))
                .to.be.rejectedWith("MessageProtocol: Caller must have PROTOCOL_ADMIN_ROLE");
        });
    });

    describe("Format Management", function () {
        beforeEach(async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema);
        });

        it("Should allow format admin to deactivate format", async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .deactivateMessageFormat(testMessageType);

            const isSupported = await messageProtocol.isMessageTypeSupported(testMessageType);
            expect(isSupported).to.be.false;
        });

        it("Should emit FormatDeactivated event", async function () {
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .deactivateMessageFormat(testMessageType))
                .to.emit(messageProtocol, "FormatDeactivated")
                .withArgs(testMessageType);
        });

        it("Should allow format admin to reactivate format", async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .deactivateMessageFormat(testMessageType);
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .activateMessageFormat(testMessageType);

            const isSupported = await messageProtocol.isMessageTypeSupported(testMessageType);
            expect(isSupported).to.be.true;
        });

        it("Should emit FormatActivated event", async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .deactivateMessageFormat(testMessageType);
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .activateMessageFormat(testMessageType))
                .to.emit(messageProtocol, "FormatActivated")
                .withArgs(testMessageType);
        });
    });

    describe("Schema Management", function () {
        beforeEach(async function () {
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema);
        });

        it("Should allow format admin to update schema", async function () {
            const newSchema = ethers.toUtf8Bytes("new-schema");
            await messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .updateMessageSchema(testMessageType, newSchema);

            const format = await messageProtocol.getMessageFormat(testMessageType);
            expect(format.schema).to.equal(ethers.hexlify(newSchema));
        });

        it("Should emit SchemaUpdated event", async function () {
            const newSchema = ethers.toUtf8Bytes("new-schema");
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .updateMessageSchema(testMessageType, newSchema))
                .to.emit(messageProtocol, "SchemaUpdated")
                .withArgs(testMessageType, newSchema);
        });

        it("Should revert if updating schema for non-existent format", async function () {
            const unknownType = ethers.encodeBytes32String("UNKNOWN");
            const newSchema = ethers.toUtf8Bytes("new-schema");
            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .updateMessageSchema(unknownType, newSchema))
                .to.be.rejectedWith("MessageProtocol: Format not registered");
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow protocol admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await messageProtocol.connect(await ethers.getSigner(admin)).pause();
            expect(await messageProtocol.paused()).to.be.true;
        });

        it("Should allow protocol admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            await messageProtocol.connect(await ethers.getSigner(admin)).pause();
            await messageProtocol.connect(await ethers.getSigner(admin)).unpause();
            expect(await messageProtocol.paused()).to.be.false;
        });

        it("Should revert operations when paused", async function () {
            const { admin } = await getNamedAccounts();
            await messageProtocol.connect(await ethers.getSigner(admin)).pause();

            await expect(messageProtocol.connect(await ethers.getSigner(formatAdmin))
                .registerMessageFormat(testMessageType, testRequiredFields, testSchema))
                .to.be.rejected;
        });
    });
});