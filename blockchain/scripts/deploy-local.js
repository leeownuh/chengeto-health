const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const contractName = 'ChengetoHealth';
const artifactPath = path.join(__dirname, '..', 'artifacts', `${contractName}.contract.json`);
const deploymentPath = path.join(__dirname, '..', 'deployment.json');
const backendRuntimePath = path.join(__dirname, '..', '..', 'backend', 'runtime', 'blockchain.deployment.json');

async function main() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing artifact at ${artifactPath}. Run npm run compile first.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  const privateKey =
    process.env.BLOCKCHAIN_PRIVATE_KEY ||
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log(`Deploying ${contractName} to ${rpcUrl} with ${wallet.address}...`);

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployment = {
    contractName,
    address,
    owner: wallet.address,
    rpcUrl,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    abi: artifact.abi
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  fs.mkdirSync(path.dirname(backendRuntimePath), { recursive: true });
  fs.writeFileSync(backendRuntimePath, JSON.stringify(deployment, null, 2));

  console.log(`Contract deployed to ${address}`);
  console.log(`Deployment saved to ${deploymentPath}`);
  console.log(`Deployment copied to ${backendRuntimePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
