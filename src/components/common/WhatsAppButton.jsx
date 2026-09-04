/**
 * WhatsAppButton.jsx — Reusable contextual WhatsApp buttons.
 *
 * Exports:
 *   WhatsAppSingleButton     – one explicit-context button
 *   WhatsAppContextualButtons – full auto-detected stack (Welcome / Birthday /
 *                               Expiring / Expired / Default)
 */
import React from "react";
import { MessageCircle } from "lucide-react";
import { openClientWhatsApp } from "../../utils/whatsapp";
import { isBirthdayToday, isTodayDate } from "../../utils/dateFormat";

const ICON_SIZE = { sm: "w-3.5 h-3.5", md: "w-4 h-4" };
const PAD       = { sm: "p-1",         md: "p-1.5"    };

const CONTEXT_STYLES = {
  WELCOME:          "text-white bg-white/10 border border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.4)] hover:border-white hover:bg-white/20",
  BIRTHDAY:         "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 shadow-[0_0_12px_rgba(250,204,21,0.35)] hover:border-yellow-400 hover:bg-yellow-400/20",
  EXPIRING:         "text-orange-500 bg-orange-500/10 border border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.35)] hover:border-orange-500 hover:bg-orange-500/20",
  EXPIRED:          "text-rose-500 bg-rose-500/10 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.35)] hover:border-rose-500 hover:bg-rose-500/20",
  DEFAULT:          "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:border-emerald-500 hover:bg-emerald-500/20",
  DEFAULT_DISABLED: "text-slate-600 border border-slate-700 opacity-40 cursor-not-allowed",
};

const CONTEXT_TITLES = {
  WELCOME:          "Send Welcome Message (New Member)",
  BIRTHDAY:         "Send Birthday Greetings",
  EXPIRING:         "Send Expiring Soon Reminder",
  EXPIRED:          "Send Expired Subscription Notice",
  DEFAULT:          "Chat on WhatsApp",
  DEFAULT_NO_PHONE: "No phone number recorded",
};

export function WhatsAppSingleButton({
  client,
  context = "DEFAULT",
  size = "md",
  stopPropagation = true,
  disabled: forceDisabled = false,
  className = "",
}) {
  const hasPhone   = !!client?.phone;
  const isDisabled = forceDisabled || !hasPhone;
  const ctx        = String(context).toUpperCase();
  const styleKey   = isDisabled && ctx === "DEFAULT" ? "DEFAULT_DISABLED" : ctx;
  const baseStyle  = CONTEXT_STYLES[styleKey] ?? CONTEXT_STYLES.DEFAULT;
  const title      = isDisabled && ctx === "DEFAULT"
    ? CONTEXT_TITLES.DEFAULT_NO_PHONE
    : CONTEXT_TITLES[ctx] ?? CONTEXT_TITLES.DEFAULT;

  return (
    <button
      disabled={isDisabled}
      title={title}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        if (isDisabled) return;
        openClientWhatsApp({ client, contextOverride: ctx });
      }}
      className={`${PAD[size]} rounded-lg border transition-colors ${baseStyle} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <MessageCircle className={ICON_SIZE[size]} />
    </button>
  );
}

export function WhatsAppContextualButtons({ client, size = "md", stopPropagation = true }) {
  if (!client) return null;

  const isBirthday = isBirthdayToday(client.date_of_birth);
  const daysLeft   = (client.days_left !== undefined && client.days_left !== null)
    ? Number(client.days_left) : null;
  const subStatus  = String(client.sub_status ?? client.status ?? "").toLowerCase();
  const compStatus = String(client.computed_status ?? "").toUpperCase();

  const isExpiring = daysLeft === 1 || (
    client.latest_end_date &&
    Math.ceil((new Date(client.latest_end_date) - new Date()) / 86400000) === 1
  );

  let isExpired = false;
  if (daysLeft !== null && !Number.isNaN(daysLeft)) {
    isExpired = daysLeft <= 0 && daysLeft >= -30;
  } else {
    isExpired = subStatus === "expired" || compStatus === "EXPIRED";
  }

  // A member cannot be a "New Welcome" member if their subscription is already expired
  const isNew = isTodayDate(client.created_at ?? client.registered_at) && !isExpired;

  const handleClick = (ctx) => (e) => {
    if (stopPropagation) e.stopPropagation();
    openClientWhatsApp({ client, contextOverride: ctx });
  };

  const handleDefault = (e) => {
    if (stopPropagation) e.stopPropagation();
    openClientWhatsApp({ client, contextOverride: "DEFAULT" });
  };

  return (
    <>
      {isNew && client.phone && (
        <button onClick={handleClick("WELCOME")} title={CONTEXT_TITLES.WELCOME}
          className={`${PAD[size]} rounded-lg border transition-colors cursor-pointer ${CONTEXT_STYLES.WELCOME}`}>
          <MessageCircle className={ICON_SIZE[size]} />
        </button>
      )}
      {isBirthday && client.phone && (
        <button onClick={handleClick("BIRTHDAY")} title={CONTEXT_TITLES.BIRTHDAY}
          className={`${PAD[size]} rounded-lg border transition-colors cursor-pointer ${CONTEXT_STYLES.BIRTHDAY}`}>
          <MessageCircle className={ICON_SIZE[size]} />
        </button>
      )}
      {isExpiring && client.phone && (
        <button onClick={handleClick("EXPIRING")} title={CONTEXT_TITLES.EXPIRING}
          className={`${PAD[size]} rounded-lg border transition-colors cursor-pointer ${CONTEXT_STYLES.EXPIRING}`}>
          <MessageCircle className={ICON_SIZE[size]} />
        </button>
      )}
      {isExpired && client.phone && (
        <button onClick={handleClick("EXPIRED")} title={CONTEXT_TITLES.EXPIRED}
          className={`${PAD[size]} rounded-lg border transition-colors cursor-pointer ${CONTEXT_STYLES.EXPIRED}`}>
          <MessageCircle className={ICON_SIZE[size]} />
        </button>
      )}
      <button
        disabled={!client.phone}
        onClick={client.phone ? handleDefault : undefined}
        title={client.phone ? CONTEXT_TITLES.DEFAULT : CONTEXT_TITLES.DEFAULT_NO_PHONE}
        className={`${PAD[size]} rounded-lg border transition-colors ${client.phone ? `cursor-pointer ${CONTEXT_STYLES.DEFAULT}` : CONTEXT_STYLES.DEFAULT_DISABLED}`}>
        <MessageCircle className={ICON_SIZE[size]} />
      </button>
    </>
  );
}