const sqlite3 = require('sqlite3').verbose();

class Database {

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

        const qry1 = `CREATE TABLE IF NOT EXISTS NFTS(id_nft INTEGER PRIMARY KEY AUTOINCREMENT, contract TEXT, tier INTEGER, owner_id INTEGER, owner_wallet TEXT)`;
        this.db.run(qry1, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

    add_user(id_user, username, callback) {
        // TODO check if user is already in db
        const qry = `INSERT INTO USERS(id_user,username) VALUES(${id_user},"${username}")`;
        this.db.run(qry, [], (err) => {
            callback(err);
        });
    }

    get_user_by_id(id_user, callback) {
        const qry = `SELECT * FROM USERS WHERE id_user=${id_user};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            callback(results);
        });
    }

    get_user_by_username(username, callback) {
        const qry = `SELECT * FROM USERS WHERE username=${username};`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            callback(results);
        });
    }
    add_user_wallet(id_user, wallet) {
        const qry = `UPDATE USERS SET wallet='${wallet}' WHERE id_user=${id_user};`;
        this.db.run(qry, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

    add_nft(contract, tier, callback) {
        const qry = `INSERT INTO NFTS(contract,tier) VALUES("${contract}",${tier})`;
        this.db.run(qry, [], (err) => {
            callback(err);
        });
    }

    set_nft_owner(id_nft, owner_id, owner_wallet) {
        const qry = `UPDATE NFTS SET owner_id=${owner_id} AND owner_wallet='${owner_wallet}' WHERE id_nft=${id_nft};`;
        this.db.run(qry, [], (err) => {
            if (err) return console.error(err.message);
        });
    }

    get_not_owned_nfts(callback) {
        const qry = `SELECT * FROM NFTS WHERE owner_id=NULL;`;
        this.db.all(qry, [], (err, results) => {
            if (err) return console.error(err.message);
            callback(results);
        });
    }

}