// src/data/constants.js

export const MUSTERI_TURLERI = [
  "Tüzel Kişi", 
  "Gerçek Kişi"
];

export const CARI_TIPLERI = [
  { id: "ALICI", label: "Alıcı" },
  { id: "SATICI", label: "Satıcı" },
  { id: "ADAY", label: "Aday Müşteri" }
];

// Senin VBA kodundan gelen segment yapısı
export const SEGMENTLER = [
  "Küçük", 
  "Orta", 
  "Büyük", 
  "AVM", 
  "Zincir"
];

export const VERGI_DAIRESI_LISTESI = [
  "Boğaziçi Vergi Dairesi",
  "Marmara Kurumlar Vergi Dairesi",
  "Zincirlikuyu Vergi Dairesi",
  "Beyoğlu Vergi Dairesi",
  "Ankara Kurumlar Vergi Dairesi",
  // Bu liste taxOffices.js içinde daha detaylı olduğu için 
  // formda genellikle orayı kullanıyoruz.
];