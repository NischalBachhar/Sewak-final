import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../apiClient';

export default function CareNotificationsBell({role}){
  const [count,setCount]=useState(0);
  const navigate=useNavigate();
  const refresh=useCallback(()=>{
    let alive=true;
    apiRequest('/api/care-notifications').then(result=>{if(alive)setCount(Math.max(0,Number(result.unread)||0));}).catch(()=>{});
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    const cleanup=refresh();
    const timer=window.setInterval(refresh,60000);
    const onFocus=()=>refresh();
    window.addEventListener('focus',onFocus);
    return ()=>{cleanup();window.clearInterval(timer);window.removeEventListener('focus',onFocus);};
  },[refresh]);
  const path=role==='caregiver'?'/caregiver/notifications':role==='orgadmin'?'/organization/notifications':role==='superadmin'?'/superadmin/notifications':'/user/notifications';
  return <button type="button" className="header-notification-link"
    aria-label={'Notifications'+(count?' ('+count+' unread)':'')}
    onClick={()=>navigate(path)}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
    {count>0&&<span aria-hidden="true">{count>99?'99+':count}</span>}
  </button>;
}
