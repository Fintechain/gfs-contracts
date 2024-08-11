# Global Financial System (GFS)

Smart contracts for the decentralized Global Financial System (GFS) 

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Global Financial System (GFS) represents a framework for financial systems, leveraging blockchain technology to achieve enhanced decentralization, interoperability, and security. GFS employs smart contract functionalities within a modular and scalable infrastructure. This architecture is engineered to accommodate the varied and complex needs of both financial institutions and individual users, ensuring efficient and secure management of financial transactions and operations.


## Features

- EVM Compatibility
- Cosmos SDK Integration
- Proof-of-Stake Consensus
- Multi-Zone Architecture
- Inter-Blockchain Communication (IBC) Protocol
- Wormhole Integration

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- Git

## Installation

To install the GFS project, follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/ebanfa/gfs-contracts.git
   cd gfs
   ```

2. Install the dependencies:
   ```
   npm install
   ```

## Usage

To compile the contracts:

```
npx hardhat compile
```

To run the local Hardhat network:

```
npx hardhat node
```

## Testing

To run the test suite:

```
npx hardhat test
```

For coverage report:

```
npx hardhat coverage
```

## Deployment

This project uses `hardhat-deploy` for managing deployments.

To deploy to a network defined in the `hardhat.config.ts`:

```
npx hardhat deploy --network <network-name>
```

To run a specific deployment script:

```
npx hardhat deploy --tags <script-name>
```

## Contributing

Contributions to the GFS project are welcome. Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

If you have any questions, please reach out to [ebanfa@gmail.com](mailto:ebanfa@gmail.com).

## Acknowledgements

- [Hardhat](https://hardhat.org/)
- [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)
- [Cosmos SDK](https://cosmos.network/)
- [EVMOS](https://evmos.org/)
