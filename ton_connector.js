import TonWeb from 'tonweb'
import tonMnemonic from 'tonweb-mnemonic'
import dotenv from 'dotenv'

dotenv.config()

const TRANS_LIMIT = process.env.TRANS_LIMIT;

const tonweb = new TonWeb(new TonWeb.HttpProvider(process.env.TON_API_PROVIDER,
    {apiKey: process.env.TON_API_KEY}));

// let wallet_owner = process.env.OWNER_ADDR
const {NftItem} = TonWeb.token.nft;

export async function checkTransaction(w_sender, w_receiver, coins, callback) {
    const nano_coins = coins * 1000000000;
    let is_found = false;

    try {
        const res = await tonweb.provider.getTransactions(w_receiver, TRANS_LIMIT)
        for (let i = 0; i < TRANS_LIMIT; i++) {
            if (res[i]?.hasOwnProperty('in_msg')) {
                const in_msg = res[i]['in_msg'];
                const trans_source = in_msg['source'];
                const trans_value = Number(in_msg['value']);

                if (trans_source === w_sender && trans_value === nano_coins) {
                    is_found = true
                    callback(is_found)
                    return
                }
            }
        }
    } catch (err) {
        console.log("error occurred: ", err)
    }
    callback(is_found)
}

export async function sendNft(send_to_addr, nft_addr) {
    // const nftAddress = new TonWeb.utils.Address("EQBZa9sIC8415a2HGYSzI-OBt1o3ImdcoO8J5DUUAgIHu44d"); //NFT адрес
    // const transferTo = new TonWeb.utils.Address("kQDWrh9egBTpNqmY8HOOho5xocMt5r8udUHmFn4LWSOVB50D"); //Куда отправляем NFT?
    if (!isAddrValid(send_to_addr)) {
        console.log("error: send_to_addr not valid");
        return;
    }
    console.log("send_to_addr valid")

    if (!isAddrValid(nft_addr)) {
        console.log("error: nft_addr not valid");
        return;
    }
    console.log("nft_addr valid")

    const mnemonic_list = process.env.MNEMONIK.split(',')
    const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic_list);
    const wallet = new tonweb.wallet.all.v3R2(tonweb.provider, {publicKey: keyPair.publicKey});
    const seqno = await wallet.methods.seqno().call();

    const amount = TonWeb.utils.toNano('0.1');

    let nftItem = new NftItem(tonweb.provider, {address: nft_addr})

    console.log("nft: ", nftItem)
    console.log("new owner: ", send_to_addr)

    console.log(
        await wallet.methods.transfer({
            secretKey: keyPair.secretKey,
            toAddress: await nft_addr,
            amount: amount,
            seqno: seqno,
            payload: await nftItem.createTransferBody({
                newOwnerAddress: send_to_addr,
                forwardAmount: TonWeb.utils.toNano('0.1'),
                forwardPayload: new TextEncoder().encode('presale'),
                responseAddress: send_to_addr
            }),
        }).send().catch(e => console.log(e))
    );
}

function isAddrValid(addr) {
    return addr.length === 48;
}