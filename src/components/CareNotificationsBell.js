import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../apiClient';

export default function CareNotificationsBell({role}){
  const [count,setCount]=useState(0);
  const navigate=useNavigate();
  useEffect(()=>{
    let alive=true;
    const refresh=()=>{
    apiRequest('/api/care-notifications').then(result=>{if(alive)setCount(Math.max(0,Number(result.unread)||0));}).catch(()=>{});
    };
    setCount(0);refresh();
    const timer=window.setInterval(refresh,60000);
    const onFocus=()=>refresh();
    window.addEventListener('focus',onFocus);
    window.addEventListener('sewak-notifications-changed',onFocus);
    return ()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',onFocus);window.removeEventListener('sewak-notifications-changed',onFocus);};
  },[role]);
  const path=role==='caregiver'?'/caregiver/notifications':role==='orgadmin'?'/organization/notifications':role==='superadmin'?'/superadmin/notifications':'/user/notifications';
  return <button type="button" className="header-notification-link"
    aria-label={'Notifications'+(count?' ('+count+' unread)':'')}
    onClick={()=>navigate(path)}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
    {count>0&&<span aria-hidden="true">{count>99?'99+':count}</span>}
  </button>;
}
