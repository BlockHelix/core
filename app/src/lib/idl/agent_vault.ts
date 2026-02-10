/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/agent_vault.json`.
 */
export type AgentVault = {
  "address": "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS",
  "metadata": {
    "name": "agentVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Per-agent USDC vault with SPL share tokens"
  },
  "instructions": [
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "depositorUsdcAccount",
          "writable": true
        },
        {
          "name": "depositorShareAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "operatorShareAccount",
          "docs": [
            "Operator's share account to check minimum"
          ]
        },
        {
          "name": "depositRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultState"
              },
              {
                "kind": "account",
                "path": "depositor"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "minSharesOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "operator"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "vaultState"
              }
            ]
          }
        },
        {
          "name": "operator",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "protocolTreasury"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentFeeBps",
          "type": "u16"
        },
        {
          "name": "protocolFeeBps",
          "type": "u16"
        },
        {
          "name": "maxTvl",
          "type": "u64"
        },
        {
          "name": "lockupEpochs",
          "type": "u8"
        },
        {
          "name": "epochLength",
          "type": "i64"
        },
        {
          "name": "arbitrator",
          "type": "pubkey"
        },
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pause",
      "discriminator": [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "receiveRevenue",
      "discriminator": [
        154,
        21,
        184,
        235,
        215,
        131,
        44,
        130
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "payerUsdcAccount",
          "writable": true
        },
        {
          "name": "protocolUsdcAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "slash",
      "discriminator": [
        204,
        141,
        18,
        161,
        8,
        177,
        92,
        142
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "shareMint",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "operatorShareAccount",
          "writable": true
        },
        {
          "name": "clientUsdcAccount",
          "docs": [
            "1x refund to the client who was wronged"
          ],
          "writable": true
        },
        {
          "name": "ecosystemFundAccount",
          "docs": [
            "0.75x to ecosystem fund"
          ],
          "writable": true
        },
        {
          "name": "validatorUsdcAccount",
          "docs": [
            "0.25x bounty to the reporting validator"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "jobPayment",
          "type": "u64"
        },
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unpause",
      "discriminator": [
        169,
        144,
        4,
        38,
        10,
        141,
        188,
        255
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        },
        {
          "name": "operatorShareAccount"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "relations": [
            "vaultState"
          ]
        },
        {
          "name": "withdrawer",
          "writable": true,
          "signer": true
        },
        {
          "name": "withdrawerUsdcAccount",
          "writable": true
        },
        {
          "name": "withdrawerShareAccount",
          "writable": true
        },
        {
          "name": "depositRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultState"
              },
              {
                "kind": "account",
                "path": "withdrawer"
              }
            ]
          }
        },
        {
          "name": "registryState",
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        },
        {
          "name": "minAssetsOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "depositRecord",
      "discriminator": [
        83,
        232,
        10,
        31,
        251,
        49,
        189,
        167
      ]
    },
    {
      "name": "vaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "events": [
    {
      "name": "deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "revenueReceived",
      "discriminator": [
        194,
        10,
        115,
        158,
        29,
        194,
        157,
        65
      ]
    },
    {
      "name": "slashed",
      "discriminator": [
        98,
        59,
        249,
        154,
        233,
        53,
        98,
        194
      ]
    },
    {
      "name": "vaultInitialized",
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ]
    },
    {
      "name": "vaultPaused",
      "discriminator": [
        198,
        157,
        22,
        151,
        68,
        100,
        162,
        35
      ]
    },
    {
      "name": "vaultUnpaused",
      "discriminator": [
        116,
        95,
        48,
        104,
        229,
        9,
        64,
        84
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidFees",
      "msg": "Invalid fee configuration"
    },
    {
      "code": 6001,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6002,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6003,
      "name": "zeroShares",
      "msg": "Calculated shares would be zero"
    },
    {
      "code": 6004,
      "name": "vaultPaused",
      "msg": "Vault is paused"
    },
    {
      "code": 6005,
      "name": "tvlCapExceeded",
      "msg": "Deposit would exceed TVL cap"
    },
    {
      "code": 6006,
      "name": "lockupNotExpired",
      "msg": "Lockup period has not expired"
    },
    {
      "code": 6007,
      "name": "insufficientOperatorShares",
      "msg": "Operator must hold minimum shares"
    },
    {
      "code": 6008,
      "name": "operatorMinSharesRequired",
      "msg": "Operator cannot withdraw below minimum while active"
    },
    {
      "code": 6009,
      "name": "slippageExceeded",
      "msg": "Output below minimum slippage tolerance"
    },
    {
      "code": 6010,
      "name": "insufficientVaultBalance",
      "msg": "Vault balance insufficient for 2x slash"
    },
    {
      "code": 6011,
      "name": "registryRequired",
      "msg": "Registry account required for operator withdrawal"
    },
    {
      "code": 6012,
      "name": "pendingChallengesExist",
      "msg": "Cannot withdraw while challenges are pending"
    },
    {
      "code": 6013,
      "name": "invalidRegistry",
      "msg": "Registry account does not match vault PDA"
    }
  ],
  "types": [
    {
      "name": "depositRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "lastDepositEpoch",
            "type": "u64"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "revenueReceived",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "vaultCut",
            "type": "u64"
          },
          {
            "name": "protocolCut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "slashed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "jobPayment",
            "type": "u64"
          },
          {
            "name": "slashTotal",
            "type": "u64"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "clientRefund",
            "type": "u64"
          },
          {
            "name": "ecosystemFundAmount",
            "type": "u64"
          },
          {
            "name": "validatorBounty",
            "type": "u64"
          },
          {
            "name": "validator",
            "type": "pubkey"
          },
          {
            "name": "operatorSharesBurned",
            "type": "u64"
          },
          {
            "name": "depositorSharesBurned",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "arbitrator",
            "type": "pubkey"
          },
          {
            "name": "maxTvl",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "arbitrator",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "shareMint",
            "type": "pubkey"
          },
          {
            "name": "vaultUsdcAccount",
            "type": "pubkey"
          },
          {
            "name": "protocolTreasury",
            "type": "pubkey"
          },
          {
            "name": "agentFeeBps",
            "type": "u16"
          },
          {
            "name": "protocolFeeBps",
            "type": "u16"
          },
          {
            "name": "totalRevenue",
            "type": "u64"
          },
          {
            "name": "totalJobs",
            "type": "u64"
          },
          {
            "name": "totalSlashed",
            "type": "u64"
          },
          {
            "name": "slashEvents",
            "type": "u32"
          },
          {
            "name": "maxTvl",
            "type": "u64"
          },
          {
            "name": "virtualShares",
            "type": "u64"
          },
          {
            "name": "virtualAssets",
            "type": "u64"
          },
          {
            "name": "lockupEpochs",
            "type": "u8"
          },
          {
            "name": "epochLength",
            "type": "i64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "shareMintBump",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultUnpaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "withdrawer",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "usdcOut",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
