// bordroHesapla.js
// Türkiye brüt->net bordro hesaplama motoru.
// Parametreler koda gömülü değildir; BordroParametreleri tablosundan okunur,
// böylece yeni yıl / mevzuat değişikliğinde kod değiştirmeden güncellenebilir.
//
// ÖNEMLİ: Bu modül genel/standart SGK+Gelir Vergisi+Damga Vergisi mantığını uygular.
// Teşvikler (5510/81, genç/kadın/engelli istihdam teşvikleri vb.), özel kesintiler
// (icra, BES, sendika aidatı vb.) veya ücret dışı ek ödemelerin (yemek/yol istisnası)
// vergi muafiyet detayları dahil edilmemiştir. Gerçek bordro üretiminde mali
// müşavirinizin onayından geçirilmesi önerilir.

async function getBordroParametreleri(pool, sql, yil) {
  const result = await pool.request()
    .input('Yil', sql.Int, yil)
    .query('SELECT * FROM BordroParametreleri WHERE Yil = @Yil');
  if (result.recordset.length === 0) {
    throw new Error(`${yil} yılı için BordroParametreleri kaydı bulunamadı. Lütfen önce parametreleri tanımlayın.`);
  }
  return result.recordset[0];
}

/**
 * Verilen kümülatif matrah üzerinden, brüt gelir vergisi matrahı kadar ek gelire
 * uygulanacak gelir vergisini artan oranlı dilim mantığıyla hesaplar.
 * @param {number} kumulatifMatrahOncesi - Bu aydan ÖNCEKİ, yıl başından beri biriken matrah
 * @param {number} buAyMatrah - Bu ayki (istisna sonrası) matrah
 * @param {object} p - BordroParametreleri satırı
 */
function gelirVergisiHesapla(kumulatifMatrahOncesi, buAyMatrah, p) {
  const dilimler = [
    { ust: Number(p.GV_Dilim1_Ust), oran: Number(p.GV_Oran1) },
    { ust: Number(p.GV_Dilim2_Ust), oran: Number(p.GV_Oran2) },
    { ust: Number(p.GV_Dilim3_Ust), oran: Number(p.GV_Oran3) },
    { ust: Number(p.GV_Dilim4_Ust), oran: Number(p.GV_Oran4) },
    { ust: Infinity, oran: Number(p.GV_Oran5) },
  ];

  let kalan = buAyMatrah;
  let baslangic = kumulatifMatrahOncesi;
  let toplamVergi = 0;

  for (const dilim of dilimler) {
    if (kalan <= 0) break;
    if (baslangic >= dilim.ust) continue; // bu dilim zaten geçilmiş

    const buDilimdeKalanKapasite = dilim.ust - baslangic;
    const buDilimeDusenTutar = Math.min(kalan, buDilimdeKalanKapasite);

    toplamVergi += buDilimeDusenTutar * dilim.oran;
    kalan -= buDilimeDusenTutar;
    baslangic += buDilimeDusenTutar;
  }

  return Math.round(toplamVergi * 100) / 100;
}

/**
 * Brüt maaştan net maaşa tam bordro hesabı.
 * @param {object} params
 *   brutMaas: number - aylık brüt maaş (tam ay için)
 *   gunSayisi: number - çalışılan gün sayısı (30 = tam ay)
 *   prim: number - ek prim/ikramiye (SGK ve vergiye tabi, brüte eklenir)
 *   kumulatifMatrahOncesi: number - yıl başından bu aya kadar (bu ay hariç) biriken GV matrahı
 *   parametreler: BordroParametreleri satırı
 */
function bordroHesapla({ brutMaas, gunSayisi = 30, prim = 0, kumulatifMatrahOncesi = 0, parametreler }) {
  const p = parametreler;
  const oranli = gunSayisi < 30 ? (Number(brutMaas) * gunSayisi) / 30 : Number(brutMaas);
  const brutToplam = Math.round((oranli + Number(prim || 0)) * 100) / 100;

  // --- SGK primine esas kazanç (taban/tavan sınırlaması) ---
  const sgkTaban = Number(p.SgkTabanAylik) * (gunSayisi / 30);
  const sgkTavan = Number(p.SgkTavanAylik);
  const sgkMatrahi = Math.min(Math.max(brutToplam, sgkTaban), sgkTavan);

  const sgkIsciPrimi = Math.round(sgkMatrahi * Number(p.SgkIsciOrani) * 100) / 100;
  const issizlikIsciPrimi = Math.round(sgkMatrahi * Number(p.IssizlikIsciOrani) * 100) / 100;

  const isverenSgkPrimi = Math.round(sgkMatrahi * Number(p.SgkIsverenOrani) * 100) / 100;
  const isverenIssizlikPrimi = Math.round(sgkMatrahi * Number(p.IssizlikIsverenOrani) * 100) / 100;

  // --- Gelir vergisi matrahı ---
  const gvMatrahiIstisnasiz = Math.round((brutToplam - sgkIsciPrimi - issizlikIsciPrimi) * 100) / 100;

  // Asgari ücret istisnası: brüt asgari ücretin (kısmi çalışmada oranlanmış) SGK+işsizlik
  // düşülmüş haline denk gelen kısım gelir vergisinden muaf.
  const asgariUcretOranli = Number(p.AsgariUcretBrutAylik) * (gunSayisi / 30);
  const asgariSgkIsci = Math.round(Math.min(Math.max(asgariUcretOranli, sgkTaban), sgkTavan) * Number(p.SgkIsciOrani) * 100) / 100;
  const asgariIssizlikIsci = Math.round(Math.min(Math.max(asgariUcretOranli, sgkTaban), sgkTavan) * Number(p.IssizlikIsciOrani) * 100) / 100;
  const gelirVergisiIstisnasi = Math.round((asgariUcretOranli - asgariSgkIsci - asgariIssizlikIsci) * 100) / 100;

  const gvMatrahi = Math.max(0, Math.round((gvMatrahiIstisnasiz - gelirVergisiIstisnasi) * 100) / 100);

  const gelirVergisi = gelirVergisiHesapla(kumulatifMatrahOncesi, gvMatrahi, p);

  // --- Damga vergisi ---
  const damgaVergisiOrani = Number(p.DamgaVergisiBinde) / 1000;
  const damgaVergisiIstisnasi = Math.round(asgariUcretOranli * damgaVergisiOrani * 100) / 100;
  const damgaVergisiIstisnasiz = Math.round(brutToplam * damgaVergisiOrani * 100) / 100;
  const damgaVergisi = Math.max(0, Math.round((damgaVergisiIstisnasiz - damgaVergisiIstisnasi) * 100) / 100);

  // --- Net maaş ---
  const toplamKesinti = Math.round((sgkIsciPrimi + issizlikIsciPrimi + gelirVergisi + damgaVergisi) * 100) / 100;
  const netMaas = Math.round((brutToplam - toplamKesinti) * 100) / 100;

  // --- İşverene maliyet ---
  const isverenMaliyeti = Math.round((brutToplam + isverenSgkPrimi + isverenIssizlikPrimi) * 100) / 100;

  return {
    brutMaas: brutToplam,
    gunSayisi,
    sgkMatrahi,
    sgkIsciPrimi,
    issizlikIsciPrimi,
    gelirVergisiMatrahi: gvMatrahi,
    gelirVergisiIstisnasi,
    gelirVergisi,
    damgaVergisiIstisnasi,
    damgaVergisi,
    toplamKesinti,
    netMaas,
    isverenSgkPrimi,
    isverenIssizlikPrimi,
    isverenMaliyeti,
    kumulatifMatrahSonrasi: Math.round((kumulatifMatrahOncesi + gvMatrahi) * 100) / 100,
  };
}

/**
 * Bir personelin belirli bir yıl için, verilen aydan ÖNCEKİ ayların kümülatif
 * gelir vergisi matrahını PersonelMaas kayıtlarından toplar.
 */
async function kumulatifMatrahGetir(pool, sql, personelId, donemYil, donemAy) {
  const result = await pool.request()
    .input('PersonelId', sql.Int, personelId)
    .input('DonemYil', sql.Int, donemYil)
    .input('DonemAy', sql.Int, donemAy)
    .query(`
      SELECT ISNULL(SUM(GelirVergisiMatrahi), 0) AS Toplam
      FROM PersonelMaas
      WHERE PersonelId = @PersonelId AND DonemYil = @DonemYil AND DonemAy < @DonemAy
    `);
  return Number(result.recordset[0].Toplam || 0);
}

/**
 * Kıdem yılına göre yasal yıllık ücretli izin hakkı (İş Kanunu m.53).
 * 1-5 yıl (5 dahil değil): 14 gün
 * 5-15 yıl (5 dahil, 15 dahil değil): 20 gün
 * 15+ yıl: 26 gün
 * 1 yıldan az: hak yok (0)
 */
function yillikIzinHakki(kidemYili) {
  if (kidemYili < 1) return 0;
  if (kidemYili < 5) return 14;
  if (kidemYili < 15) return 20;
  return 26;
}

module.exports = {
  getBordroParametreleri,
  gelirVergisiHesapla,
  bordroHesapla,
  kumulatifMatrahGetir,
  yillikIzinHakki,
};
