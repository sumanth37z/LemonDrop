"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const DOMAIN = "lemondrop.qzz.io";

function randomAddr() {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  let n = "";
  for (let i = 0; i < 10; i++)
    n += c[Math.floor(Math.random() * c.length)];
  return n + "@" + DOMAIN;
}

// Generate color from email address
function getAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Get initials from email
function getInitials(email) {
  if (!email) return "?";
  const name = email.split("@")[0].replace(/[^a-zA-Z]/g, "");
  if (name.length === 0) return "?";
  if (name.length === 1) return name.toUpperCase();
  return (name[0] + name[1]).toUpperCase();
}

// Format date nicely
function formatDate(ts) {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(ts) {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  const iframeRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("ld_addr");
    if (saved && saved.endsWith("@" + DOMAIN)) {
      setAddress(saved);
    } else {
      const addr = randomAddr();
      setAddress(addr);
      sessionStorage.setItem("ld_addr", addr);
    }
    setReady(true);
  }, []);

  function newAddr() {
    const addr = randomAddr();
    setAddress(addr);
    sessionStorage.setItem("ld_addr", addr);
    setEmails([]);
    setSelectedEmail(null);
  }

  const checkInbox = useCallback(async () => {
    if (!address) return;
    setChecking(true);
    try {
      const res = await fetch(
        `/api/emails/${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmails(data);
      }
    } catch (e) {
      console.log("Error:", e);
    }
    setChecking(false);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    checkInbox();
    const i = setInterval(checkInbox, 5000);
    return () => clearInterval(i);
  }, [address, checkInbox]);

  function selectEmail(email) {
    setSelectedEmail(email);
    setMobileView("detail");
  }

  function backToList() {
    setMobileView("list");
    setSelectedEmail(null);
  }

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function deleteEmail(id, e) {
    if (e) e.stopPropagation();
    setEmails((prev) => prev.filter((email) => email.id !== id));
    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(null);
      setMobileView("list");
    }
  }

  // Render HTML email in iframe for full support (images, css, etc)
  function renderEmailBody(body) {
    if (!body) return "";
    
    // Check if it's HTML
    const isHTML = /<[a-z][\s\S]*>/i.test(body);
    
    if (isHTML) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #e0e0e0;
              background: #0d0d1a;
              margin: 0;
              padding: 16px;
              word-wrap: break-word;
            }
            a { color: #facc15; }
            img { max-width: 100%; height: auto; border-radius: 4px; }
            table { max-width: 100%; }
            pre { white-space: pre-wrap; overflow-x: auto; }
            blockquote { border-left: 3px solid #333; padding-left: 12px; margin-left: 0; color: #999; }
          </style>
        </head>
        <body>${body}</body>
        </html>
      `;
    } else {
      // Plain text
      const escaped = body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1" target="_blank" rel="noopener">$1</a>'
        )
        .replace(/\n/g, "<br>");

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 14px;
              line-height: 1.8;
              color: #e0e0e0;
              background: #0d0d1a;
              margin: 0;
              padding: 16px;
              word-wrap: break-word;
            }
            a { color: #facc15; }
          </style>
        </head>
        <body>${escaped}</body>
        </html>
      `;
    }
  }

  // Set iframe content
  useEffect(() => {
    if (selectedEmail && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(renderEmailBody(selectedEmail.body));
        doc.close();
      }
    }
  }, [selectedEmail]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🍋</p>
          <p className="text-yellow-400 text-xl animate-pulse">
            Loading LemonDrop...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white flex flex-col">

      {/* ═══════════ TOP BAR ═══════════ */}
      <div className="bg-[#111118] border-b border-yellow-500/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍋</span>
            <h1 className="text-xl font-bold">
              <span className="text-yellow-400">Lemon</span>
              <span className="text-yellow-200">Drop</span>
            </h1>
          </div>

          {/* Email Address */}
          <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
            <div
              onClick={copy}
              className="bg-[#0a0a12] border border-yellow-500/20 rounded-lg 
                         px-4 py-2 font-mono text-yellow-300 text-sm
                         cursor-pointer hover:border-yellow-500/40 
                         transition select-all truncate max-w-md"
            >
              {address}
            </div>
            <button
              onClick={copy}
              className="bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400
                         px-3 py-2 rounded-lg text-sm transition whitespace-nowrap
                         border border-yellow-400/20"
            >
              {copied ? "✅" : "📋"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={newAddr}
              className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400
                         px-3 py-2 rounded-lg text-sm transition
                         border border-orange-500/20"
              title="New Address"
            >
              🔄 New
            </button>
            <button
              onClick={checkInbox}
              className="bg-lime-500/10 hover:bg-lime-500/20 text-lime-400
                         px-3 py-2 rounded-lg text-sm transition
                         border border-lime-500/20"
              title="Refresh"
            >
              {checking ? "⏳" : "📥"} Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ STATUS BAR ═══════════ */}
      <div className="bg-[#0d0d16] border-b border-white/5 px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="text-gray-500 text-xs">
            {checking
              ? "🍋 Checking for new emails..."
              : `✅ ${emails.length} email${emails.length !== 1 ? "s" : ""} • Auto-refreshes every 5s`}
          </p>
          <p className="text-gray-600 text-xs">
            Emails auto-delete after 1 hour
          </p>
        </div>
      </div>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">

        {/* ─── EMAIL LIST (Left Panel) ─── */}
        <div
          className={`w-full md:w-[380px] md:min-w-[380px] border-r border-white/5 
                      flex flex-col bg-[#0a0a14] overflow-hidden
                      ${mobileView === "detail" ? "hidden md:flex" : "flex"}`}
        >
          {/* List Header */}
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-300">
              📥 Inbox
              {emails.length > 0 && (
                <span className="ml-2 bg-yellow-400/20 text-yellow-400 
                                 text-xs px-2 py-0.5 rounded-full">
                  {emails.length}
                </span>
              )}
            </h2>
          </div>

          {/* Email List */}
          <div className="flex-1 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-5xl mb-4">🍋</p>
                <p className="text-gray-400 font-medium mb-2">
                  No emails yet
                </p>
                <p className="text-gray-600 text-sm mb-4">
                  Send an email to your address above
                </p>
                <div className="bg-[#0d0d1a] rounded-lg p-4 text-left text-xs text-gray-500 space-y-1.5">
                  <p className="text-yellow-400/70 font-bold text-xs mb-2">
                    Quick test:
                  </p>
                  <p>1. Copy your email above</p>
                  <p>2. Send email from Gmail/ProtonMail</p>
                  <p>3. It appears here automatically</p>
                </div>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => selectEmail(email)}
                  className={`flex items-start gap-3 p-3 cursor-pointer
                             border-b border-white/5 transition
                             hover:bg-yellow-400/5
                             ${selectedEmail?.id === email.id
                               ? "bg-yellow-400/10 border-l-2 border-l-yellow-400"
                               : ""
                             }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center
                               text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: getAvatarColor(email.sender) }}
                  >
                    {getInitials(email.sender)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-200 truncate">
                        {email.sender.split("@")[0]}
                      </p>
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                        {formatDate(email.received_at)}
                      </span>
                    </div>
                    <p className="text-sm text-white truncate mt-0.5">
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {email.body
                        ? email.body.replace(/<[^>]*>/g, "").substring(0, 80)
                        : ""}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => deleteEmail(email.id, e)}
                    className="text-gray-600 hover:text-red-400 transition 
                               opacity-0 group-hover:opacity-100 flex-shrink-0
                               hover:bg-red-400/10 rounded p-1"
                    title="Delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── EMAIL DETAIL (Right Panel) ─── */}
        <div
          className={`flex-1 flex flex-col bg-[#0a0a12] overflow-hidden
                      ${mobileView === "list" ? "hidden md:flex" : "flex"}`}
        >
          {selectedEmail ? (
            <>
              {/* Detail Header */}
              <div className="p-4 border-b border-white/5">

                {/* Back button (mobile) */}
                <button
                  onClick={backToList}
                  className="md:hidden mb-3 text-yellow-400 text-sm 
                             flex items-center gap-1 hover:text-yellow-300"
                >
                  ← Back to inbox
                </button>

                {/* Subject */}
                <h2 className="text-xl font-bold text-white mb-4">
                  {selectedEmail.subject || "(no subject)"}
                </h2>

                {/* Sender Info */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center
                               text-white text-lg font-bold flex-shrink-0"
                    style={{
                      backgroundColor: getAvatarColor(selectedEmail.sender),
                    }}
                  >
                    {getInitials(selectedEmail.sender)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-200">
                        {selectedEmail.sender.split("@")[0]}
                      </p>
                      <p className="text-xs text-gray-500">
                        &lt;{selectedEmail.sender}&gt;
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-gray-500">
                        To: {selectedEmail.recipient}
                      </p>
                      <span className="text-gray-700">•</span>
                      <p className="text-xs text-gray-500">
                        {formatFullDate(selectedEmail.received_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteEmail(selectedEmail.id, e)}
                    className="text-gray-500 hover:text-red-400 transition
                               hover:bg-red-400/10 rounded-lg p-2"
                    title="Delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Email Body — rendered in iframe for full HTML/image support */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  ref={iframeRef}
                  title="Email Content"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  referrerPolicy="no-referrer"
                />
              </div>
            </>
          ) : (
            /* No email selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <p className="text-6xl mb-4">🍋</p>
                <p className="text-gray-400 text-lg font-medium mb-2">
                  Select an email to read
                </p>
                <p className="text-gray-600 text-sm">
                  Click on any email in the inbox to view it here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ FOOTER ═══════════ */}
      <div className="bg-[#0d0d16] border-t border-white/5 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="text-gray-700 text-xs">
            🍋 LemonDrop — Free Disposable Email
          </p>
          <p className="text-gray-700 text-xs">
            No signup • No card • 100% Free
          </p>
        </div>
      </div>
    </div>
  );
}