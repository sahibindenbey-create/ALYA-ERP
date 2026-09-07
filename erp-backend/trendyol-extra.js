const registerTrendyolExtra = ({ app, poolPromise, sql }) => {

  console.log('>>> TRENDYOL EXTRA REGISTER BAŞLADI');

  app.get('/api/platformlar/trendyol/extra/durum', (req, res) => {
    console.log('>>> TRENDYOL EXTRA ENDPOINT ÇAĞRILDI');

    res.status(200).json({
      success: true,
      module: 'Trendyol Extra',
      message: 'Trendyol Extra çalışıyor'
    });
  });

  console.log('>>> TRENDYOL EXTRA ROUTE EKLENDİ');
};

module.exports = registerTrendyolExtra;