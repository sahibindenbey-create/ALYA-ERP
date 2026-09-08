import React from 'react';
import Ahbrd1301ReceptTemplateOriginal from './Ahbrd1301ReceptTemplate';

// Gerçek üretim paneli ReceteYonetimPage içindeki ortak panelden yönetilir.
// AHBRD özel şablonunun içinde ikinci bir üretim paneli gösterilmez.
export default function Ahbrd1301ReceptTemplateV2(props) {
  return <Ahbrd1301ReceptTemplateOriginal {...props} />;
}
