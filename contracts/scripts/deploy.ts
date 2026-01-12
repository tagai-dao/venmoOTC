import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("🚀 Starting deployment...");

  // 获取部署账户
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("❌ No deployer account found. Please check your PRIVATE_KEY in .env file.");
  }
  const [deployer] = signers;
  console.log("📄 Deploying contracts with the account:", deployer.address);

  // USDT 合约地址 (BNB Chain 主网)
  // 如果是测试网，请修改为测试网的 USDT 地址
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

  console.log("⏳ Deploying VenmoOTCMultisig...");
  const VenmoOTCMultisig = await ethers.getContractFactory("VenmoOTCMultisig");
  const multisig = await VenmoOTCMultisig.deploy(USDT_ADDRESS);

  await multisig.waitForDeployment();

  const contractAddress = await multisig.getAddress();
  console.log("✅ VenmoOTCMultisig deployed to:", contractAddress);
  console.log("📝 USDT Token Address:", USDT_ADDRESS);

  console.log("\nNext steps:");
  console.log(`1. Update the contract address in your server config.`);
  console.log(`2. Verify the contract on BSCScan: npx hardhat verify --network bsc ${contractAddress} ${USDT_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
