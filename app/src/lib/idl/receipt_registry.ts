// Auto-generated from IDL
export type ReceiptRegistry = {
  "accounts": [
    {
      "discriminator": [
        182,
        153,
        181,
        190,
        176,
        28,
        68,
        221
      ],
      "name": "JobReceipt"
    },
    {
      "discriminator": [
        29,
        34,
        224,
        195,
        175,
        183,
        99,
        97
      ],
      "name": "RegistryState"
    }
  ],
  "address": "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9",
  "errors": [
    {
      "code": 6000,
      "msg": "Unauthorized",
      "name": "Unauthorized"
    },
    {
      "code": 6001,
      "msg": "Challenge window expired",
      "name": "ChallengeWindowExpired"
    },
    {
      "code": 6002,
      "msg": "Challenge window still active",
      "name": "ChallengeWindowActive"
    },
    {
      "code": 6003,
      "msg": "Job is not active",
      "name": "JobNotActive"
    },
    {
      "code": 6004,
      "msg": "Job is not challenged",
      "name": "JobNotChallenged"
    },
    {
      "code": 6005,
      "msg": "Arithmetic overflow",
      "name": "ArithmeticOverflow"
    },
    {
      "code": 6006,
      "msg": "Receipt already verified",
      "name": "AlreadyVerified"
    }
  ],
  "events": [
    {
      "discriminator": [
        203,
        112,
        90,
        24,
        19,
        50,
        66,
        108
      ],
      "name": "JobChallenged"
    },
    {
      "discriminator": [
        208,
        205,
        49,
        160,
        98,
        139,
        192,
        217
      ],
      "name": "JobFinalized"
    },
    {
      "discriminator": [
        173,
        56,
        68,
        8,
        221,
        71,
        217,
        54
      ],
      "name": "JobRecorded"
    },
    {
      "discriminator": [
        132,
        52,
        43,
        42,
        170,
        148,
        136,
        196
      ],
      "name": "JobResolved"
    },
    {
      "discriminator": [
        178,
        229,
        102,
        47,
        105,
        251,
        235,
        226
      ],
      "name": "JobSignerUpdated"
    },
    {
      "discriminator": [
        189,
        58,
        109,
        214,
        74,
        78,
        181,
        8
      ],
      "name": "ReceiptVerified"
    },
    {
      "discriminator": [
        144,
        138,
        62,
        105,
        58,
        38,
        100,
        177
      ],
      "name": "RegistryInitialized"
    }
  ],
  "instructions": [
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "challenger",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_reason_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ],
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
      "name": "challenge_job"
    },
    {
      "accounts": [
        {
          "name": "registry_state"
        },
        {
          "name": "job_receipt",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "finalize_job"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
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
          },
          "writable": true
        },
        {
          "name": "vault"
        },
        {
          "name": "protocol_authority"
        },
        {
          "name": "operator",
          "signer": true,
          "writable": true
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "challenge_window",
          "type": "i64"
        }
      ],
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
      "name": "initialize_registry"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
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
                "path": "registry_state"
              },
              {
                "account": "RegistryState",
                "kind": "account",
                "path": "registry_state.job_counter"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "signer",
          "signer": true,
          "writable": true
        },
        {
          "name": "client"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "artifact_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payment_amount",
          "type": "u64"
        },
        {
          "name": "payment_tx",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ],
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
      "name": "record_job"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "resolve_against_agent"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "resolve_for_agent"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "new_signer",
          "type": "pubkey"
        }
      ],
      "discriminator": [
        10,
        220,
        31,
        215,
        124,
        99,
        222,
        23
      ],
      "name": "set_job_signer"
    },
    {
      "accounts": [
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "client",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "verify_receipt"
    }
  ],
  "metadata": {
    "description": "Immutable job log with challenge windows",
    "name": "receipt_registry",
    "spec": "0.1.0",
    "version": "0.1.0"
  },
  "types": [
    {
      "name": "JobChallenged",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "challenged_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobFinalized",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "finalized_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobReceipt",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "artifact_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payment_amount",
            "type": "u64"
          },
          {
            "name": "payment_tx",
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
                "name": "JobStatus"
              }
            }
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "challenged_at",
            "type": "i64"
          },
          {
            "name": "resolved_at",
            "type": "i64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "client_verified",
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
      "name": "JobRecorded",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "payment_amount",
            "type": "u64"
          },
          {
            "name": "created_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobResolved",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "JobStatus"
              }
            }
          },
          {
            "name": "resolved_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobSignerUpdated",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "old_signer",
            "type": "pubkey"
          },
          {
            "name": "new_signer",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Active"
          },
          {
            "name": "Finalized"
          },
          {
            "name": "Challenged"
          },
          {
            "name": "Resolved"
          },
          {
            "name": "Rejected"
          }
        ]
      }
    },
    {
      "name": "ReceiptVerified",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "verified_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "RegistryInitialized",
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
            "name": "protocol_authority",
            "type": "pubkey"
          },
          {
            "name": "challenge_window",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "RegistryState",
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
            "name": "protocol_authority",
            "type": "pubkey"
          },
          {
            "name": "job_signer",
            "type": "pubkey"
          },
          {
            "name": "job_counter",
            "type": "u64"
          },
          {
            "name": "challenge_window",
            "type": "i64"
          },
          {
            "name": "total_challenged",
            "type": "u64"
          },
          {
            "name": "total_resolved_against",
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

export const IDL: ReceiptRegistry = {
  "accounts": [
    {
      "discriminator": [
        182,
        153,
        181,
        190,
        176,
        28,
        68,
        221
      ],
      "name": "JobReceipt"
    },
    {
      "discriminator": [
        29,
        34,
        224,
        195,
        175,
        183,
        99,
        97
      ],
      "name": "RegistryState"
    }
  ],
  "address": "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9",
  "errors": [
    {
      "code": 6000,
      "msg": "Unauthorized",
      "name": "Unauthorized"
    },
    {
      "code": 6001,
      "msg": "Challenge window expired",
      "name": "ChallengeWindowExpired"
    },
    {
      "code": 6002,
      "msg": "Challenge window still active",
      "name": "ChallengeWindowActive"
    },
    {
      "code": 6003,
      "msg": "Job is not active",
      "name": "JobNotActive"
    },
    {
      "code": 6004,
      "msg": "Job is not challenged",
      "name": "JobNotChallenged"
    },
    {
      "code": 6005,
      "msg": "Arithmetic overflow",
      "name": "ArithmeticOverflow"
    },
    {
      "code": 6006,
      "msg": "Receipt already verified",
      "name": "AlreadyVerified"
    }
  ],
  "events": [
    {
      "discriminator": [
        203,
        112,
        90,
        24,
        19,
        50,
        66,
        108
      ],
      "name": "JobChallenged"
    },
    {
      "discriminator": [
        208,
        205,
        49,
        160,
        98,
        139,
        192,
        217
      ],
      "name": "JobFinalized"
    },
    {
      "discriminator": [
        173,
        56,
        68,
        8,
        221,
        71,
        217,
        54
      ],
      "name": "JobRecorded"
    },
    {
      "discriminator": [
        132,
        52,
        43,
        42,
        170,
        148,
        136,
        196
      ],
      "name": "JobResolved"
    },
    {
      "discriminator": [
        178,
        229,
        102,
        47,
        105,
        251,
        235,
        226
      ],
      "name": "JobSignerUpdated"
    },
    {
      "discriminator": [
        189,
        58,
        109,
        214,
        74,
        78,
        181,
        8
      ],
      "name": "ReceiptVerified"
    },
    {
      "discriminator": [
        144,
        138,
        62,
        105,
        58,
        38,
        100,
        177
      ],
      "name": "RegistryInitialized"
    }
  ],
  "instructions": [
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "challenger",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_reason_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ],
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
      "name": "challenge_job"
    },
    {
      "accounts": [
        {
          "name": "registry_state"
        },
        {
          "name": "job_receipt",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "finalize_job"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
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
          },
          "writable": true
        },
        {
          "name": "vault"
        },
        {
          "name": "protocol_authority"
        },
        {
          "name": "operator",
          "signer": true,
          "writable": true
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "challenge_window",
          "type": "i64"
        }
      ],
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
      "name": "initialize_registry"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
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
                "path": "registry_state"
              },
              {
                "account": "RegistryState",
                "kind": "account",
                "path": "registry_state.job_counter"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "signer",
          "signer": true,
          "writable": true
        },
        {
          "name": "client"
        },
        {
          "address": "11111111111111111111111111111111",
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "artifact_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "payment_amount",
          "type": "u64"
        },
        {
          "name": "payment_tx",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ],
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
      "name": "record_job"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "resolve_against_agent"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "resolve_for_agent"
    },
    {
      "accounts": [
        {
          "name": "registry_state",
          "writable": true
        },
        {
          "name": "operator",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "new_signer",
          "type": "pubkey"
        }
      ],
      "discriminator": [
        10,
        220,
        31,
        215,
        124,
        99,
        222,
        23
      ],
      "name": "set_job_signer"
    },
    {
      "accounts": [
        {
          "name": "job_receipt",
          "writable": true
        },
        {
          "name": "client",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "_job_id",
          "type": "u64"
        }
      ],
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
      "name": "verify_receipt"
    }
  ],
  "metadata": {
    "description": "Immutable job log with challenge windows",
    "name": "receipt_registry",
    "spec": "0.1.0",
    "version": "0.1.0"
  },
  "types": [
    {
      "name": "JobChallenged",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "challenged_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobFinalized",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "finalized_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobReceipt",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "artifact_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payment_amount",
            "type": "u64"
          },
          {
            "name": "payment_tx",
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
                "name": "JobStatus"
              }
            }
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "challenged_at",
            "type": "i64"
          },
          {
            "name": "resolved_at",
            "type": "i64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "client_verified",
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
      "name": "JobRecorded",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "payment_amount",
            "type": "u64"
          },
          {
            "name": "created_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobResolved",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "JobStatus"
              }
            }
          },
          {
            "name": "resolved_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobSignerUpdated",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "old_signer",
            "type": "pubkey"
          },
          {
            "name": "new_signer",
            "type": "pubkey"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "JobStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Active"
          },
          {
            "name": "Finalized"
          },
          {
            "name": "Challenged"
          },
          {
            "name": "Resolved"
          },
          {
            "name": "Rejected"
          }
        ]
      }
    },
    {
      "name": "ReceiptVerified",
      "type": {
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "job_id",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "verified_at",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "RegistryInitialized",
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
            "name": "protocol_authority",
            "type": "pubkey"
          },
          {
            "name": "challenge_window",
            "type": "i64"
          }
        ],
        "kind": "struct"
      }
    },
    {
      "name": "RegistryState",
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
            "name": "protocol_authority",
            "type": "pubkey"
          },
          {
            "name": "job_signer",
            "type": "pubkey"
          },
          {
            "name": "job_counter",
            "type": "u64"
          },
          {
            "name": "challenge_window",
            "type": "i64"
          },
          {
            "name": "total_challenged",
            "type": "u64"
          },
          {
            "name": "total_resolved_against",
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
