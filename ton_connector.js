import TonWeb from 'tonweb'
import tonMnemonic from 'tonweb-mnemonic'
import dotenv from 'dotenv'

dotenv.config()

const TRANS_LIMIT = process.env.TRANS_LIMIT;

const tonweb = new TonWeb(new TonWeb.HttpProvider(process.env.TON_API_PROVIDER,
    {apiKey: process.env.TON_API_KEY}));

const {NftItem, NftCollection} = TonWeb.token.nft;

export async function checkTransaction(w_sender, w_receiver, coins, exclude_by_utime, callback) {
    // TODO add exclude time savin' & checkin'
    // const exclude_by_utime = [1684920409, 1684923645] // Метки времени, по которым мы исключаем транзакции, их может быть несколько. Она должна передаваться в аргументы функции

    const nano_coins = coins * 1000000000;
    let is_found = false;
    let utime = 0

    try {
        const res = await tonweb.provider.getTransactions(w_receiver, TRANS_LIMIT)
        for (let i = 0; i < TRANS_LIMIT; i++) {
            if (res[i]?.hasOwnProperty('in_msg')) {
                const in_msg = res[i]['in_msg'];
                const trans_source = in_msg['source'];
                if (trans_source.length !== 48) // Иногда при поиске в истории попадаются адреса "". Мы проверяем длину на 48. Если не 48 идем дальше
                    continue

                const trans_value = Number(in_msg['value']);
                // console.log(`Comparing ${trans_source} and ${w_sender}, coins: ${trans_value} and ${nano_coins}`)
                if (compare_two_addresses(trans_source, w_sender) && trans_value === nano_coins) {
                    let excluded_by_ts = false // Проверка на использованные транзакции

                    for (let j = 0; j < exclude_by_utime.length; j++)
                        if (res[i]['utime']===exclude_by_utime[j]) {
                            excluded_by_ts = true
                            break
                        }

                    if (excluded_by_ts === false) {
                        is_found = true
                        utime = res[i]['utime'] // Сохраняем метку времени как идентификатор транзакции
                        console.log(`Transaction ${nano_coins} nanoTON from wallet ${w_sender} found!`)
                        break
                    }
                }
            }
        }
    } catch (err) {
        console.log("error occurred: ", err)
    }
    console.log(`Check transaction: ${is_found}, ${utime}`)
    callback(is_found, utime)
}

export async function sendNft(send_to_addr, nft_addr) {
    const nft_address = new TonWeb.utils.Address(nft_addr); //NFT адрес
    const transfer_to_address = new TonWeb.utils.Address(send_to_addr); //Куда отправляем NFT?
    const my_address = new TonWeb.utils.Address(process.env.OWNER_ADDR);

    const mnemonic_list = process.env.MNEMONIK.split(',')
    const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic_list);
    const wallet = new tonweb.wallet.all.v3R2(tonweb.provider, {publicKey: keyPair.publicKey});
    const seqno = await wallet.methods.seqno().call();

    const amount = TonWeb.utils.toNano('0.5');

    let nftItem = new NftItem(tonweb.provider, {address: nft_address})

    const params = {
        secretKey: keyPair.secretKey,
        toAddress: await nft_address,
        amount: amount,
        seqno: seqno,
        payload: await nftItem.createTransferBody({
            newOwnerAddress: transfer_to_address,
            forwardAmount: TonWeb.utils.toNano('0.01'),
            forwardPayload: new TextEncoder().encode('presale'),
            responseAddress: my_address
        }),
    }
    // console.log("params: ", params)

    console.log(
        await wallet.methods.transfer(params).send().catch(e => console.log(e))
    );
}

export async function get_collection_nfts(collection_address) {
    const nftCollection = new NftCollection(tonweb.provider, {address: collection_address});
    const nft_collection_data = await nftCollection.getCollectionData();
    const next_item_index = nft_collection_data['nextItemIndex'];

    let nfts = [];
    for (let i = 0; i < next_item_index; i++) {
        try {
            const nftAddr = await nftCollection.getNftItemAddressByIndex(i)
            const nftAddrFriendly = new tonweb.utils.Address(nftAddr).toString(true, true, true, true)
            const nftItem = await new NftItem(tonweb.provider, {address: nftAddr})
            const content = await nftCollection.getNftItemContent(nftItem);
            const contentUri = content.contentUri
            await fetch(contentUri, {method: "GET"})
                .then(async (response) => {
                    const nftMeta = await response.json()
                    const nft = {
                        id: i,
                        address: nftAddrFriendly,
                        rarity: nftMeta["rarity"],
                        // owner_address: nft_owner_friendly,
                    }
                    console.log("nft:", nft);
                    nfts.push(nft);
                })
                .catch(error => console.log(error))
        } catch (err) {
            console.log("error occurred: ", err)
        }
    }

    return nfts
}

function compare_two_addresses(address1, address2) {
    return to_our_format(address1)===to_our_format(address2)
}

function to_our_format(address) {
    return new tonweb.utils.Address(address).toString(true, true, true, true)
}