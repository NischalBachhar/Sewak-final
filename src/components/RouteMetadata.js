import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function routeMetadata(pathname) {
  if (pathname === "/get-started") return { title: "Get started | Sewak", description: "Choose whether to find care or join the Sewak care marketplace.", public: true };
  if (pathname === "/care-services") return { title: "Care & household services | Sewak", description: "Browse Nepal care services and find available caregivers or household professionals.", public: true };
  if (pathname === "/safety") return { title: "Safety guidance | Sewak", description: "Review Sewak verification details and practical tips for choosing care safely.", public: true };
  if (pathname === "/pricing") return { title: "Care pricing | Sewak", description: "Understand caregiver rates, booking requests, and supported payment methods.", public: true };
  if (["/", "/browse"].includes(pathname)) return { title: "Sewak — Care, close to home", description: "Browse caregivers and household support in Nepal. Review services and request care for your family.", public: true };
  if (/^\/caregivers\/[^/]+$/.test(pathname)) return { title: "Caregiver profile | Sewak", description: "Review this caregiver’s services, availability and verified feedback on Sewak.", public: true };
  return { title: "Your care account | Sewak", description: "Manage your Sewak account and care requests.", public: false };
}
export default function RouteMetadata() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo?.({ top: 0, left: 0, behavior: "instant" }); }, [pathname, hash]);
  useEffect(() => {
    const data = routeMetadata(pathname); document.title = data.title;
    const meta = (key, content, property = false) => {
      let node = document.head.querySelector(`meta[${property ? "property" : "name"}="${key}"]`);
      if (!node) { node = document.createElement("meta"); node.setAttribute(property ? "property" : "name", key); document.head.append(node); }
      node.content = content;
    };
    meta("description", data.description); meta("robots", data.public ? "index,follow" : "noindex,nofollow");
    meta("og:title", data.title, true); meta("og:description", data.description, true); meta("og:type", "website", true);
    meta("twitter:card", "summary"); meta("twitter:title", data.title); meta("twitter:description", data.description);
    document.head.querySelector('link[rel="canonical"]')?.remove();
    const origin = process.env.REACT_APP_CANONICAL_ORIGIN;
    if (data.public && origin) {
      const url = new URL(pathname, origin).href;
      const link = document.createElement("link"); link.rel = "canonical"; link.href = url; document.head.append(link); meta("og:url", url, true);
    } else document.head.querySelector('meta[property="og:url"]')?.remove();
  }, [pathname]);
  return null;
}
