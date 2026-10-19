import React from 'react';

/* Original lightweight care illustrations. No third-party images or trademarks. */
function Person({ x, y, scale = 1, outfit = '#007950', skin = '#cc895c', hair = '#28372a', pose = 'stand', skirt = false }) {
  return <g transform={'translate('+x+' '+y+') scale('+scale+')'}>
    <ellipse cx="0" cy="92" rx="22" ry="5" fill="rgba(34,56,36,.12)" />
    {pose === 'sit' ? <>
      <path d="M-16 55h34l-3 13-30 2Z" fill={outfit}/>
      <path d="M-9 68 23 74M-9 69 -19 85" stroke="#354b45" strokeWidth="11" strokeLinecap="round"/>
      <path d="M-22 89h19M18 81h17" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
    </> : <>
      {skirt?<path d="M-15 52h30l12 25h-54Z" fill={outfit}/>:<rect x="-15" y="44" width="30" height="31" rx="8" fill={outfit}/>}
      <path d="M-8 73 -11 89M8 73 12 89" stroke="#395154" strokeWidth="9" strokeLinecap="round"/>
      <path d="M-16 90h13M8 90h15" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
    </>}
    <path d="M-12 49 -25 62M11 49 24 64" stroke={outfit} strokeWidth="10" strokeLinecap="round"/>
    <path d="M-25 62 -31 67M24 64 29 68" stroke={skin} strokeWidth="7" strokeLinecap="round"/>
    <rect x="-4" y="33" width="8" height="16" rx="4" fill={skin}/>
    <ellipse cx="0" cy="19" rx="16" ry="21" fill={skin}/>
    <path d="M-17 18C-19 -12 10 -17 18 13 10 8 2 3-6 7c-3 7-6 10-11 11Z" fill={hair}/>
    <circle cx="-6" cy="23" r="1.2" fill="#3c2f29"/><circle cx="6" cy="23" r="1.2" fill="#3c2f29"/>
    <path d="M-4 31q4 4 8 0" stroke="#6b4a38" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
  </g>;
}
function House({ fill = '#c4e9c6' }) {
  return <g opacity=".85"><path d="M18 95V49l45-32 46 32v46Z" fill={fill} />
    <path d="M11 51 63 12l52 39" fill="none" stroke="#508b6e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="44" y="61" width="25" height="34" rx="4" fill="#f9f4c8"/><circle cx="63" cy="79" r="2" fill="#a5a47b"/>
    <rect x="81" y="54" width="15" height="17" rx="3" fill="#effaf8"/>
  </g>;
}
function Chair() {return <g><path d="M88 60v26h35" stroke="#5d9e88" strokeWidth="7" strokeLinecap="round" fill="none"/><path d="M102 82v20m24-22 11 19" stroke="#315e4e" strokeWidth="5" strokeLinecap="round"/><circle cx="136" cy="100" r="11" stroke="#315e4e" strokeWidth="5" fill="none"/></g>;}
export default function CareCategoryArtwork({ type }) {
  return <svg className="sewak-category-svg" viewBox="0 0 190 125" width="190" height="125" aria-hidden="true" focusable="false">
    <ellipse cx="96" cy="110" rx="84" ry="9" fill="rgba(34,61,32,.11)" />
    {type === 'children' && <>
      <circle cx="152" cy="34" r="28" fill="#ffdbb7" />
      <Person x={68} y={17} scale={.91} outfit="#00764b" skin="#b7754e" hair="#342a23" skirt />
      <Person x={123} y={58} scale={.48} outfit="#df7c64" skin="#d7a16d" hair="#3b2d24"/>
      <rect x="144" y="94" width="13" height="11" rx="3" fill="#c981cb" />
      <circle cx="147" cy="92" r="7" fill="#e9b85b"/>
    </>}
    {type === 'seniors' && <>
      <path d="M4 104h177" stroke="#88b69b" strokeWidth="3" />
      <rect x="70" y="62" width="70" height="36" rx="9" fill="#88c4aa" />
      <rect x="70" y="91" width="8" height="14" rx="2" fill="#4e7865"/>
      <Person x={96} y={28} scale={.8} outfit="#b375a6" skin="#e1a87d" hair="#acb5af" pose="sit"/>
      <Person x={156} y={21} scale={.83} outfit="#09683e" skin="#ae744e" hair="#293b37"/>
    </>}
    {type === 'adults' && <>
      <rect x="13" y="41" width="41" height="61" rx="14" fill="#d4bdf0" opacity=".7"/>
      <Person x={69} y={21} scale={.85} outfit="#b36d9e" skin="#db9e71" hair="#312820" />
      <Person x={131} y={20} scale={.87} outfit="#107c76" skin="#b57956" hair="#28362e"/>
      <path d="M89 87Q105 94 118 84" stroke="#b65a7d" strokeWidth="5" strokeLinecap="round" fill="none"/>
    </>}
    {type === 'house' && <>
      <House fill="#b3e1c1"/>
      <Person x={134} y={20} scale={.84} outfit="#ae77ba" skin="#c18965" hair="#3b302a"/>
      <path d="M157 63 165 105" stroke="#866857" strokeWidth="5" strokeLinecap="round"/>
      <path d="M155 103h24" stroke="#1a775b" strokeWidth="7" strokeLinecap="round"/>
      <path d="M167 34q9 1 8 12" stroke="#e7ac47" strokeWidth="8" strokeLinecap="round" fill="none"/>
    </>}
    {type === 'support' && <>
      <Chair/>
      <Person x={99} y={31} scale={.68} outfit="#9678bb" skin="#cd956c" hair="#3d3334" pose="sit"/>
      <Person x={40} y={18} scale={.84} outfit="#087e62" skin="#ba7b5c" hair="#2c302b"/>
      <path d="M77 65q16 4 24-4" stroke="#f0bd6a" strokeWidth="7" strokeLinecap="round" fill="none"/>
    </>}
    {type === 'all' && <>
      <House fill="#d6ecc4"/>
      <Person x={52} y={34} scale={.69} outfit="#057652" skin="#cf986d" hair="#342a26"/>
      <Person x={106} y={27} scale={.78} outfit="#be7396" skin="#b77e56" hair="#3b3027" skirt/>
      <Person x={158} y={53} scale={.55} outfit="#8b83d3" skin="#d1a47d" hair="#44362e"/>
      <path d="m140 16 4 9 10 2-8 7 2 10-8-5-8 5 2-10-7-7 10-2Z" fill="#eab951"/>
    </>}
  </svg>;
}
