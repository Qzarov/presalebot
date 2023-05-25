import TonWeb from 'tonweb'
import tonMnemonic from 'tonweb-mnemonic'
import dotenv from 'dotenv'

dotenv.config()

const TRANS_LIMIT = process.env.TRANS_LIMIT;

const tonweb = new TonWeb(new TonWeb.HttpProvider(process.env.TON_API_PROVIDER,
    {apiKey: process.env.TON_API_KEY}));

const {NftItem, NftCollection} = TonWeb.token.nft;

export async function checkTransaction(w_sender, w_receiver, coins, callback) {
    const exclude_by_utime = [1684920409] //метки времени, по которым мы исключаем транзакции, их может быть несколько. Она должна передаваться в аргументы функции

    const nano_coins = coins * 1000000000;
    let is_found = false;

    try {
        const res = await tonweb.provider.getTransactions(w_receiver, TRANS_LIMIT)
        for (let i = 0; i < TRANS_LIMIT; i++) {
            if (res[i]?.hasOwnProperty('in_msg')) {
                const in_msg = res[i]['in_msg'];
                const trans_source = in_msg['source'];
                if (trans_source.length !== 48) //иногда при поиске в истории попадаются адреса "". Мы проверяем длину на 48. Если не 48 идем дальше
                    continue

                const trans_value = Number(in_msg['value']);

                const trans_source_str_format = new tonweb.utils.Address(trans_source).toString(true, true, true, true)
                const w_sender_str_format = new tonweb.utils.Address(w_sender).toString(true, true, true, true)

                if (trans_source_str_format === w_sender_str_format && trans_value === nano_coins) {
                    let excluded_by_ts = false //проверка на использованные транзакции

                    for (let j = 0; j < exclude_by_utime.length; j++)
                        if (res[i]['utime']===exclude_by_utime[j]) {
                            excluded_by_ts = true
                            break
                        }

                    if (excluded_by_ts===false) {
                        is_found = true
                        const utime = res[i]['utime'] //будем сохранять метку времени как идентификатор транзакции
                        callback(is_found)
                        return
                    }
                }
            }
        }
    } catch (err) {
        console.log("error occurred: ", err)
    }
    callback(is_found)
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
    console.log("params: ", params)

    console.log(
        await wallet.methods.transfer(params).send().catch(e => console.log(e))
    );
}

export async function get_collection_nfts(collection_address) {
    const nft_collection = new NftCollection(tonweb.provider, {address: collection_address});
    const nft_collection_data = await nft_collection.getCollectionData();
    const next_item_index = nft_collection_data['nextItemIndex'];

    let nfts = [];
    for (let i = 0; i < next_item_index; i++) {
        try {
        const nft_addr = await nft_collection.getNftItemAddressByIndex(i)
        const nft_addr_friendly = new tonweb.utils.Address(nft_addr).toString(true, true, true, true)
        // TODO get owner address
        // const nft = await new NftItem(tonweb.provider, {address: nft_addr})
        // const nft_data = await nft.getData();
        // const owner_addr = new tonweb.utils.Address(nft_data['ownerAddress']).toString(true, true, true, true);
        // console.log("owner_addr: ", owner_addr)

        // TODO get nft's tier from metadata

        const nft = {
            id: i,
            address: nft_addr_friendly,
            tier: 'common',
            // owner_address: nft_owner_friendly,
        }
        console.log("nft: ", nft);
        nfts.push(nft);
        } catch (err) {
            console.log("error occurred: ", err)
        }
    }

    return nfts
}