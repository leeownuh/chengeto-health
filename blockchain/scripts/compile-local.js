const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractName = 'ChengetoHealth';
const sourceFileName = `${contractName}.sol`;
const sourcePath = path.join(__dirname, '..', 'contracts', sourceFileName);
const artifactsDir = path.join(__dirname, '..', 'artifacts');
const backendContractsDir = path.join(__dirname, '..', '..', 'backend', 'contracts');
const outputFileName = `${contractName}.contract.json`;

const source = fs.readFileSync(sourcePath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    [sourceFileName]: {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors?.length) {
  const errors = output.errors.filter((entry) => entry.severity === 'error');
  output.errors.forEach((entry) => {
    const channel = entry.severity === 'error' ? console.error : console.warn;
    channel(entry.formattedMessage.trim());
  });

  if (errors.length) {
    process.exit(1);
  }
}

const compiledContract = output.contracts?.[sourceFileName]?.[contractName];

if (!compiledContract?.abi || !compiledContract?.evm?.bytecode?.object) {
  console.error('Compiled contract artifact is missing ABI or bytecode.');
  process.exit(1);
}

const artifact = {
  contractName,
  sourceName: sourceFileName,
  compilerVersion: solc.version(),
  abi: compiledContract.abi,
  bytecode: `0x${compiledContract.evm.bytecode.object}`,
  deployedBytecode: `0x${compiledContract.evm.deployedBytecode.object || ''}`
};

for (const targetDir of [artifactsDir, backendContractsDir]) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, outputFileName),
    JSON.stringify(artifact, null, 2)
  );
}

console.log(`Compiled ${contractName} successfully.`);
console.log(`Artifact written to ${path.join(artifactsDir, outputFileName)}`);
console.log(`Artifact copied to ${path.join(backendContractsDir, outputFileName)}`);
