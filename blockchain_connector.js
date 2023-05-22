async function f() {
// -------------------- Инициализация всего ---------------------
    const TonWeb = require('tonweb');
    const tonMnemonic = require('tonweb-mnemonic');

    const tonweb = new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC',
        {apiKey: '875beb9a2bd59171e73b6ee32740e65b5f64d2b119f0d41e19b1f9310d65fe01'}));

    const keyPair = await tonMnemonic.mnemonicToKeyPair(['chalk', 'neutral', 'odor', 'rapid', 'mail', 'rapid', 'sadness', 'can', 'profit', 'claim', 'acid', 'rapid', 'claim', 'noble', 'acid', 'sadness', 'finish', 'neutral', 'soul', 'light', 'bargain', 'skate', 'chalk', 'skate']);

    const wallet = new tonweb.wallet.all.v3R2(tonweb.provider, {publicKey: keyPair.publicKey});

    const seqno = await wallet.methods.seqno().call();

    let wallet_owner = "EQDekYi5CYsar7DGCv5pP0AhZaNNO9j8w9XrICEavrKrjJBZ" //Владелец NFT коллекции

    const {NftItem} = TonWeb.token.nft;

// -------------------- 1. Проверка перевода определенной суммы --------------------

    let found = false //в конце этого раздела значение переменной говорит, совершен ли был перевод или нет

    let wallet_to_find = "kQDWrh9egBTpNqmY8HOOho5xocMt5r8udUHmFn4LWSOVB50D" //кошелек, который хотим проверить, перевел ли он или нет
    let sum_nano = "30000000" // 30000000==0.03 TON. Сумма, которую надо проверить на перевод

    let res = await tonweb.provider.getTransactions(wallet_owner, 100)

    for (let i=0; i<100; i++)
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


                    if (address_1 === address_2 && trans_count === sum_nano) {
                        console.log("find", i)
                        found = true
                    }
                }
            }
        }

    }

// -------------------- 2. Отправка NFT --------------------
    const nftAddress = new TonWeb.utils.Address("EQBZa9sIC8415a2HGYSzI-OBt1o3ImdcoO8J5DUUAgIHu44d"); //NFT адрес
    const transferTo = new TonWeb.utils.Address("kQDWrh9egBTpNqmY8HOOho5xocMt5r8udUHmFn4LWSOVB50D"); //Куда отправляем NFT?

    const amount = TonWeb.utils.toNano('0.1');

    let nftItem = new NftItem(tonweb.provider, {address: nftAddress})

    console.log(
        await wallet.methods.transfer({
            secretKey: keyPair.secretKey,
            toAddress: await nftAddress,
            amount: amount,
            seqno: seqno,
            payload: await nftItem.createTransferBody({
                newOwnerAddress: transferTo,
                forwardAmount: TonWeb.utils.toNano('0.1'),
                forwardPayload: new TextEncoder().encode('presale'),
                responseAddress: transferTo
            }),
        }).send().catch(e => console.log(e))
    );

}

f();

/*Проверить работоспособность кода можно так:

// -------------------- Инициализация всего ---------------------
....
....

// -------------------- 1. Проверка перевода определенной суммы --------------------
.....
.....

// -------------------- 2. Отправка NFT --------------------
// ...
// ...
// ...

Или так

// -------------------- Инициализация всего ---------------------
....
....

// -------------------- 1. Проверка перевода определенной суммы --------------------
// ...
// ...
// ...

// -------------------- 2. Отправка NFT --------------------
....
....



То есть комментим полностью блок 1 или 2 и смотрим что происходит

Пункта 1. хватит как для проверки привязки коешлька (0.03 TON) так и для проверки покупки NFT (10, 50 TON)

 */