// Auto-generated from IDL
export type AgentFactory = {
  "accounts": [
    {
      "discriminator": [
        106,
        95,
        194,
        10,
        53,
        133,
        159,
        163
      ],
      "name": "AgentMetadata"
    },
    {
      "discriminator": [
        91,
        157,
        184,
        99,
        123,
        112,
        102,
        7
      ],
      "name": "FactoryState"
    }
  ],
  "address": "7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j",
  "errors": [
    {
      "code": 6000,
      "msg": "Name too long",
      "name": "NameTooLong"
    },
    {
      "code": 6001,
      "msg": "GitHub handle too long",
      "name": "GitHubHandleTooLong"
    },
    {
      "code": 6002,
      "msg": "Endpoint URL too long",
      "name": "EndpointUrlTooLong"
    },
    {
      "code": 6003,
      "msg": "Protocol fee below minimum",
      "name": "ProtocolFeeBelowMinimum"
    },
    {
      "code": 6004,
      "msg": "Total fees exceed 100%",
      "name": "TotalFeesExceed100Percent"
    },
    {
      "code": 6005,
      "msg": "Arithmetic overflow",
      "name": "ArithmeticOverflow"
    },
    {
      "code": 6006,
      "msg": "Unauthorized",
      "name": "Unauthorized"
    },
    {
      "code": 6007,
      "msg": "Agent is already inactive",
      "name": "AgentAlreadyInactive"
    }
  ],
  "events": [
    {
      "discriminator": [
        237,
        44,
        61,
        111,
        90,
        251,
        241,
        34
      ],
      "name": "AgentCreated"
    },
    {
      "discriminator": [
        138,
        251,
        82,
        87,
        119,
        148,
        20,
        180
      ],
      "name": "AgentDeactivated"
    },
    {
      "discriminator": [
        210,
        179,
        162,
        250,
        123,
        250,
        210,
        166
      ],
      "name": "AgentUpdated"
    },
    {
      "discriminator": [
        20,
        86,
        103,
        75,
        20,
        220,
        162,
        63
      ],
      "name": "FactoryInitialized"
    }
  ],
  "instructions": [
    {
      "accounts": [
        {
          "name": "factory_state",
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
          },
          "writable": true
        },
        {
          "name": "agent_metadata",
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
                "path": "factory_state"
              },
              {
                "account": "FactoryState",
                "kind": "account",
                "path": "factory_state.agent_count"
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
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "share_mint",
          "writable": true
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "vault_usdc_account",
          "writable": true
        },
        {
          "name": "protocol_treasury"
        },
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "address": "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS",
          "name": "vault_program"
        },
        {
          "address": "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9",
          "name": "registry_program"
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
          "name": "name",
          "type": "string"
        },
        {
          "name": "github_handle",
          "type": "string"
        },
        {
          "name": "endpoint_url",
          "type": "string"
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
          "name": "challenge_window",
          "type": "i64"
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
          "name": "job_signer",
          "type": {
            "option": "pubkey"
          }
        }
      ],
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
      "name": "create_agent"
    },
    {
      "accounts": [
        {
          "name": "agent_metadata",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [],
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
      "name": "deactivate_agent"
    },
    {
      "accounts": [
        {
          "name": "factory_state",
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
          },
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "writable": true
        },
        {
          "name": "protocol_treasury"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "min_protocol_fee_bps",
          "type": "u16"
        }
      ],
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
      "name": "initialize_factory"
    },
    {
      "accounts": [
        {
          "name": "agent_metadata",
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
          "name": "github_handle",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "endpoint_url",
          "type": {
            "option": "string"
          }
        }
      ],
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
      "name": "update_agent"
    }
  ],
  "metadata": {
    "description": "One-instruction agent deployment factory",
    "name": "agent_factory",
    "spec": "0.1.0",
    "version": "0.1.0"
  },
  "types": [
    {
      "name": "AgentCreated",
      "type": {
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "agent_id",
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
            "name": "endpoint_url",
            "type": "string"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "AgentDeactivated",
      "type": {
        "fields": [
          {
            "name": "agent_id",
            "type": "u64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "AgentMetadata",
      "type": {
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
            "name": "share_mint",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "github_handle",
            "type": "string"
          },
          {
            "name": "endpoint_url",
            "type": "string"
          },
          {
            "name": "agent_id",
            "type": "u64"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "is_active",
            "type": "bool"
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
      "name": "AgentUpdated",
      "type": {
        "fields": [
          {
            "name": "agent_id",
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
            "name": "endpoint_url",
            "type": "string"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "FactoryInitialized",
      "type": {
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "protocol_treasury",
            "type": "pubkey"
          },
          {
            "name": "min_protocol_fee_bps",
            "type": "u16"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "FactoryState",
      "type": {
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "protocol_treasury",
            "type": "pubkey"
          },
          {
            "name": "min_protocol_fee_bps",
            "type": "u16"
          },
          {
            "name": "agent_count",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ],
        "kind": "struct"
      }
    }
  ]
};

export const IDL: AgentFactory = {
  "accounts": [
    {
      "discriminator": [
        106,
        95,
        194,
        10,
        53,
        133,
        159,
        163
      ],
      "name": "AgentMetadata"
    },
    {
      "discriminator": [
        91,
        157,
        184,
        99,
        123,
        112,
        102,
        7
      ],
      "name": "FactoryState"
    }
  ],
  "address": "7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j",
  "errors": [
    {
      "code": 6000,
      "msg": "Name too long",
      "name": "NameTooLong"
    },
    {
      "code": 6001,
      "msg": "GitHub handle too long",
      "name": "GitHubHandleTooLong"
    },
    {
      "code": 6002,
      "msg": "Endpoint URL too long",
      "name": "EndpointUrlTooLong"
    },
    {
      "code": 6003,
      "msg": "Protocol fee below minimum",
      "name": "ProtocolFeeBelowMinimum"
    },
    {
      "code": 6004,
      "msg": "Total fees exceed 100%",
      "name": "TotalFeesExceed100Percent"
    },
    {
      "code": 6005,
      "msg": "Arithmetic overflow",
      "name": "ArithmeticOverflow"
    },
    {
      "code": 6006,
      "msg": "Unauthorized",
      "name": "Unauthorized"
    },
    {
      "code": 6007,
      "msg": "Agent is already inactive",
      "name": "AgentAlreadyInactive"
    }
  ],
  "events": [
    {
      "discriminator": [
        237,
        44,
        61,
        111,
        90,
        251,
        241,
        34
      ],
      "name": "AgentCreated"
    },
    {
      "discriminator": [
        138,
        251,
        82,
        87,
        119,
        148,
        20,
        180
      ],
      "name": "AgentDeactivated"
    },
    {
      "discriminator": [
        210,
        179,
        162,
        250,
        123,
        250,
        210,
        166
      ],
      "name": "AgentUpdated"
    },
    {
      "discriminator": [
        20,
        86,
        103,
        75,
        20,
        220,
        162,
        63
      ],
      "name": "FactoryInitialized"
    }
  ],
  "instructions": [
    {
      "accounts": [
        {
          "name": "factory_state",
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
          },
          "writable": true
        },
        {
          "name": "agent_metadata",
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
                "path": "factory_state"
              },
              {
                "account": "FactoryState",
                "kind": "account",
                "path": "factory_state.agent_count"
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
          "name": "vault_state",
          "writable": true
        },
        {
          "name": "share_mint",
          "writable": true
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "vault_usdc_account",
          "writable": true
        },
        {
          "name": "protocol_treasury"
        },
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "address": "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS",
          "name": "vault_program"
        },
        {
          "address": "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9",
          "name": "registry_program"
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
          "name": "name",
          "type": "string"
        },
        {
          "name": "github_handle",
          "type": "string"
        },
        {
          "name": "endpoint_url",
          "type": "string"
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
          "name": "challenge_window",
          "type": "i64"
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
          "name": "job_signer",
          "type": {
            "option": "pubkey"
          }
        }
      ],
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
      "name": "create_agent"
    },
    {
      "accounts": [
        {
          "name": "agent_metadata",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [],
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
      "name": "deactivate_agent"
    },
    {
      "accounts": [
        {
          "name": "factory_state",
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
          },
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "writable": true
        },
        {
          "name": "protocol_treasury"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "min_protocol_fee_bps",
          "type": "u16"
        }
      ],
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
      "name": "initialize_factory"
    },
    {
      "accounts": [
        {
          "name": "agent_metadata",
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
          "name": "github_handle",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "endpoint_url",
          "type": {
            "option": "string"
          }
        }
      ],
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
      "name": "update_agent"
    }
  ],
  "metadata": {
    "description": "One-instruction agent deployment factory",
    "name": "agent_factory",
    "spec": "0.1.0",
    "version": "0.1.0"
  },
  "types": [
    {
      "name": "AgentCreated",
      "type": {
        "fields": [
          {
            "name": "factory",
            "type": "pubkey"
          },
          {
            "name": "agent_id",
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
            "name": "endpoint_url",
            "type": "string"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "AgentDeactivated",
      "type": {
        "fields": [
          {
            "name": "agent_id",
            "type": "u64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "AgentMetadata",
      "type": {
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
            "name": "share_mint",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "github_handle",
            "type": "string"
          },
          {
            "name": "endpoint_url",
            "type": "string"
          },
          {
            "name": "agent_id",
            "type": "u64"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "is_active",
            "type": "bool"
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
      "name": "AgentUpdated",
      "type": {
        "fields": [
          {
            "name": "agent_id",
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
            "name": "endpoint_url",
            "type": "string"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "FactoryInitialized",
      "type": {
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "protocol_treasury",
            "type": "pubkey"
          },
          {
            "name": "min_protocol_fee_bps",
            "type": "u16"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "FactoryState",
      "type": {
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "protocol_treasury",
            "type": "pubkey"
          },
          {
            "name": "min_protocol_fee_bps",
            "type": "u16"
          },
          {
            "name": "agent_count",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ],
        "kind": "struct"
      }
    }
  ]
};
