/**
 * Deploy CHENGETO Health Smart Contract
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying ChengetoHealth contract...");

  const ChengetoHealth = await hre.ethers.getContractFactory("ChengetoHealth");
  const contract = await ChengetoHealth.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const owner = await contract.owner();

  console.log("ChengetoHealth deployed to:", address);
  console.log("Owner:", owner);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    address,
    owner,
    deployedAt: new Date().toISOString(),
    abi: JSON.parse(JSON.stringify(contract.interface.format()))
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
