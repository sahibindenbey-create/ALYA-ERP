const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_OPTIONS_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_OPTIONS_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('SQL Server bağlantısı başarılı!');
    return pool;
  })
  .catch(err => {
    console.error('SQL Server bağlantı hatası:', err.message);
    throw err;
  });

module.exports = {
  sql,
  poolPromise
};