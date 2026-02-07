// Auto-generated from IDL
export type AgentVault = {
  "accounts": [
    {
      "discriminator": [
        83,
        232,
        10,
        31,
        251,
        49,
        189,
        167
      ],
      "name": "DepositRecord"
    },
    {
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ],
      "name": "VaultState"
    }
  ],
  "address": "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS",
  "errors": [
    {
      "code": 6000,
      "msg": "Invalid fee configuration",
      "name": "InvalidFees"
    },
    {
      "code": 6001,
      "msg": "Arithmetic overflow",
      "name": "ArithmeticOverflow"
    },
    {
      "code": 6002,
      "msg": "Amount must be greater than zero",
      "name": "ZeroAmount"
    },
    {
      "code": 6003,
      "msg": "Calculated shares would be zero",
      "name": "ZeroShares"
    },
    {
      "code": 6004,
      "msg": "Vault is paused",
      "name": "VaultPaused"
    },
    {
      "code": 6005,
      "msg": "Deposit would exceed TVL cap",
      "name": "TVLCapExceeded"
    },
    {
      "code": 6006,
      "msg": "Lockup period has not expired",
      "name": "LockupNotExpired"
    },
    {
      "code": 6007,
      "msg": "Operator must hold minimum shares",
      "name": "InsufficientOperatorShares"
    },
    {
      "code": 6008,
      "msg": "Operator cannot withdraw below minimum while active",
      "name": "OperatorMinSharesRequired"
    },
    {
      "code": 6009,
      "msg": "Output below minimum slippage tolerance",
      "name": "SlippageExceeded"
    },
    {
      "code": 6010,
      "msg": "Vault balance insufficient for 2x slash",
      "name": "InsufficientVaultBalance"
    }
  ],
  "events": [
    {
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ],
      "name": "Deposited"
    },
    {
      "discriminator": [
        194,
        10,
        115,
        158,
        29,
        194,
        157,
        65
      ],
      "name": "RevenueReceived"
    },
    {
      "discriminator": [
        98,
        59,
        249,
        154,
        233,
        53,
        98,
        194
      ],
      "name": "Slashed"
    },
    {
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ],
      "name": "VaultInitialized"
    },
    {
      "discriminator": [
        198,
        157,
        22,
        151,
        68,
        100,
        162,
        35
      ],
      "name": "VaultPaused"
    },
    {
      "discriminator": [
        116,
        95,
        48,
        104,
        229,
        9,
        64,
        84
      ],
      "name": "VaultUnpaused"
    },
    {
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ],
      "name": "Withdrawn"
    }
  ],
  "instructions": [
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "share_mint",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "depositor",
          "signer": true,
          "writable": true
        },
        {
          "name": "depositor_usdc_account",
          "writable": true
        },
        {
          "name": "depositor_share_account",
          "pda": {
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
            },
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
                "path": "share_mint"
              }
            ]
          },
          "writable": true
        },
        {
          "docs": [
            "Operator's share account to check minimum"
          ],
          "name": "operator_share_account"
        },
        {
          "name": "deposit_record",
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
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "depositor"
              }
            ]
          },
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        },
        {
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          "name": "associated_token_program"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "min_shares_out",
          "type": "u64"
        }
      ],
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
      "name": "deposit"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
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
          },
          "writable": true
        },
        {
          "name": "share_mint",
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
                "path": "vault_state"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "operator",
          "signer": true,
          "writable": true
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "vault_usdc_account",
          "pda": {
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
            },
            "seeds": [
              {
                "kind": "account",
                "path": "vault_state"
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
                "path": "usdc_mint"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "protocol_treasury"
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        },
        {
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          "name": "associated_token_program"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "agent_fee_bps",
          "type": "u16"
        },
        {
          "name": "protocol_fee_bps",
          "type": "u16"
        },
        {
          "name": "max_tvl",
          "type": "u64"
        },
        {
          "name": "lockup_epochs",
          "type": "u8"
        },
        {
          "name": "epoch_length",
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
      ],
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
      "name": "initialize"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [],
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
      "name": "pause"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "payer",
          "signer": true,
          "writable": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "payer_usdc_account",
          "writable": true
        },
        {
          "name": "protocol_usdc_account",
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "job_id",
          "type": "u64"
        }
      ],
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
      "name": "receive_revenue"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "share_mint",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "operator_share_account",
          "writable": true
        },
        {
          "docs": [
            "1x refund to the client who was wronged"
          ],
          "name": "client_usdc_account",
          "writable": true
        },
        {
          "docs": [
            "0.75x to ecosystem fund"
          ],
          "name": "ecosystem_fund_account",
          "writable": true
        },
        {
          "docs": [
            "0.25x bounty to the reporting validator"
          ],
          "name": "validator_usdc_account",
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "job_payment",
          "type": "u64"
        },
        {
          "name": "job_id",
          "type": "u64"
        }
      ],
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
      "name": "slash"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        },
        {
          "name": "operator_share_account"
        }
      ],
      "args": [],
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
      "name": "unpause"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "share_mint",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "withdrawer",
          "signer": true,
          "writable": true
        },
        {
          "name": "withdrawer_usdc_account",
          "writable": true
        },
        {
          "name": "withdrawer_share_account",
          "writable": true
        },
        {
          "name": "deposit_record",
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
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "withdrawer"
              }
            ]
          },
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        },
        {
          "name": "min_assets_out",
          "type": "u64"
        }
      ],
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
      "name": "withdraw"
    }
  ],
  "metadata": {
    "description": "Per-agent USDC vault with SPL share tokens",
    "name": "agent_vault",
    "spec": "0.1.0",
    "version": "0.1.0"
  },
  "types": [
    {
      "name": "DepositRecord",
      "type": {
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
            "name": "last_deposit_epoch",
            "type": "u64"
          },
          {
            "name": "total_deposited",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "Deposited",
      "type": {
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
        ],
        "kind": "struct"
      }
    },
    {
      "name": "RevenueReceived",
      "type": {
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
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "vault_cut",
            "type": "u64"
          },
          {
            "name": "protocol_cut",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "Slashed",
      "type": {
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "job_payment",
            "type": "u64"
          },
          {
            "name": "slash_total",
            "type": "u64"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client_refund",
            "type": "u64"
          },
          {
            "name": "ecosystem_fund_amount",
            "type": "u64"
          },
          {
            "name": "validator_bounty",
            "type": "u64"
          },
          {
            "name": "validator",
            "type": "pubkey"
          },
          {
            "name": "operator_shares_burned",
            "type": "u64"
          },
          {
            "name": "depositor_shares_burned",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultInitialized",
      "type": {
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
            "name": "max_tvl",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultPaused",
      "type": {
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultState",
      "type": {
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
            "name": "usdc_mint",
            "type": "pubkey"
          },
          {
            "name": "share_mint",
            "type": "pubkey"
          },
          {
            "name": "vault_usdc_account",
            "type": "pubkey"
          },
          {
            "name": "protocol_treasury",
            "type": "pubkey"
          },
          {
            "name": "agent_fee_bps",
            "type": "u16"
          },
          {
            "name": "protocol_fee_bps",
            "type": "u16"
          },
          {
            "name": "total_revenue",
            "type": "u64"
          },
          {
            "name": "total_jobs",
            "type": "u64"
          },
          {
            "name": "total_slashed",
            "type": "u64"
          },
          {
            "name": "slash_events",
            "type": "u32"
          },
          {
            "name": "max_tvl",
            "type": "u64"
          },
          {
            "name": "virtual_shares",
            "type": "u64"
          },
          {
            "name": "virtual_assets",
            "type": "u64"
          },
          {
            "name": "lockup_epochs",
            "type": "u8"
          },
          {
            "name": "epoch_length",
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
            "name": "share_mint_bump",
            "type": "u8"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultUnpaused",
      "type": {
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "Withdrawn",
      "type": {
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
            "name": "usdc_out",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    }
  ]
};

export const IDL: AgentVault = {
  "accounts": [
    {
      "discriminator": [
        83,
        232,
        10,
        31,
        251,
        49,
        189,
        167
      ],
      "name": "DepositRecord"
    },
    {
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ],
      "name": "VaultState"
    }
  ],
  "address": "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS",
  "errors": [
    {
      "code": 6000,
      "msg": "Invalid fee configuration",
      "name": "InvalidFees"
    },
    {
      "code": 6001,
      "msg": "Arithmetic overflow",
      "name": "ArithmeticOverflow"
    },
    {
      "code": 6002,
      "msg": "Amount must be greater than zero",
      "name": "ZeroAmount"
    },
    {
      "code": 6003,
      "msg": "Calculated shares would be zero",
      "name": "ZeroShares"
    },
    {
      "code": 6004,
      "msg": "Vault is paused",
      "name": "VaultPaused"
    },
    {
      "code": 6005,
      "msg": "Deposit would exceed TVL cap",
      "name": "TVLCapExceeded"
    },
    {
      "code": 6006,
      "msg": "Lockup period has not expired",
      "name": "LockupNotExpired"
    },
    {
      "code": 6007,
      "msg": "Operator must hold minimum shares",
      "name": "InsufficientOperatorShares"
    },
    {
      "code": 6008,
      "msg": "Operator cannot withdraw below minimum while active",
      "name": "OperatorMinSharesRequired"
    },
    {
      "code": 6009,
      "msg": "Output below minimum slippage tolerance",
      "name": "SlippageExceeded"
    },
    {
      "code": 6010,
      "msg": "Vault balance insufficient for 2x slash",
      "name": "InsufficientVaultBalance"
    }
  ],
  "events": [
    {
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ],
      "name": "Deposited"
    },
    {
      "discriminator": [
        194,
        10,
        115,
        158,
        29,
        194,
        157,
        65
      ],
      "name": "RevenueReceived"
    },
    {
      "discriminator": [
        98,
        59,
        249,
        154,
        233,
        53,
        98,
        194
      ],
      "name": "Slashed"
    },
    {
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ],
      "name": "VaultInitialized"
    },
    {
      "discriminator": [
        198,
        157,
        22,
        151,
        68,
        100,
        162,
        35
      ],
      "name": "VaultPaused"
    },
    {
      "discriminator": [
        116,
        95,
        48,
        104,
        229,
        9,
        64,
        84
      ],
      "name": "VaultUnpaused"
    },
    {
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ],
      "name": "Withdrawn"
    }
  ],
  "instructions": [
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "share_mint",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "depositor",
          "signer": true,
          "writable": true
        },
        {
          "name": "depositor_usdc_account",
          "writable": true
        },
        {
          "name": "depositor_share_account",
          "pda": {
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
            },
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
                "path": "share_mint"
              }
            ]
          },
          "writable": true
        },
        {
          "docs": [
            "Operator's share account to check minimum"
          ],
          "name": "operator_share_account"
        },
        {
          "name": "deposit_record",
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
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "depositor"
              }
            ]
          },
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        },
        {
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          "name": "associated_token_program"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "min_shares_out",
          "type": "u64"
        }
      ],
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
      "name": "deposit"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
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
          },
          "writable": true
        },
        {
          "name": "share_mint",
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
                "path": "vault_state"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "operator",
          "signer": true,
          "writable": true
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "vault_usdc_account",
          "pda": {
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
            },
            "seeds": [
              {
                "kind": "account",
                "path": "vault_state"
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
                "path": "usdc_mint"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "protocol_treasury"
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        },
        {
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          "name": "associated_token_program"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "agent_fee_bps",
          "type": "u16"
        },
        {
          "name": "protocol_fee_bps",
          "type": "u16"
        },
        {
          "name": "max_tvl",
          "type": "u64"
        },
        {
          "name": "lockup_epochs",
          "type": "u8"
        },
        {
          "name": "epoch_length",
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
      ],
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
      "name": "initialize"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [],
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
      "name": "pause"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "payer",
          "signer": true,
          "writable": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "payer_usdc_account",
          "writable": true
        },
        {
          "name": "protocol_usdc_account",
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "job_id",
          "type": "u64"
        }
      ],
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
      "name": "receive_revenue"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "share_mint",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "operator_share_account",
          "writable": true
        },
        {
          "docs": [
            "1x refund to the client who was wronged"
          ],
          "name": "client_usdc_account",
          "writable": true
        },
        {
          "docs": [
            "0.75x to ecosystem fund"
          ],
          "name": "ecosystem_fund_account",
          "writable": true
        },
        {
          "docs": [
            "0.25x bounty to the reporting validator"
          ],
          "name": "validator_usdc_account",
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "job_payment",
          "type": "u64"
        },
        {
          "name": "job_id",
          "type": "u64"
        }
      ],
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
      "name": "slash"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        },
        {
          "name": "operator_share_account"
        }
      ],
      "args": [],
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
      "name": "unpause"
    },
    {
      "accounts": [
        {
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "share_mint",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "vault_usdc_account",
          "relations": [
            "vault_state"
          ],
          "writable": true
        },
        {
          "name": "withdrawer",
          "signer": true,
          "writable": true
        },
        {
          "name": "withdrawer_usdc_account",
          "writable": true
        },
        {
          "name": "withdrawer_share_account",
          "writable": true
        },
        {
          "name": "deposit_record",
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
                "path": "vault_state"
              },
              {
                "kind": "account",
                "path": "withdrawer"
              }
            ]
          },
          "writable": true
        },
        {
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          "name": "token_program"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        },
        {
          "name": "min_assets_out",
          "type": "u64"
        }
      ],
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
      "name": "withdraw"
    }
  ],
  "metadata": {
    "description": "Per-agent USDC vault with SPL share tokens",
    "name": "agent_vault",
    "spec": "0.1.0",
    "version": "0.1.0"
  },
  "types": [
    {
      "name": "DepositRecord",
      "type": {
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
            "name": "last_deposit_epoch",
            "type": "u64"
          },
          {
            "name": "total_deposited",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "Deposited",
      "type": {
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
        ],
        "kind": "struct"
      }
    },
    {
      "name": "RevenueReceived",
      "type": {
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
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "vault_cut",
            "type": "u64"
          },
          {
            "name": "protocol_cut",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "Slashed",
      "type": {
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "job_payment",
            "type": "u64"
          },
          {
            "name": "slash_total",
            "type": "u64"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client_refund",
            "type": "u64"
          },
          {
            "name": "ecosystem_fund_amount",
            "type": "u64"
          },
          {
            "name": "validator_bounty",
            "type": "u64"
          },
          {
            "name": "validator",
            "type": "pubkey"
          },
          {
            "name": "operator_shares_burned",
            "type": "u64"
          },
          {
            "name": "depositor_shares_burned",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultInitialized",
      "type": {
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
            "name": "max_tvl",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultPaused",
      "type": {
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultState",
      "type": {
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
            "name": "usdc_mint",
            "type": "pubkey"
          },
          {
            "name": "share_mint",
            "type": "pubkey"
          },
          {
            "name": "vault_usdc_account",
            "type": "pubkey"
          },
          {
            "name": "protocol_treasury",
            "type": "pubkey"
          },
          {
            "name": "agent_fee_bps",
            "type": "u16"
          },
          {
            "name": "protocol_fee_bps",
            "type": "u16"
          },
          {
            "name": "total_revenue",
            "type": "u64"
          },
          {
            "name": "total_jobs",
            "type": "u64"
          },
          {
            "name": "total_slashed",
            "type": "u64"
          },
          {
            "name": "slash_events",
            "type": "u32"
          },
          {
            "name": "max_tvl",
            "type": "u64"
          },
          {
            "name": "virtual_shares",
            "type": "u64"
          },
          {
            "name": "virtual_assets",
            "type": "u64"
          },
          {
            "name": "lockup_epochs",
            "type": "u8"
          },
          {
            "name": "epoch_length",
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
            "name": "share_mint_bump",
            "type": "u8"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "VaultUnpaused",
      "type": {
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "Withdrawn",
      "type": {
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
            "name": "usdc_out",
            "type": "u64"
          }
        ],
        "kind": "struct"
      }
    }
  ]
};
