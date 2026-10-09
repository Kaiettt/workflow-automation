workflowversion.definition
{
  "edges": [
    {
      "id": "xy-edge__triggerNode-1790495263533-actionNode-1790495266935",
      "source": "triggerNode-1790495263533",
      "target": "actionNode-1790495266935",
      "sourceHandle": "bottom-source",
      "targetHandle": "top-target"
    },
    {
      "id": "xy-edge__actionNode-1790495266935-actionNode-1790495268781",
      "source": "actionNode-1790495266935",
      "target": "actionNode-1790495268781",
      "sourceHandle": "bottom-source",
      "targetHandle": "top-target"
    },
    {
      "id": "xy-edge__actionNode-1790495268781-actionNode-1790495269694",
      "source": "actionNode-1790495268781",
      "target": "actionNode-1790495269694",
      "sourceHandle": "bottom-source",
      "targetHandle": "top-target"
    }
  ],
  "nodes": [
    {
      "id": "triggerNode-1790495263533",
      "data": {
        "key": "trigger.manual",
        "name": "Manual Trigger",
        "config": {}
      },
      "type": "triggerNode",
      "measured": {
        "width": 192,
        "height": 76
      },
      "position": {
        "x": 546,
        "y": 236
      },
      "selected": false
    },
    {
      "id": "actionNode-1790495266935",
      "data": {
        "key": "integration.google_sheet.readRows",
        "name": "Read Google Sheet Rows",
        "config": {
          "sheet_name": "hehe",
          "credential_id": "google-credential",
          "spreadsheet_id": "1aC2Q3MwjJVF-R1C8nJM8Zb6GpJI2n_5oxuWF7XMRum4"
        }
      },
      "type": "actionNode",
      "measured": {
        "width": 192,
        "height": 76
      },
      "position": {
        "x": 632.069303449066,
        "y": 469.5238237281682
      },
      "selected": true
    },
    {
      "id": "actionNode-1790495268781",
      "data": {
        "key": "logic.filter",
        "name": "Filter",
        "config": {
          "field": "status",
          "value": "new",
          "operator": "equals"
        }
      },
      "type": "actionNode",
      "dragging": false,
      "measured": {
        "width": 192,
        "height": 76
      },
      "position": {
        "x": 657.6466738480163,
        "y": 672.8524107063836
      },
      "selected": false
    },
    {
      "id": "actionNode-1790495269694",
      "data": {
        "key": "integration.gmail.send",
        "name": "Send Gmail",
        "config": {
          "body": "hehe",
          "subject": "hehe",
          "credential_id": "google-credential"
        }
      },
      "type": "actionNode",
      "measured": {
        "width": 192,
        "height": 76
      },
      "position": {
        "x": 828.6449886189259,
        "y": 972.98385193299
      },
      "selected": false
    }
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}



conector_credential

google sheet

id: ff7407f8-348b-4a39-a053-9d72418d63c4
connector_id: 22222222-2222-2222-2222-222222222221
owner_id: 11111111-1111-1111-1111-111111111111
name: Google Account
encrypted_secret: 840383f007854743c6a46df6:1d63f739c33ba9defda458b4e4ab4dda:bb93d732506a0a3a1abbebeee9ccbb3dcb103f464e7cf953e33eca26a5cb02fd4a90c2e8d75f57417fb171e59f644f3437afe13f31303386457fdb8d34cc5c0b894e62c7b6c1c03409e6c08cb89d47841fd0907c32782bae565c6f165b4538534ed968f1ebed34e9081e86d1d7f0eea357761512dc78a0e7a58e9bca83509be30acbfe11dbc2b820b1158218601b6444310530f776ac7109b38d972de003607ae77278361991ef11ad40c2c4bb0832bba870e2852911fb2f150b99608b7243a0110241fb01d40531ad60f58f84fed84cd15f275eef7365b05dcc072558f931c21ffb73b9bf67e3b7cca2c7895c17c73af61aab9edb3c252057190b92ed7e1de070bea6c6c07657608496178d46de3f352b70ba0bcd2238532acf8a45dd348099cdff8eecaa9e38dfad8a1b1b41a23978a7fb512ea520c05dadd6689657216e49d08b2c92aacfd980b44c3a2daa79b0ba9f7b583fd55353e76ac310e494237d9d6e6b740bad139cc9458c06f2eb8d6274fabb744dad1fd748fcb0f5af525d691e33c11db3e6eeac81fa86cf7c4f8a1073ee2f7250e85df99fdd728759e8c96697da9881edbcd01bdedc4bb11a1d9117ac0f6aaf22bca1b4c3c280bdb1c0e7b048d40c66a176cfcd82dd3c451e88a0476f3e7eae07fd136399cc126dcbff29bc3766f1a3058a536b751d9215664a88656c38012b51e4a2a30a56e8db5423edef60c5f11481ba731f90c3662887d0a2d48c367f147b4e0d712cb32a2134e9421fdb0205947cf26aba28aef4f199141d104ef74adb6e33b56d557f09a783c03b123c58636333ff6ca2edcd
last_tested_at: NULL
last_test_status: UNTESTED
created_at: 2026-09-27 14:53:13.273 +0700
updated_at: 2026-09-27 14:53:13.273 +0700
``

gmail

id: 6cd3fe6e-3a46-42ac-84b9-8addb004d1e6
connector_id: 22222222-2222-2222-2222-222222222221
owner_id: 11111111-1111-1111-1111-111111111111
name: Google Account
encrypted_secret: 03ce2b2d659159149ef53dae:7b585f814f285ba0036afd29b57a38dd:b71697c15e1a25643a0f38cc4adce06af44df0a073b324e8f95562372e49d064c8a96360e5c91b02e42d903363ac3429b3a667e5bcd7102399609cefef96d4589357e9b859510fe7664ed9a0a590c0b925223b5b427298a2336c9b9c896d708aa6a674f96f3d8ddb355ea8cf02fd5101db9a6e341e4e7578ff256e095031a6bad30f2700cb5581a8834b3d712f8aa3a9572bb42256048cfaaf7a09ee10cfe0b08576ae86bbf9864340a1d1a3ac9e077e0f2dadc841f2f9630127231f518ecde37f7b1738d2275cc9d116b6cdd5457a26697080e4c7bce73c9d09e8ab42255bbf102180086429a68a00085c06dfd9090951dc8116fd2d2ee614f6d82803914ad216ab6795d8d48a6687062d482513b3ef2fbdb8b373dcce1bff8adfe9a893c8ec3489e9a0e59b592db40b78971a02971e1512cb4744a1aa9ec2ffc761c4ec25bd78909ef2fe9f8a5889650a773edcb0b3882c0211d3d4a35117bdb1f140844b82fe6d8967b3e42729e6149947a584c4d3dc75c0147f19be7d245d6ba72d765fa96635e1fe90d3a508737b7f408d1f7318c03ff859ab8549b22ea1dd511da2f2180206e4e60f249695507d3fb96db4674210dcee61f0a797b56d7a58376d3e256f37aa21bf060eed01c9c0ccbbdc8f43880d3af39af92bb3b25de2997c46a2928cca961f9bb097075b4877c8928a7b6f1b2c4019b688dbf73d75f926dce070a188d8ec1b914c3fbb649298da04ad5487a4076d656095efbcdd7bcc554c01c7e08a5071aa6e64acea0983a03db516c14c0d38a10868f40b0b3c30f73f5be9a336adf8bc5a36701def364f
last_tested_at: NULL
last_test_status: UNTESTED
created_at: 2026-09-27 14:53:40.215 +0700
updated_at: 2026-09-27 14:53:40.215 +0700
``