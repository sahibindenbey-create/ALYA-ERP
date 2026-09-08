import React from 'react';
import ReceteYonetimPageV3 from './ReceteYonetimPageV3';
import Ahbrd1301ReceptTemplate from './Ahbrd1301ReceptTemplateV2';

export default function ReceteYonetimPage(){
  const [version,setVersion]=React.useState(0);
  return <div style={{position:'relative'}} key={version}>
    <ReceteYonetimPageV3 />
    <div style={{position:'fixed',right:24,bottom:24,zIndex:2000}}>
      <Ahbrd1301ReceptTemplate onDone={()=>setVersion(v=>v+1)} />
    </div>
  </div>;
}
