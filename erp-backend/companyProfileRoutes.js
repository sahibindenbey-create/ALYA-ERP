const { sql } = require('./db');

function install({ app, poolPromise }) {
  app.get('/api/company-profile', async (req, res) => {
    try {
      const companyId = Number(req.headers['x-company-id'] ?? req.query?.CompanyId ?? 1);
      if (!Number.isInteger(companyId) || companyId <= 0) {
        return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
      }

      const pool = await poolPromise;
      const result = await pool.request()
        .input('CompanyId', sql.Int, companyId)
        .query(`
          SELECT TOP 1
            CompanyId,
            CompanyName,
            CompanyCode,
            FirmaTipi,
            SiparisSablonu,
            StokTakipTipi,
            VarsayilanBirim,
            ProfilAktif
          FROM dbo.Sirketler
          WHERE CompanyId = @CompanyId AND IsActive = 1;
        `);

      if (!result.recordset.length) {
        return res.status(404).json({ success: false, error: 'Şirket bulunamadı' });
      }

      res.json({ success: true, profile: result.recordset[0] });
    } catch (err) {
      console.error('Company profile hatası:', err);
      res.status(500).json({ success: false, error: 'Şirket profili alınamadı', detail: err.message });
    }
  });
}

module.exports = { install };
