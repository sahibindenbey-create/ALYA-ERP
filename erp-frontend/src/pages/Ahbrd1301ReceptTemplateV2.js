import React from 'react';
import Ahbrd1301ReceptTemplateOriginal from './Ahbrd1301ReceptTemplate';

// ÖNEMLİ: axios global olarak patch edilmez.
// Bu bileşen yalnızca AHBRD reçete şablonunu görüntüler.
// Ürün verisi kullanan ana reçete ekranı kendi endpoint'ini doğrudan çağırır.
export default function Ahbrd1301ReceptTemplateV2(props) {
  return <Ahbrd1301ReceptTemplateOriginal {...props} />;
}
