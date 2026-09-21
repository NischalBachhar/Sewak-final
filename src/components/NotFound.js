import React from "react";
import { Link } from "react-router-dom";
export default function NotFound() {
  return <main className="app-shell"><section className="app-card"><h1>Page not found</h1><p>This link may be outdated. You can browse care or return to your account.</p><Link className="btn btn-primary" to="/">Go to Sewak home</Link></section></main>;
}
