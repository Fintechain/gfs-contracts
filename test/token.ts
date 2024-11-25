import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ERC20Token } from "../typechain";

describe("ERC20 Token Basic Tests", function () {
    let token: ERC20Token;
    
    async function deployTokenFixture() {
        const { admin, user } = await getNamedAccounts();

        await deployments.fixture(['tokens']);
        const token = await ethers.getContract<ERC20Token>("ERC20Token");

        return {
            token,
            admin,
            user
        };
    }

    beforeEach(async function () {
        const contracts = await loadFixture(deployTokenFixture);
        token = contracts.token;
    });

    it("Should mint tokens and verify balances", async function () {
        const { admin, user } = await getNamedAccounts();
        const adminSigner = await ethers.getSigner(admin);
        const mintAmount = ethers.parseEther("1000");
        
        // Mint tokens to user using admin signer
        const oldUserBalance = await token.balanceOf(user);
        const oldAdminBalance = await token.balanceOf(admin);
        await token.connect(adminSigner).mint(user, mintAmount);
        
        // Check balance
        const balance = await token.balanceOf(user);
        expect(balance).to.equal(mintAmount);

        // Transfer some tokens to admin
        const transferAmount = ethers.parseEther("100");
        await token.connect(await ethers.getSigner(user)).transfer(admin, transferAmount);

        // Verify balances after transfer
        const newAdminBalance = oldAdminBalance + transferAmount;
        const newUserBalance = oldUserBalance + mintAmount - transferAmount;

        expect(await token.balanceOf(user)).to.equal(newUserBalance);
        expect(await token.balanceOf(admin)).to.equal(newAdminBalance);
    });

    it("Should verify admin has minter role", async function() {
        const { admin } = await getNamedAccounts();
        const minterRole = await token.MINTER_ROLE();
        
        expect(await token.hasRole(minterRole, admin)).to.be.true;
    });
});