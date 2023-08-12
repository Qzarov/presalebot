import sqlite3 from 'sqlite3'
sqlite3.verbose()

export class Database {
    constructor() {
        this.db = new sqlite3.Database('./data/presale.db',(err) => {
            if (err) {
                console.log('Could not connect to database', err)
            } else {
                console.log('Connected to database')
            }
        });

        this.createTables();
    }

    createTables() {
        const qry = `CREATE TABLE IF NOT EXISTS USERS(id_user INTEGER PRIMARY KEY, username TEXT, wallet TEXT)`;
        this.db.run(qry, [], (err) => {
            if (err) return console.error(err.message);
        });

        const qry1 = `CREATE TABLE IF NOT EXISTS NFTS(id_nft INTEGER PRIMARY KEY, contract TEXT, rarity TEXT, owner_id INTEGER, owner_wallet TEXT)`;
        this.db.run(qry1, [], (err) => {
            if (err) return console.error(err.message);
        });

        const qry2 = `CREATE TABLE IF NOT EXISTS TRANSACTIONS(timestamp INTEGER PRIMARY KEY, nft_addr TEXT, owner_wallet TEXT)`;
        this.db.run(qry2, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

    /*
    *   User
    */

    addUser(id_user, username, callback) {
        this.userExists(id_user, (exists) => {
            let is_user_new = false;
            if (!exists) {
                is_user_new = true;
                const qry = `INSERT INTO USERS(id_user,username) VALUES(${id_user},"${username}")`;
                this.db.run(qry, [], (err) => {
                    callback(is_user_new, err);
                });
            }
            callback(is_user_new)
        });
    }

    getUserById(id_user, callback) {
        const qry = `SELECT * FROM USERS WHERE id_user=${id_user};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            callback(results);
        });
    }

    getUserByUsername(username, callback) {
        const qry = `SELECT * FROM USERS WHERE username=${username};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            callback(results);
        });
    }

    userExists(id_user, callback) {
        const qry = `SELECT * FROM USERS WHERE id_user=${id_user};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            if (results.length) {
                callback(true);
            } else {
                callback(false)
            }
        });
    }

    userHasWallet(id_user, callback) {
        const qry = `SELECT wallet FROM USERS WHERE id_user=${id_user};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);

            const wallet = results[0]['wallet'];

            if (wallet !== null) {
                callback(true, wallet);
            } else {
                callback(false);
            }
        });
    }

    setUserWallet(id_user, wallet) {
        const qry = `UPDATE USERS SET wallet='${wallet}' WHERE id_user=${id_user};`;
        this.db.run(qry, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

    /*
    *   NFT
    */
    addNft(id, address, tier, callback) {
        const qry = `INSERT INTO NFTS(id_nft,contract,rarity) VALUES(${id},"${address}","${tier}")`;
        console.log("qry: ", qry)
        this.db.run(qry, [], (err) => {
            callback(err);
        });
    }

    setNftOwner(id_nft, owner_id, owner_wallet) {
        const qry = `UPDATE NFTS SET owner_id=${owner_id} WHERE id_nft=${id_nft};`;
        this.db.run(qry, [], (err) => {
            if (err) return console.error(err.message);
        });

        const qry1 = `UPDATE NFTS SET owner_wallet="${owner_wallet}" WHERE id_nft=${id_nft};`;
        this.db.run(qry1, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

    getNotOwnedNfts(callback) {
        const qry = `SELECT * FROM NFTS`;
        this.db.all(qry, [], (err, rows) => {
            if (err) return console.error(err.message);
            let nfts = {
                common: [],
                rare: []
            }
            // console.log(`get ${rows.length} Not Owned Nfts`)
            rows.forEach((row) => {
                if (row.owner_id === null) {
                    if (row.rarity === `common`) {
                        nfts.common.push(row)
                    } else {
                        nfts.rare.push(row)
                    }
                }
            });
            callback(nfts);
        });
    }

    /*
    *   Transaction
    */

    addTransaction(timestamp, nft_addr, callback) {
        const qry = `INSERT INTO TRANSACTIONS(timestamp,nft_addr) VALUES(${timestamp},"${nft_addr}")`;
        console.log("qry: ", qry)
        this.db.run(qry, [], (err) => {
            callback(err);
        });
    }

    is_transaction_in_db(timestamp, callback) {
        const qry = `SELECT * FROM TRANSACTIONS WHERE timestamp=${timestamp};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            if (results.length) {
                callback(true);
            } else {
                callback(false)
            }
        });
    }

    async getAllTimestamps() {
        const db = this.db
        return new Promise (function(resolve, reject) {
            let ts_list = []
            const qry = `SELECT timestamp FROM TRANSACTIONS;`;
            db.all(qry, [], (err, results) => {
                if (err) reject(err.message);
                let db_list = []
                for (let i = 0; i < results.length; i++) {
                    // console.log(`push ${results[i]["timestamp"]}`)
                    db_list.push(results[i]["timestamp"])
                }
                ts_list = db_list
                resolve(ts_list)
            });
        });
    }
}