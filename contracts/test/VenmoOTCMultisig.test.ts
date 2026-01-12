import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { VenmoOTCMultisig, MockUSDT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VenmoOTCMultisig", function () {
  let multisig: VenmoOTCMultisig;
  let usdt: MockUSDT;
  let owner: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;
  let other: SignerWithAddress;

  const AMOUNT = ethers.parseEther("100");

  enum Choice { NONE, INITIATOR, COUNTERPARTY }
  enum OrderStatus { OPEN, EXECUTED, CANCELLED }

  beforeEach(async function () {
    [owner, userA, userB, other] = await ethers.getSigners();

    // 部署 Mock USDT
    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDTFactory.deploy();

    // 部署多签合约
    const MultisigFactory = await ethers.getContractFactory("VenmoOTCMultisig");
    multisig = await MultisigFactory.deploy(await usdt.getAddress());

    // 给用户 A 一些 USDT
    await usdt.mint(userA.address, AMOUNT * 2n);
    await usdt.connect(userA).approve(await multisig.getAddress(), AMOUNT * 2n);
  });

  describe("Order Creation", function () {
    it("Should create an order correctly", async function () {
      await expect(multisig.connect(userA).createOrder(userB.address, AMOUNT))
        .to.emit(multisig, "OrderCreated")
        .withArgs(0, userA.address, userB.address, AMOUNT);

      const order = await multisig.getOrder(0);
      expect(order.initiator).to.equal(userA.address);
      expect(order.counterparty).to.equal(userB.address);
      expect(order.amount).to.equal(AMOUNT);
      expect(order.status).to.equal(OrderStatus.OPEN);
      
      expect(await usdt.balanceOf(await multisig.getAddress())).to.equal(AMOUNT);
    });

    it("Should fail if amount is 0", async function () {
      await expect(multisig.connect(userA).createOrder(userB.address, 0))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Signing and Execution", function () {
    beforeEach(async function () {
      await multisig.connect(userA).createOrder(userB.address, AMOUNT);
    });

    it("Should execute trade when both agree on COUNTERPARTY", async function () {
      // A 签名：转给 B
      await multisig.connect(userA).signOrder(0, Choice.COUNTERPARTY);
      
      // B 签名：转给 B
      await expect(multisig.connect(userB).signOrder(0, Choice.COUNTERPARTY))
        .to.emit(multisig, "OrderExecuted")
        .withArgs(0, userB.address, AMOUNT);

      const order = await multisig.getOrder(0);
      expect(order.status).to.equal(OrderStatus.EXECUTED);
      expect(await usdt.balanceOf(userB.address)).to.equal(AMOUNT);
    });

    it("Should execute refund when both agree on INITIATOR", async function () {
      const initialBalance = await usdt.balanceOf(userA.address);
      
      await multisig.connect(userA).signOrder(0, Choice.INITIATOR);
      await multisig.connect(userB).signOrder(0, Choice.INITIATOR);

      expect(await usdt.balanceOf(userA.address)).to.equal(initialBalance + AMOUNT);
    });

    it("Should not execute if choices differ", async function () {
      await multisig.connect(userA).signOrder(0, Choice.COUNTERPARTY);
      await multisig.connect(userB).signOrder(0, Choice.INITIATOR);

      const order = await multisig.getOrder(0);
      expect(order.status).to.equal(OrderStatus.OPEN);
    });
  });

  describe("Choice Updates", function () {
    beforeEach(async function () {
      await multisig.connect(userA).createOrder(userB.address, AMOUNT);
    });

    it("Should allow updating choice before agreement", async function () {
      // A 一开始决定转给 B
      await multisig.connect(userA).signOrder(0, Choice.COUNTERPARTY);
      
      // A 发现错了，修改为退回自己
      await expect(multisig.connect(userA).updateChoice(0, Choice.INITIATOR))
        .to.emit(multisig, "ChoiceUpdated")
        .withArgs(0, userA.address, Choice.INITIATOR);

      // B 配合 A 退回
      await multisig.connect(userB).signOrder(0, Choice.INITIATOR);

      const order = await multisig.getOrder(0);
      expect(order.status).to.equal(OrderStatus.EXECUTED);
      expect(await usdt.balanceOf(userA.address)).to.not.equal(0);
    });

    it("Should execute immediately if update makes choices match", async function () {
      await multisig.connect(userA).signOrder(0, Choice.COUNTERPARTY);
      await multisig.connect(userB).signOrder(0, Choice.INITIATOR);
      
      // A 修改选择以匹配 B
      await expect(multisig.connect(userA).updateChoice(0, Choice.INITIATOR))
        .to.emit(multisig, "OrderExecuted")
        .withArgs(0, userA.address, AMOUNT);
    });
  });
});
