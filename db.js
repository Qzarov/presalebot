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

        const qry1 = `CREATE TABLE IF NOT EXISTS NFTS(id_nft INTEGER PRIMARY KEY, contract TEXT, tier TEXT, owner_id INTEGER, owner_wallet TEXT)`;
        this.db.run(qry1, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

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

    addNft(id, address, tier, callback) {
        const qry = `INSERT INTO NFTS(id_nft,contract,tier) VALUES(${id},"${address}","${tier}")`;
        console.log("qry: ", qry)
        this.db.run(qry, [], (err) => {
            callback(err);
        });
    }

    async setNftOwner(id_nft, owner_id, owner_wallet) {
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
            rows.forEach((row) => {
                if (row.owner_id === null) {
                    if (row.tier === `common`) {
                        nfts.common.push(row)
                    } else {
                        nfts.rare.push(row)
                    }
                }
            });
            callback(nfts);
        });
    }

}