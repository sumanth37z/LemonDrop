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

function getInitials(email) {
  if (!email) return "?";
  const name = email.split("@")[0].replace(/[^a-zA-Z]/g, "");
  if (name.length === 0) return "?";
  if (name.length === 1) return name.toUpperCase();
  return (name[0] + name[1]).toUpperCase();
}

function formatDate(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function formatFullDate(ts) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  const [view, setView] = useState("inbox");
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
    setView("inbox");
  }

  const checkInbox = useCallback(async () => {
    if (!address) return;
    setChecking(true);
    try {
      const res = await fetch(
        `/api/emails/${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (Array.isArray(data)) setEmails(data);
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

  function openEmail(email) {
    setSelectedEmail(email);
    setView("detail");
  }

  function goBack() {
    setView("inbox");
    setSelectedEmail(null);
  }

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function deleteEmail(id, e) {
    if (e) e.stopPropagation();
    setEmails((prev) => prev.filter((em) => em.id !== id));
    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(null);
      setView("inbox");
    }
  }

  function renderEmailBody(body) {
    if (!body) return "";
    const isHTML = /<[a-z][\s\S]*>/i.test(body);

    if (isHTML) {
      return `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          font-size:14px;line-height:1.6;color:#e0e0e0;background:#0d0d1a;
          margin:0;padding:16px;word-wrap:break-word}
          a{color:#facc15}img{max-width:100%;height:auto}
          table{max-width:100%}
        </style></head><body>${body}</body></html>`;
    } else {
      const escaped = body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1" target="_blank">$1</a>'
        )
        .replace(/\n/g, "<br>");

      return `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body{font-family:monospace;font-size:14px;line-height:1.8;
          color:#e0e0e0;background:#0d0d1a;margin:0;padding:16px;
          word-wrap:break-word}a{color:#facc15}
        </style></head><body>${escaped}</body></html>`;
    }
  }

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
          <p className="text-yellow-400 text-lg animate-pulse">
            Loading LemonDrop...
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════
  // DETAIL VIEW (Mobile + Desktop right panel)
  // ════════════════════════════════════
  const detailPanel = selectedEmail ? (
    <div className="flex flex-col h-full">
      {/* Detail Header */}
      <div className="p-4 border-b border-white/5 flex-shrink-0">
        {/* Back Button */}
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-yellow-400 text-sm mb-4
                     hover:text-yellow-300 active:scale-95 transition
                     md:hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
            viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 19l-7-7 7-7" />
          </svg>
          Back to Inbox
        </button>

        {/* Subject */}
        <h2 className="text-lg md:text-xl font-bold text-white mb-4 break-words">
          {selectedEmail.subject || "(no subject)"}
        </h2>

        {/* Sender */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center 
                       justify-center text-white text-sm md:text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: getAvatarColor(selectedEmail.sender) }}
          >
            {getInitials(selectedEmail.sender)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-200 break-all">
              {selectedEmail.sender}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              To: {selectedEmail.recipient}
            </p>
            <p className="text-xs text-gray-500">
              {formatFullDate(selectedEmail.received_at)}
            </p>
          </div>
          <button
            onClick={(e) => deleteEmail(selectedEmail.id, e)}
            className="text-gray-500 hover:text-red-400 p-2 rounded-lg
                       hover:bg-red-400/10 transition flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          title="Email Content"
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center">
      <div className="text-center p-8">
        <p className="text-5xl mb-4">🍋</p>
        <p className="text-gray-400 text-lg mb-2">Select an email to read</p>
        <p className="text-gray-600 text-sm">Click any email in the inbox</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#0a0a1a] text-white flex flex-col overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="bg-[#111118] border-b border-yellow-500/10 px-3 md:px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xl md:text-2xl">🍋</span>
            <span className="text-base md:text-xl font-bold">
              <span className="text-yellow-400">Lemon</span>
              <span className="text-yellow-200">Drop</span>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={newAddr}
              className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400
                         px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm 
                         transition border border-orange-500/20 active:scale-95"
            >
              🔄 <span className="hidden sm:inline">New</span>
            </button>
            <button
              onClick={checkInbox}
              className="bg-lime-500/10 hover:bg-lime-500/20 text-lime-400
                         px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm 
                         transition border border-lime-500/20 active:scale-95"
            >
              {checking ? "⏳" : "📥"} <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Email Address Bar */}
        <div className="flex items-center gap-2 mt-2">
          <div
            onClick={copy}
            className="flex-1 bg-[#0a0a12] border border-yellow-500/20 rounded-lg 
                       px-3 py-2 font-mono text-yellow-300 text-xs md:text-sm
                       cursor-pointer hover:border-yellow-500/40 transition 
                       truncate select-all"
          >
            {address}
          </div>
          <button
            onClick={copy}
            className="bg-yellow-400 hover:bg-yellow-300 text-black
                       px-3 py-2 rounded-lg text-xs md:text-sm font-bold
                       transition active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            {copied ? "✅ Copied!" : "📋 Copy"}
          </button>
        </div>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="bg-[#0d0d16] border-b border-white/5 px-3 py-1 flex-shrink-0">
        <p className="text-gray-500 text-[10px] md:text-xs">
          {checking
            ? "🍋 Checking for new emails..."
            : `✅ ${emails.length} email${emails.length !== 1 ? "s" : ""} • Auto-refreshes every 5s`}
        </p>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── INBOX LIST ─── */}
        <div
          className={`w-full md:w-[340px] lg:w-[380px] md:min-w-[340px] 
                      md:border-r border-white/5 flex flex-col bg-[#0a0a14] 
                      overflow-hidden
                      ${view === "detail" ? "hidden md:flex" : "flex"}`}
        >
          {/* Inbox Header */}
          <div className="p-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-gray-300">
              📥 Inbox
              {emails.length > 0 && (
                <span className="ml-2 bg-yellow-400/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
                  {emails.length}
                </span>
              )}
            </h2>
          </div>

          {/* Email List */}
          <div className="flex-1 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="p-6 md:p-8 text-center">
                <p className="text-4xl md:text-5xl mb-3">🍋</p>
                <p className="text-gray-400 font-medium mb-2 text-sm md:text-base">
                  No emails yet
                </p>
                <p className="text-gray-600 text-xs md:text-sm mb-4">
                  Send an email to your address above
                </p>
                <div className="bg-[#0d0d1a] rounded-lg p-3 md:p-4 text-left text-[11px] md:text-xs text-gray-500 space-y-1">
                  <p className="text-yellow-400/70 font-bold mb-1.5">
                    Quick test:
                  </p>
                  <p>1. Copy your email above</p>
                  <p>2. Send email from Gmail</p>
                  <p>3. It appears here automatically</p>
                </div>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className={`flex items-start gap-2.5 md:gap-3 p-3 cursor-pointer
                             border-b border-white/5 transition active:bg-yellow-400/10
                             ${selectedEmail?.id === email.id
                               ? "bg-yellow-400/10 border-l-2 border-l-yellow-400"
                               : "hover:bg-yellow-400/5"
                             }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center 
                               justify-center text-white text-xs md:text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: getAvatarColor(email.sender) }}
                  >
                    {getInitials(email.sender)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs md:text-sm font-semibold text-gray-200 truncate">
                        {email.sender.split("@")[0]}
                      </p>
                      <span className="text-[10px] md:text-xs text-gray-500 flex-shrink-0">
                        {formatDate(email.received_at)}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-white truncate mt-0.5">
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-[11px] md:text-xs text-gray-500 truncate mt-0.5">
                      {email.body
                        ? email.body.replace(/<[^>]*>/g, "").substring(0, 60)
                        : ""}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => deleteEmail(email.id, e)}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded 
                               transition flex-shrink-0 hover:bg-red-400/10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── EMAIL DETAIL ─── */}
        <div
          className={`flex-1 flex flex-col bg-[#0a0a12] overflow-hidden
                      ${view === "inbox" ? "hidden md:flex" : "flex"}`}
        >
          {detailPanel}
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="bg-[#0d0d16] border-t border-white/5 px-3 py-1.5 flex-shrink-0">
        <p className="text-gray-700 text-[10px] md:text-xs text-center">
          🍋 LemonDrop — No signup • No card • 100% Free
        </p>
      </div>
    </div>
  );
}