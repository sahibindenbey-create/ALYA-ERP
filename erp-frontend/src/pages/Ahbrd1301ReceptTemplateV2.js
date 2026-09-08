import React from 'react';
import Ahbrd1301ReceptTemplateOriginal from './Ahbrd1301ReceptTemplate';

// AHBRD ekranı yalnızca özel reçete şablonunu gösterir.
// Gerçek üretim paneli ReceteYonetimPage içindeki tek ortak panelden yönetilir.
// Böylece aynı üretim formunun iki kez görünmesi ve aynı üretimin iki ayrı
// UI tarafından tetiklenmesi engellenir.
export default function Ahbrd1301ReceptTemplateV2(props) {
  return <Ahbrd1301ReceptTemplateOriginal {...props} />;
}
