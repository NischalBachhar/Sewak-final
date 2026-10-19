import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiRequest } from './apiClient';
import './MarketplaceExpansion.css';

const initial = { loading: true, conversations: [], error: '' };

export default function CareInboxPage() {
  const { userRole } = useAuth();
  const [state, setState] = useState(initial);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const refresh = useCallback(() => setRefreshKey(key => key + 1), []);
  const caregiver = userRole === 'caregiver';
  const root = caregiver ? '/caregiver' : '/user';
  const visibleConversations = state.conversations.filter(thread => {
    const matchesKind = kind === 'all' || thread.kind === kind;
    const searchText = [thread.partnerName, thread.title, thread.preview].filter(Boolean).join(' ').toLowerCase();
    return matchesKind && searchText.includes(query.trim().toLowerCase());
  });
  useEffect(() => {
    let alive = true;
    setState(value => ({ ...value, loading: true, error: '' }));
    apiRequest('/api/care-inbox').then(payload => {
      if (alive) setState({ loading: false, error: '', conversations: payload.conversations || [] });
    }).catch(error => {
      if (alive) setState({ loading: false, error: error.message, conversations: [] });
    });
    return () => { alive = false; };
  }, [refreshKey]);
  return (
    <main className="care-inbox-page" id="main-content">
      <header className="care-inbox-intro">
        <div><p>YOUR CARE CONNECTIONS</p><h1>Messages</h1>
          <span>Conversations about bookings and care jobs stay in one secure place.</span>
        </div>
        <button type="button" onClick={refresh} disabled={state.loading}>Refresh messages</button>
      </header>
      {!state.loading && !state.error && state.conversations.length > 0 && <div className="sewak2-inbox-controls" role="search" aria-label="Search private conversations">
        <label>Search conversations<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search people, bookings or messages" maxLength={100} /></label>
        <label>Type<select value={kind} onChange={event=>setKind(event.target.value)}><option value="all">All conversations</option><option value="booking">Bookings</option><option value="job">Care jobs</option></select></label>
        <span role="status">{visibleConversations.length} of {state.conversations.length} conversations</span>
      </div>}
      <section className="care-inbox-panel" aria-label="Your private conversations">
        {state.loading ? <p role="status">Loading your conversations…</p> :
          state.error ? <div role="alert"><p>Messages are unavailable: {state.error}</p>
            <button type="button" onClick={refresh}>Try again</button></div> :
          state.conversations.length === 0 ?
            <div className="care-inbox-empty"><h2>No conversations yet</h2>
              <p>When you exchange messages about a booking or care job, they will appear here.</p>
              <Link to={caregiver ? '/caregiver/opportunities' : '/user'}>{caregiver ? 'Browse care jobs' : 'Find caregivers'} →</Link>
            </div> :
            visibleConversations.length === 0 ? <div className="care-inbox-empty"><h2>No matching conversations</h2><p>Try a different search or conversation type.</p><button type="button" onClick={()=>{setQuery('');setKind('all');}}>Clear filters</button></div> :
            <ul className="care-inbox-list">{visibleConversations.map(thread => {
              const url = thread.kind === 'job'
                ? `${root}/messages/job/${encodeURIComponent(thread.contextId)}${caregiver ? '' : '?caregiverId=' + encodeURIComponent(thread.caregiverId)}`
                : `${root}/messages/booking/${encodeURIComponent(thread.contextId)}`;
              return <li key={thread.kind + '-' + thread.contextId + '-' + thread.caregiverId}>
                <Link to={url} className="care-inbox-thread">
                  <span className="care-inbox-avatar" aria-hidden="true">{String(thread.partnerName || 'C').slice(0,1).toUpperCase()}</span>
                  <span className="care-inbox-thread-body">
                    <span className="care-inbox-thread-title"><strong>{thread.partnerName || 'Care partner'}</strong>
                      <small>{thread.kind === 'job' ? 'Care job' : 'Booking'}</small></span>
                    <strong className="care-inbox-context">{thread.title || 'Care conversation'}</strong>
                    <span className="care-inbox-preview">{thread.preview || ''}</span>
                  </span>
                  <span className="care-inbox-thread-end">
                    <time dateTime={thread.updatedAt || undefined}>{thread.updatedAt ? new Date(thread.updatedAt).toLocaleDateString('en-NP') : ''}</time>
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>;
            })}</ul>}
      </section>
      <p className="care-inbox-note">Only participants can read their conversations. For urgent concerns, contact Sewak support directly.</p>
    </main>
  );
}
