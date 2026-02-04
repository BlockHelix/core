/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/receipt_registry.json`.
 */
export type ReceiptRegistry = {
  "address": "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9",
  "metadata": {
    "name": "receiptRegistry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Immutable job log with challenge windows"
  },
  "instructions": [
    {
      "name": "challengeJob",
      "discriminator": [
        28,
        73,
        26,
        36,
        93,
        69,
        213,
        253
      ],
      "accounts": [
        {
          "name": "registryState",
          "writable": true
        },
        {
          "name": "jobReceipt",
          "writable": true
        },
        {
          "name": "challenger",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "reasonHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "finalizeJob",
      "discriminator": [
        141,
        52,
        35,
        150,
        40,
        6,
        140,
        27
      ],
      "accounts": [
        {
          "name": "registryState"
        },
        {
          "name": "jobReceipt",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeRegistry",
      "discriminator": [
        189,
        181,
        20,
        17,
        174,
        57,
        249,
        59
      ],
      "accounts": [
        {
          "name": "registryState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "vault"
        },
        {
          "name": "protocolAuthority"
        },
        {
          "name": "agentWallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "challengeWindow",
          "type": "i64"
        }
      ]
    },
    {
      "name": "recordJob",
      "discriminator": [
        54,
        124,
        168,
        158,
        236,
        237,
        107,
        206
      ],
      "accounts": [
        {
          "name": "registryState",
          "writable": true
        },
        {
          "name": "jobReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "registryState"
              },
              {
                "kind": "account",
                "path": "registry_state.job_counter",
                "account": "registryState"
              }
            ]
          }
        },
        {
          "name": "agentWallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "client"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "artifactHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "paymentAmount",
          "type": "u64"
        },
        {
          "name": "paymentTx",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "resolveAgainstAgent",
      "discriminator": [
        16,
        177,
        176,
        172,
        55,
        92,
        21,
        154
      ],
      "accounts": [
        {
          "name": "registryState",
          "writable": true
        },
        {
          "name": "jobReceipt",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveForAgent",
      "discriminator": [
        19,
        102,
        229,
        126,
        46,
        161,
        133,
        171
      ],
      "accounts": [
        {
          "name": "registryState",
          "writable": true
        },
        {
          "name": "jobReceipt",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "verifyReceipt",
      "discriminator": [
        202,
        144,
        21,
        149,
        181,
        189,
        23,
        170
      ],
      "accounts": [
        {
          "name": "jobReceipt",
          "writable": true
        },
        {
          "name": "client",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "jobReceipt",
      "discriminator": [
        182,
        153,
        181,
        190,
        176,
        28,
        68,
        221
      ]
    },
    {
      "name": "registryState",
      "discriminator": [
        29,
        34,
        224,
        195,
        175,
        183,
        99,
        97
      ]
    }
  ],
  "events": [
    {
      "name": "jobChallenged",
      "discriminator": [
        203,
        112,
        90,
        24,
        19,
        50,
        66,
        108
      ]
    },
    {
      "name": "jobFinalized",
      "discriminator": [
        208,
        205,
        49,
        160,
        98,
        139,
        192,
        217
      ]
    },
    {
      "name": "jobRecorded",
      "discriminator": [
        173,
        56,
        68,
        8,
        221,
        71,
        217,
        54
      ]
    },
    {
      "name": "jobResolved",
      "discriminator": [
        132,
        52,
        43,
        42,
        170,
        148,
        136,
        196
      ]
    },
    {
      "name": "receiptVerified",
      "discriminator": [
        189,
        58,
        109,
        214,
        74,
        78,
        181,
        8
      ]
    },
    {
      "name": "registryInitialized",
      "discriminator": [
        144,
        138,
        62,
        105,
        58,
        38,
        100,
        177
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "challengeWindowExpired",
      "msg": "Challenge window expired"
    },
    {
      "code": 6002,
      "name": "challengeWindowActive",
      "msg": "Challenge window still active"
    },
    {
      "code": 6003,
      "name": "jobNotActive",
      "msg": "Job is not active"
    },
    {
      "code": 6004,
      "name": "jobNotChallenged",
      "msg": "Job is not challenged"
    },
    {
      "code": 6005,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6006,
      "name": "alreadyVerified",
      "msg": "Receipt already verified"
    }
  ],
  "types": [
    {
      "name": "jobChallenged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "challengedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "jobFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "finalizedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "jobReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "artifactHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "paymentAmount",
            "type": "u64"
          },
          {
            "name": "paymentTx",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "jobStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "challengedAt",
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "clientVerified",
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
      "name": "jobRecorded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "paymentAmount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "jobResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "jobStatus"
              }
            }
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "jobStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "finalized"
          },
          {
            "name": "challenged"
          },
          {
            "name": "resolved"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "receiptVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "verifiedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "registryInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "agentWallet",
            "type": "pubkey"
          },
          {
            "name": "protocolAuthority",
            "type": "pubkey"
          },
          {
            "name": "challengeWindow",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "registryState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "agentWallet",
            "type": "pubkey"
          },
          {
            "name": "protocolAuthority",
            "type": "pubkey"
          },
          {
            "name": "jobCounter",
            "type": "u64"
          },
          {
            "name": "challengeWindow",
            "type": "i64"
          },
          {
            "name": "totalChallenged",
            "type": "u64"
          },
          {
            "name": "totalResolvedAgainst",
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
