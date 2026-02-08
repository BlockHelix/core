/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/agent_factory.json`.
 */
export type AgentFactory = {
  "address": "7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j",
  "metadata": {
    "name": "agentFactory",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "One-instruction agent deployment factory"
  },
  "instructions": [
    {
      "name": "createAgent",
      "discriminator": [
        143,
        66,
        198,
        95,
        110,
        85,
        83,
        249
      ],
      "accounts": [
        {
          "name": "factoryState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  99,
                  116,
                  111,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "agentMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "factoryState"
              },
              {
                "kind": "account",
                "path": "factory_state.agent_count",
                "account": "factoryState"
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
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true
        },
        {
          "name": "protocolTreasury"
        },
        {
          "name": "operatorUsdcAccount",
          "docs": [
            "Operator's USDC account for receiving x402 payments"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "operator"
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
          "name": "registryState",
          "writable": true
        },
        {
          "name": "vaultProgram",
          "address": "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS"
        },
        {
          "name": "registryProgram",
          "address": "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9"
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
          "name": "name",
          "type": "string"
        },
        {
          "name": "githubHandle",
          "type": "string"
        },
        {
          "name": "endpointUrl",
          "type": "string"
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
          "name": "challengeWindow",
          "type": "i64"
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
          "name": "jobSigner",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "deactivateAgent",
      "discriminator": [
        205,
        171,
        239,
        225,
        82,
        126,
        96,
        166
      ],
      "accounts": [
        {
          "name": "agentMetadata",
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
      "name": "initializeFactory",
      "discriminator": [
        179,
        64,
        75,
        250,
        39,
        254,
        240,
        178
      ],
      "accounts": [
        {
          "name": "factoryState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  97,
                  99,
                  116,
                  111,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocolTreasury"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "minProtocolFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateAgent",
      "discriminator": [
        85,
        2,
        178,
        9,
        119,
        139,
        102,
        164
      ],
      "accounts": [
        {
          "name": "agentMetadata",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "name",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "githubHandle",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "endpointUrl",
          "type": {
            "option": "string"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agentMetadata",
      "discriminator": [
        106,
        95,
        194,
        10,
        53,
        133,
        159,
        163
      ]
    },
    {
      "name": "factoryState",
      "discriminator": [
        91,
        157,
        184,
        99,
        123,
        112,
        102,
        7
      ]
    }
  ],
  "events": [
    {
      "name": "agentCreated",
      "discriminator": [
        237,
        44,
        61,
        111,
        90,
        251,
        241,
        34
      ]
    },
    {
      "name": "agentDeactivated",
      "discriminator": [
        138,
        251,
        82,
        87,
        119,
        148,
        20,
        180
      ]
    },
    {
      "name": "agentUpdated",
      "discriminator": [
        210,
        179,
        162,
        250,
        123,
        250,
        210,
        166
      ]
    },
    {
      "name": "factoryInitialized",
      "discriminator": [
        20,
        86,
        103,
        75,
        20,
        220,
        162,
        63
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nameTooLong",
      "msg": "Name too long"
    },
    {
      "code": 6001,
      "name": "gitHubHandleTooLong",
      "msg": "GitHub handle too long"
    },
    {
      "code": 6002,
      "name": "endpointUrlTooLong",
      "msg": "Endpoint URL too long"
    },
    {
      "code": 6003,
      "name": "protocolFeeBelowMinimum",
      "msg": "Protocol fee below minimum"
    },
    {
      "code": 6004,
      "name": "totalFeesExceed100Percent",
      "msg": "Total fees exceed 100%"
    },
    {
      "code": 6005,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6006,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6007,
      "name": "agentAlreadyInactive",
      "msg": "Agent is already inactive"
    }
  ],
  "types": [
    {
      "name": "agentCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "endpointUrl",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "agentDeactivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "agentMetadata",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "shareMint",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "githubHandle",
            "type": "string"
          },
          {
            "name": "endpointUrl",
            "type": "string"
          },
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "endpointUrl",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "factoryInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "protocolTreasury",
            "type": "pubkey"
          },
          {
            "name": "minProtocolFeeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "factoryState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "protocolTreasury",
            "type": "pubkey"
          },
          {
            "name": "minProtocolFeeBps",
            "type": "u16"
          },
          {
            "name": "agentCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
