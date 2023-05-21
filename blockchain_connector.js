async function f() {
    const TonWeb = require('tonweb');
    const tonMnemonic = require('tonweb-mnemonic');

// -------------------- init ---------------------

    const tonweb = new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC',
        {apiKey: '875beb9a2bd59171e73b6ee32740e65b5f64d2b119f0d41e19b1f9310d65fe01'}));

    const keyPair = await tonMnemonic.mnemonicToKeyPair(['chalk', 'neutral', 'odor', 'rapid', 'mail', 'rapid', 'sadness', 'can', 'profit', 'claim', 'acid', 'rapid', 'claim', 'noble', 'acid', 'sadness', 'finish', 'neutral', 'soul', 'light', 'bargain', 'skate', 'chalk', 'skate']);

    const wallet = new tonweb.wallet.all.v3R2(tonweb.provider, {publicKey: keyPair.publicKey});

    const seqno = await wallet.methods.seqno().call();

    let wallet_owner = "EQDekYi5CYsar7DGCv5pP0AhZaNNO9j8w9XrICEavrKrjJBZ"

// -------------------- 1. Check transaction-login --------------------
    let found = false

    let wallet_to_find = "kQDWrh9egBTpNqmY8HOOho5xocMt5r8udUHmFn4LWSOVB50D"

    let res = await tonweb.provider.getTransactions(wallet_owner)

    for (let i=0; i<20; i++)
    {
        if (res[i].hasOwnProperty('in_msg'))
        {
            if (res[i]['in_msg'].hasOwnProperty('source') && res[i]['in_msg'].hasOwnProperty('value'))
            {
                let trans_in_addr = res[i]['in_msg']['source']
                let trans_count = res[i]['in_msg']['value']

                if (trans_in_addr.length === 48) {
                    let address_1 = new tonweb.utils.Address(trans_in_addr).toString(true,true,true,true)
                    let address_2 = new tonweb.utils.Address(wallet_to_find).toString(true,true,true,true)


                    if (address_1 === address_2 && trans_count === "30000000") {
                        console.log("find", i)
                        found = true
                    }
                }
            }
        }

    }


}

f();