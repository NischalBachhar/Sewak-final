import React from 'react';
import { Link } from 'react-router-dom';
import { careCategories, categoryHref } from '../serviceCatalog';

// Original SVG illustrations. No third-party brand illustrations are reused.
export function CareIllustration({ kind }) {
  const person = (x, shirt, skin, seated = false) => <g transform={`translate(${x} 0)`}>
    <circle cx="0" cy="35" r="10" fill={skin} />
    <path d="M-11 34q-2-16 11-15 12 0 11 15l-5-7q-6 5-16 2Z" fill="#343a35" />
    <path d="M-13 58q0-15 13-15t13 15v23h-26Z" fill={shirt} />
    <path d={seated ? 'M-7 80v10h26v18M5 80v9h27v19' : 'M-7 81v27M7 81v27'} fill="none" stroke="#31453f" strokeWidth="8" strokeLinecap="round" />
    <path d="m-13 56-7 22m33-22 9 17" stroke={skin} strokeWidth="7" strokeLinecap="round" />
  </g>;
  return <svg viewBox="0 0 160 125" aria-hidden="true" focusable="false">
    <ellipse cx="80" cy="112" rx="65" ry="9" fill="#123e3320" />
    {kind === 'child' && <><path d="M24 106V74h37v32" fill="#f3bd57" /><circle cx="40" cy="62" r="15" fill="#e1a547" /><circle cx="29" cy="49" r="6" fill="#e1a547" /><circle cx="51" cy="49" r="6" fill="#e1a547" />{person(103, '#e17b55', '#ba7a55')}{<g transform="translate(68 34) scale(.64)">{person(0, '#78a9a5', '#e5b98a')}</g>}</>}
    {kind === 'senior' && <>{person(57, '#8da49c', '#d3a173')}{person(104, '#d37d92', '#b77955')}<path d="M28 109V82h38v27M29 88h38" fill="none" stroke="#e0b45e" strokeWidth="4" /><path d="M51 23q6-11 14 0" fill="none" stroke="#e6e2d7" strokeWidth="7" /></>}
    {kind === 'disability' && <><circle cx="65" cy="89" r="25" fill="none" stroke="#395f66" strokeWidth="6" />{person(68, '#a697cb', '#d4a175', true)}<path d="M48 69V57m0 29h39l15 22" fill="none" stroke="#395f66" strokeWidth="5" />{person(117, '#e4b974', '#ac704a')}</>}
    {kind === 'patient' && <><path d="M19 99V67h68v32" fill="#a5c4bd" /><path d="M17 103h74M24 103v9m61-9v9" fill="none" stroke="#42655d" strokeWidth="5" /><rect x="26" y="72" width="29" height="15" rx="5" fill="#fffdf7" /><circle cx="46" cy="66" r="10" fill="#d5a475" /><path d="M57 64h30v24H53Z" fill="#d9b975" />{person(117, '#77a7a0', '#bb7b55')}</>}
    {kind === 'home' && <><path d="m19 43 27-22 27 22v54H22Z" fill="#fffdf5" /><path d="m15 44 32-27 31 27" fill="none" stroke="#d48a79" strokeWidth="5" /><rect x="35" y="67" width="19" height="30" rx="3" fill="#b5c5b0" />{person(101, '#d58ca1', '#bc8058')}<path d="m135 45-15 55m-9 3h22l7 10h-35Z" fill="#e7bc64" stroke="#a68145" strokeWidth="3" /></>}
  </svg>;
}
export default function CareCategoryTiles({ descriptions = false }) {
  return <div className={'care-category-tiles' + (descriptions ? ' care-category-tiles--detailed' : '')} aria-label="Explore care services">
    {careCategories.map(category => <Link className={'care-category-tile care-category-tile--' + category.color} to={categoryHref(category)} key={category.id}>
      <CareIllustration kind={category.id} /><strong>{category.label}</strong>{descriptions && <span>{category.copy}</span>}
    </Link>)}
  </div>;
}
