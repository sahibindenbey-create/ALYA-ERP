import React from 'react';
import Ahbrd1301ReceptTemplateOriginal from './Ahbrd1301ReceptTemplate';
import GercekUretimPanelFinal from '../components/GercekUretimPanelFinal';

// AHBRD ekranında global axios patch yapılmaz.
// Gerçek üretim paneli ayrı ve kontrollü bir endpoint üzerinden çalışır.
export default function Ahbrd1301ReceptTemplateV2(props) {
  return (
    <>
      <Ahbrd1301ReceptTemplateOriginal {...props} />
      <GercekUretimPanelFinal />
    </>
  );
}
