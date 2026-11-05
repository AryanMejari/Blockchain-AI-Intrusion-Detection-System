const fs = require('fs');
const path = require('path');
const solc = require('solc');

function collectSolidityFiles(dir, baseDir = dir) {
  let files = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'build' && entry.name !== 'node_modules') {
        Object.assign(files, collectSolidityFiles(fullPath, baseDir));
      }
    } else if (entry.isFile() && entry.name.endsWith('.sol')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files[relPath] = {
        content: fs.readFileSync(fullPath, 'utf8'),
      };
    }
  }
  return files;
}

function findImports(importPath) {
  const contractsDir = path.resolve(__dirname);
  const resolved = path.resolve(contractsDir, importPath);
  if (fs.existsSync(resolved)) {
    return { contents: fs.readFileSync(resolved, 'utf8') };
  }
  // Try without leading ./
  const cleanPath = importPath.replace(/^\.\//, '');
  const altResolved = path.resolve(contractsDir, cleanPath);
  if (fs.existsSync(altResolved)) {
    return { contents: fs.readFileSync(altResolved, 'utf8') };
  }
  return { error: `File not found: ${importPath}` };
}

function compile() {
  const contractsDir = path.resolve(__dirname);
  const sources = collectSolidityFiles(contractsDir);

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      evmVersion: 'shanghai',
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    let hasError = false;
    for (const error of output.errors) {
      if (error.severity === 'error') {
        hasError = true;
        console.error(error.formattedMessage);
      } else {
        console.warn(error.formattedMessage);
      }
    }
    if (hasError) {
      process.exit(1);
    }
  }

  const contract = output.contracts['SentinelLedger.sol']['SentinelLedger'];
  const artifact = {
    contractName: 'SentinelLedger',
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
  };

  const buildDir = path.resolve(__dirname, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const artifactPath = path.resolve(buildDir, 'SentinelLedger.json');
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`[Compile] Successfully compiled SentinelLedger.sol (EVM: shanghai) -> ${artifactPath}`);
}

compile();
