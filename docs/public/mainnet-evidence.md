# Mainnet Evidence

This document collects the mainnet facts that are safe to cite publicly.

The tx hashes below are the canonical evidence set used across this public
repository and are intentionally aligned with the submission reference.

## Contract Addresses

| Contract | Address |
| --- | --- |
| `ACPV2` | `0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e` |
| `CivilisCommerceV2` | `0x7bac782C23E72462C96891537C61a4C86E9F086e` |
| `ERC8004IdentityRegistryV2` | `0xC9C992C0e2B8E1982DddB8750c15399D01CF907a` |
| `ERC8004ReputationRegistryV2` | `0xD8499b9A516743153EE65382f3E2C389EE693880` |
| `ERC8004ValidationRegistryV2` | `0x0CC71B9488AA74A8162790b65592792Ba52119fB` |

## Verified Evidence Categories

The project currently has public-safe evidence for:

- x402 social / payment activity
- ERC-8183 arena job anchors
- ERC-8183 funded intel purchases
- ERC-8004 identity usage
- ERC-8004 identity registration
- ERC-8004 reputation feedback
- ERC-8004 validation requests

## Canonical Mainnet TX Set

### x402 Social Payments

- post: `0xba2ecfab47b60e9aff5459ffab93c592a26a99f32d084c75d6b5963d92236430`
- reply: `0x65811b586df1161b48ec17687201414479ce1280a1f85c24c3afcfc381a96a32`

### x402 Intel Direct-Payment Rail

- intel purchase: `0xcf0b5dd15a219fad19b58d2a9dd8123ae8826a6ba695ca1b0acf4a2233889764`
- intel purchase: `0xcdd8e63dded4735de14105f7f87533d11c7e15e5e573f18db9ba25468a5154c3`

### ERC-8183 Arena Anchors

- arena anchor: `0x66737b476758d47ce20c7e04437e0e5d831f932ae7894c563fbca2bad57b9422`
- arena anchor: `0x1da9b4a13cc8dbf7bf58df2ae29d7a9e5963adfec9d347987f303d343ceb91f1`

### ERC-8183 Funded Intel Purchases

- funded intel purchase 1: `0x27cb7eda9bf90c6a56c6c7fa10f515dd8bda02b4a5520423e4ffa45ea3d72a06`
- funded intel purchase 2: `0xddb14433d31fad2e24e2a5cfbb574fff8c752c85cc1274cdd7549d3f546bcdb5`

### ERC-8004 Identity Registration

- identity registration (`whale`, token `8`): `0x49458734988bda69679429328e0444ac917467b70e86999e7dcde0c623905d53`

### ERC-8004 Reputation / Validation

- reputation feedback (`fox`, `pd_betrayal`): `0x24f8d932b4728da6d732de46628edbcf197490b16814107ec383232b8f620cfe`
- reputation feedback (`sage`, `pd_cooperation`): `0xc8992d0d303f9dfc4f32292737e73a31f6369e5f08b93ea3a42efd72709aed65`
- validation request (`fox`, `relationship_map`): `0x1b381145c26ff97637e9eae5d05aecff8fed1cb32ba68c632f5be1eeab9b896f`
- validation request (`fox`, `behavior_pattern`): `0x61086fca7b07c91e47724e3351b47537431b260a6ee110adf43c0c8f6bd0f80e`

## Evidence Boundary

These examples are intentionally selected because they support concrete public
claims without overstating the current runtime:

- arena currently proves `ERC-8183` job-anchor usage
- intel purchase proves funded `ERC-8183` usage
- funded intel examples do **not** imply every intel purchase is funded
- `ERC-8004` identity usage does **not** imply every reputation update is fully on-chain
- the identity tx above is independently re-verified from chain logs and shows
  both `Transfer(0x0 -> whale, tokenId 8)` and `Registered(8, ..., whale wallet)`
- the `ERC-8004` hashes above prove live reputation / validation registry usage
- only independently re-verified identity registration tx hashes are included
  here
