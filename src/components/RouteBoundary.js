import React from "react";
export default class RouteBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="app-shell"><section className="app-card"><h1>This page could not load</h1><p>Check your connection and reload to try again.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button></section></main> : this.props.children;
  }
}
