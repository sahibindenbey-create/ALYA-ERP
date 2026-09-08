import React from 'react';
import ReceteYonetimPageV3 from './ReceteYonetimPageV3';
import Ahbrd1301ReceptTemplate from './Ahbrd1301ReceptTemplateV2';
import ReceteGercekUretimPanel from '../components/ReceteGercekUretimPanel';

export default function ReceteYonetimPage(){
  const [version,setVersion]=React.useState(0);
  const [receteler,setReceteler]=React.useState([]);

  React.useEffect(()=>{
    let alive=true;
    fetch('http://localhost:5000/api/recete-yonetim')
      .then(r=>r.ok?r.json():[])
      .then(data=>{if(alive)setReceteler(data||[]);})
      .catch(()=>{});
    return()=>{alive=false;};
  },[version]);

  return <div style={{position:'relative'}} key={version}>
    <ReceteYonetimPageV3 />
    <ReceteGercekUretimPanel receteler={receteler} />
    <div style={{position:'fixed',right:24,bottom:24,zIndex:2000}}>
      <Ahbrd1301ReceptTemplate onDone={()=>setVersion(v=>v+1)} />
    </div>
  </div>;
}
