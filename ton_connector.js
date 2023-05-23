import TonWeb from 'tonweb'
import tonMnemonic from 'tonweb-mnemonic'
import dotenv from 'dotenv'
dotenv.config()

const TRANS_LIMIT = process.env.TRANS_LIMIT;

const tonweb = new TonWeb(new TonWeb.HttpProvider(process.env.TON_API_PROVIDER,
    {apiKey: process.env.TON_API_KEY}));

const mnemonic_list = process.env.MNEMONIK.split(',')
const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic_list);
const wallet = new tonweb.wallet.all.v3R2(tonweb.provider, {publicKey: keyPair.publicKey});
const seqno = await wallet.methods.seqno().call();
let wallet_owner = process.env.OWNER_ADDR
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