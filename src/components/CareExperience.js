import React from "react";
import "./CareExperience.css";

/*
 * Presentation-only care experience components.
 *
 * These components deliberately do not read from a database, navigate, or
 * mutate a care record. Supply the current record/status through props and
 * wire actions to the application's existing authorised handlers.
 */

const STATUS_ALIASES = {
  submitted: {
    label: "Request submitted",
    tone: "neutral",
    journeyRank: 0,
    journeyStage: "submitted",
  },
  request_submitted: {
    label: "Request submitted",
    tone: "neutral",
    journeyRank: 0,
    journeyStage: "submitted",
  },
  pending: {
    label: "Waiting for caregiver",
    tone: "pending",
    journeyRank: 1,
    journeyStage: "awaiting_caregiver",
  },
  awaiting_caregiver: {
    label: "Waiting for caregiver",
    tone: "pending",
    journeyRank: 1,
    journeyStage: "awaiting_caregiver",
  },
  awaiting_response: {
    label: "Waiting for caregiver",
    tone: "pending",
    journeyRank: 1,
    journeyStage: "awaiting_caregiver",
  },
  accepted: {
    label: "Caregiver accepted",
    tone: "info",
    journeyRank: 2,
    journeyStage: "accepted",
  },
  caregiver_accepted: {
    label: "Caregiver accepted",
    tone: "info",
    journeyRank: 2,
    journeyStage: "accepted",
  },
  confirmed: {
    label: "Booking confirmed",
    tone: "info",
    journeyRank: 3,
    journeyStage: "confirmed",
  },
  booking_confirmed: {
    label: "Booking confirmed",
    tone: "info",
    journeyRank: 3,
    journeyStage: "confirmed",
  },
  scheduled: {
    label: "Care scheduled",
    tone: "info",
    journeyRank: 3,
    journeyStage: "confirmed",
  },
  arriving: {
    label: "Caregiver arriving",
    tone: "info",
    journeyRank: 4,
    journeyStage: "checked_in",
  },
  checked_in: {
    label: "Caregiver checked in",
    tone: "positive",
    journeyRank: 4,
    journeyStage: "checked_in",
  },
  check_in: {
    label: "Caregiver checked in",
    tone: "positive",
    journeyRank: 4,
    journeyStage: "checked_in",
  },
  in_progress: {
    label: "Care in progress",
    tone: "active",
    journeyRank: 5,
    journeyStage: "in_progress",
    live: true,
  },
  active: {
    label: "Care in progress",
    tone: "active",
    journeyRank: 5,
    journeyStage: "in_progress",
    live: true,
  },
  care_in_progress: {
    label: "Care in progress",
    tone: "active",
    journeyRank: 5,
    journeyStage: "in_progress",
    live: true,
  },
  checked_out: {
    label: "Caregiver checked out",
    tone: "neutral",
    journeyRank: 6,
    journeyStage: "checked_out",
  },
  check_out: {
    label: "Caregiver checked out",
    tone: "neutral",
    journeyRank: 6,
    journeyStage: "checked_out",
  },
  completed: {
    label: "Care completed",
    tone: "complete",
    journeyRank: 7,
    journeyStage: "completed",
  },
  cancelled: {
    label: "Booking cancelled",
    tone: "danger",
    terminal: true,
  },
  canceled: {
    label: "Booking cancelled",
    tone: "danger",
    terminal: true,
  },
  declined: {
    label: "Caregiver declined",
    tone: "danger",
    terminal: true,
  },
  rejected: {
    label: "Request declined",
    tone: "danger",
    terminal: true,
  },
  issue_reported: {
    label: "Issue reported",
    tone: "warning",
    terminal: true,
  },
  disputed: {
    label: "Issue reported",
    tone: "warning",
    terminal: true,
  },
};

export const CARE_STATUS_MAP = Object.freeze(STATUS_ALIASES);

export const DEFAULT_BOOKING_STEPS = Object.freeze([
  {
    id: "care-needed",
    label: "Care needed",
    shortLabel: "Care",
    description: "Who needs care and what help is required?",
  },
  {
    id: "schedule",
    label: "Schedule",
    shortLabel: "Schedule",
    description: "Choose a date, time, and duration.",
  },
  {
    id: "details",
    label: "Details",
    shortLabel: "Details",
    description: "Add relevant care instructions.",
  },
  {
    id: "review",
    label: "Review & confirm",
    shortLabel: "Review",
    description: "Review the request before confirming.",
  },
]);

export const DEFAULT_CARE_JOURNEY_STAGES = Object.freeze([
  {
    id: "submitted",
    label: "Request submitted",
    statusKeys: ["submitted", "request_submitted"],
    rank: 0,
  },
  {
    id: "awaiting_caregiver",
    label: "Waiting for caregiver",
    statusKeys: ["pending", "awaiting_caregiver", "awaiting_response"],
    rank: 1,
  },
  {
    id: "accepted",
    label: "Caregiver accepted",
    statusKeys: ["accepted", "caregiver_accepted"],
    rank: 2,
  },
  {
    id: "confirmed",
    label: "Booking confirmed",
    statusKeys: ["confirmed", "booking_confirmed", "scheduled"],
    rank: 3,
  },
  {
    id: "checked_in",
    label: "Caregiver checked in",
    statusKeys: ["arriving", "checked_in", "check_in"],
    rank: 4,
  },
  {
    id: "in_progress",
    label: "Care in progress",
    statusKeys: ["in_progress", "active", "care_in_progress"],
    rank: 5,
  },
  {
    id: "checked_out",
    label: "Caregiver checked out",
    statusKeys: ["checked_out", "check_out"],
    rank: 6,
  },
  {
    id: "completed",
    label: "Care completed",
    statusKeys: ["completed"],
    rank: 7,
  },
]);

export const VERIFICATION_STATES = Object.freeze({
  verified: {
    label: "Verified",
    tone: "verified",
  },
  pending: {
    label: "Pending verification",
    tone: "pending",
  },
  not_verified: {
    label: "Not verified",
    tone: "not-verified",
  },
  unavailable: {
    label: "Verification status unavailable",
    tone: "unavailable",
  },
});

function joinClassNames() {
  return Array.prototype.slice
    .call(arguments)
    .filter(Boolean)
    .join(" ");
}

function normalizeKey(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function humanizeKey(value) {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return "Status unavailable";
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map(function capitalize(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function getStatusDefinition(status, statusMap) {
  const normalizedStatus = normalizeKey(status);
  const customDefinition =
    statusMap && normalizedStatus ? statusMap[normalizedStatus] : undefined;
  const defaultDefinition = normalizedStatus
    ? CARE_STATUS_MAP[normalizedStatus]
    : undefined;
  const definition = customDefinition || defaultDefinition;

  if (typeof definition === "string") {
    return {
      key: normalizedStatus || "unknown",
      label: definition,
      tone: "neutral",
      rawStatus: status,
    };
  }

  if (definition) {
    return {
      ...definition,
      key: definition.key || normalizedStatus,
      label: definition.label || humanizeKey(status),
      tone: definition.tone || "neutral",
      rawStatus: status,
    };
  }

  return {
    key: normalizedStatus || "unknown",
    label: normalizedStatus ? humanizeKey(status) : "Status unavailable",
    tone: "neutral",
    rawStatus: status,
  };
}

/**
 * Maps a record status to presentation metadata. Unknown values stay neutral
 * and are displayed as the original status rather than being guessed.
 */
export function resolveCareStatus(status, statusMap) {
  return getStatusDefinition(status, statusMap);
}

function toValidDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && typeof value.toDate === "function") {
    const convertedDate = value.toDate();
    return convertedDate instanceof Date && !Number.isNaN(convertedDate.getTime())
      ? convertedDate
      : null;
  }

  const convertedDate = new Date(value);
  return Number.isNaN(convertedDate.getTime()) ? null : convertedDate;
}

function getDateTimeAttribute(value) {
  const date = toValidDate(value);
  return date ? date.toISOString() : undefined;
}

function scheduleDateTime(dateValue, timeValue) {
  const dateMatch = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(timeValue || "").trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  const scheduled = new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
  return Number.isNaN(scheduled.getTime()) ? null : scheduled;
}

function resolveScheduledCareWindow(sessionData, scheduledStart, scheduledEnd) {
  const start = scheduledStart || sessionData.scheduledStart || sessionData.startAt;
  const end = scheduledEnd || sessionData.scheduledEnd || sessionData.endAt;
  if (start || end) return { start, end };

  const derivedStart = scheduleDateTime(sessionData.scheduledDate, sessionData.scheduledTime);
  const durationHours = Number(sessionData.scheduledDurationHours);
  if (!derivedStart) return { start: "", end: "" };

  const derivedEnd = Number.isFinite(durationHours) && durationHours > 0
    ? new Date(derivedStart.getTime() + durationHours * 60 * 60 * 1000)
    : "";
  return { start: derivedStart, end: derivedEnd };
}

export function formatCareDateTime(value, options) {
  const date = toValidDate(value);
  if (!date) {
    return "";
  }

  const formatOptions = options || {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  };

  try {
    return new Intl.DateTimeFormat(undefined, formatOptions).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return value;
  }

  try {
    return new Intl.NumberFormat().format(number);
  } catch {
    return String(number);
  }
}

function resolveAction(action, fallbackLabel, fallbackHandler) {
  if (action) {
    if (typeof action === "function") {
      return {
        label: fallbackLabel,
        onClick: action,
      };
    }

    return {
      ...action,
      label: action.label || fallbackLabel,
    };
  }

  if (typeof fallbackHandler === "function") {
    return {
      label: fallbackLabel,
      onClick: fallbackHandler,
    };
  }

  return null;
}

function ActionControl({ action, className, onAction }) {
  if (!action || !action.label) {
    return null;
  }

  const handleClick = function handleClick(event) {
    if (typeof action.onClick === "function") {
      action.onClick(event);
    }
    if (typeof onAction === "function") {
      onAction(action, event);
    }
  };

  if (action.href) {
    return (
      <a
        className={joinClassNames("ce-action", className)}
        href={action.href}
        target={action.target}
        rel={action.target === "_blank" ? action.rel || "noreferrer" : action.rel}
        onClick={handleClick}
      >
        {action.label}
      </a>
    );
  }

  return (
    <button
      className={joinClassNames("ce-action", className)}
      type="button"
      disabled={Boolean(action.disabled)}
      onClick={handleClick}
    >
      {action.label}
    </button>
  );
}
function StatusSymbol({ tone }) {
  const symbol =
    tone === "complete" || tone === "positive" ? "✓" : tone === "danger" ? "!" : "•";

  return (
    <span className="ce-status-badge__symbol" aria-hidden="true">
      {symbol}
    </span>
  );
}

/**
 * A restrained, data-driven status indicator. Pass a custom statusMap when
 * the backend has additional authoritative statuses.
 */
export function StatusBadge({
  status,
  label,
  description,
  ariaLabel,
  statusMap,
  live,
  size = "default",
  className,
}) {
  const resolvedStatus = resolveCareStatus(status, statusMap);
  const displayLabel = label || resolvedStatus.label;
  const isLive = typeof live === "boolean" ? live : Boolean(resolvedStatus.live);
  const badgeDescription = description || resolvedStatus.description;

  return (
    <span
      className={joinClassNames(
        "ce-status-badge",
        "ce-status-badge--" + resolvedStatus.tone,
        "ce-status-badge--" + size,
        isLive && "ce-status-badge--live",
        className
      )}
      data-status={resolvedStatus.key}
      role={isLive ? "status" : undefined}
      aria-live={isLive ? "polite" : undefined}
      aria-label={ariaLabel || [displayLabel, badgeDescription].filter(Boolean).join(". ")}
      title={badgeDescription || undefined}
    >
      <StatusSymbol tone={resolvedStatus.tone} />
      <span>{displayLabel}</span>
    </span>
  );
}

function normalizeVerificationState(state) {
  if (state === true) {
    return "verified";
  }
  if (state === false) {
    return "not_verified";
  }

  const normalized = normalizeKey(
    state && typeof state === "object"
      ? state.state || state.status || state.verified
      : state
  );

  if (
    ["verified", "approved", "complete", "completed", "confirmed"].includes(
      normalized
    )
  ) {
    return "verified";
  }

  if (
    [
      "pending",
      "in_review",
      "under_review",
      "requested",
      "awaiting_review",
    ].includes(normalized)
  ) {
    return "pending";
  }

  if (
    [
      "not_verified",
      "unverified",
      "rejected",
      "incomplete",
      "expired",
      "not_started",
    ].includes(normalized)
  ) {
    return "not_verified";
  }

  return "unavailable";
}

/**
 * Converts verified/pending/not-verified data into a safe display state.
 * Missing or unknown values deliberately remain "unavailable".
 */
export function resolveVerificationState(state) {
  const key = normalizeVerificationState(state);
  return {
    ...VERIFICATION_STATES[key],
    key,
  };
}

function VerificationSymbol({ state }) {
  const symbol =
    state === "verified" ? "✓" : state === "pending" ? "…" : state === "not_verified" ? "–" : "?";

  return (
    <span className="ce-verification-badge__symbol" aria-hidden="true">
      {symbol}
    </span>
  );
}

function VerificationExplanation({ details, summaryLabel }) {
  if (!details) {
    return null;
  }

  const items = Array.isArray(details) ? details : [details];

  return (
    <details className="ce-verification-explanation">
      <summary>{summaryLabel || "What this means"}</summary>
      <div className="ce-verification-explanation__content">
        {items.length === 1 ? (
          <p>{items[0]}</p>
        ) : (
          <ul>
            {items.map(function renderDetail(detail, index) {
              return <li key={String(detail) + index}>{detail}</li>;
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * Renders only the verification state supplied by the caller. It never turns
 * an absent verification record into a green/verified claim.
 */
export function VerificationBadge({
  state,
  label,
  details,
  description,
  showDetails = false,
  detailsLabel,
  className,
  compact = false,
}) {
  const verification = resolveVerificationState(state);
  const badge = (
    <span
      className={joinClassNames(
        "ce-verification-badge",
        "ce-verification-badge--" + verification.tone,
        compact && "ce-verification-badge--compact",
        className
      )}
      data-verification-state={verification.key}
      aria-label={description || label || verification.label}
      title={description || undefined}
    >
      <VerificationSymbol state={verification.key} />
      <span>{label || verification.label}</span>
    </span>
  );

  if (!showDetails || !details) {
    return badge;
  }

  return (
    <div className="ce-verification-badge-with-details">
      {badge}
      <VerificationExplanation details={details} summaryLabel={detailsLabel} />
    </div>
  );
}

function normalizeVerificationItem(item, index) {
  const record = typeof item === "string" ? { label: item } : item || {};
  const rawState =
    record.state !== undefined
      ? record.state
      : record.status !== undefined
        ? record.status
        : record.verified;

  return {
    id: record.id || record.key || "verification-" + index,
    label: record.label || record.name || "Verification",
    state: rawState,
    details: record.details || record.description,
    verifiedAt: record.verifiedAt || record.completedAt,
    badgeLabel: record.badgeLabel,
  };
}

function MetricList({
  stats,
  experienceYears,
  completedSessions,
  rating,
  reviewCount,
  verifiedReviewCount,
  className,
}) {
  const defaultStats = [
    experienceYears !== null && experienceYears !== undefined
      ? {
          id: "experience",
          label: "Experience",
          value: formatCount(experienceYears),
          suffix: " years",
        }
      : null,
    completedSessions !== null && completedSessions !== undefined
      ? {
          id: "sessions",
          label: "Completed care sessions",
          value: formatCount(completedSessions),
        }
      : null,
    rating !== null && rating !== undefined
      ? {
          id: "rating",
          label: "Rating",
          value: formatCount(rating),
          suffix: " / 5",
        }
      : null,
    reviewCount !== null && reviewCount !== undefined
      ? {
          id: "reviews",
          label: "Reviews",
          value: formatCount(reviewCount),
        }
      : null,
    verifiedReviewCount !== null && verifiedReviewCount !== undefined
      ? {
          id: "verified-reviews",
          label: "Verified reviews",
          value: formatCount(verifiedReviewCount),
        }
      : null,
  ].filter(Boolean);
  const resolvedStats = Array.isArray(stats) ? stats : defaultStats;

  if (!resolvedStats.length) {
    return null;
  }

  return (
    <dl className={joinClassNames("ce-metric-list", className)}>
      {resolvedStats.map(function renderMetric(metric, index) {
        const record = metric || {};
        const value =
          record.value !== undefined && record.value !== null
            ? record.value
            : record.count !== undefined
              ? formatCount(record.count)
              : "—";

        return (
          <div className="ce-metric-list__item" key={record.id || record.label || index}>
            <dt>{record.label || "Metric"}</dt>
            <dd>
              {value}
              {record.suffix || ""}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function CaregiverStats(props) {
  return <MetricList {...props} />;
}

/**
 * Trust information for a caregiver profile or card. Prefer
 * verificationItems from the authorised verification record:
 * [{ id, label, state, details, verifiedAt }].
 */
export function CaregiverTrustSummary({
  caregiverName,
  summary,
  overallState,
  overallLabel,
  overallDescription,
  verificationItems = [],
  showVerificationDetails = true,
  verificationDetailsLabel,
  stats,
  experienceYears,
  completedSessions,
  rating,
  reviewCount,
  verifiedReviewCount,
  className,
  heading = "Trust and experience",
}) {
  const headingId = React.useId();
  const normalizedItems = Array.isArray(verificationItems)
    ? verificationItems.map(normalizeVerificationItem)
    : [];
  const hasOverallState = overallState !== null && overallState !== undefined;

  return (
    <section
      className={joinClassNames("ce-caregiver-trust", className)}
      aria-labelledby={headingId}
    >
      <div className="ce-caregiver-trust__header">
        <div>
          <p className="ce-eyebrow">Caregiver profile</p>
          <h2 id={headingId}>{heading}</h2>
          {caregiverName ? (
            <p className="ce-caregiver-trust__name">{caregiverName}</p>
          ) : null}
        </div>
        {hasOverallState ? (
          <VerificationBadge
            state={overallState}
            label={overallLabel}
            description={overallDescription}
            compact
          />
        ) : null}
      </div>

      {summary ? <p className="ce-caregiver-trust__summary">{summary}</p> : null}

      <MetricList
        stats={stats}
        experienceYears={experienceYears}
        completedSessions={completedSessions}
        rating={rating}
        reviewCount={reviewCount}
        verifiedReviewCount={verifiedReviewCount}
      />

      <div className="ce-caregiver-trust__verification">
        <h3>Verification</h3>
        {normalizedItems.length ? (
          <ul className="ce-verification-list">
            {normalizedItems.map(function renderVerification(item) {
              const verifiedAt = formatCareDateTime(item.verifiedAt);

              return (
                <li className="ce-verification-list__item" key={item.id}>
                  <div className="ce-verification-list__main">
                    <span className="ce-verification-list__label">{item.label}</span>
                    {verifiedAt ? (
                      <time
                        className="ce-verification-list__time"
                        dateTime={getDateTimeAttribute(item.verifiedAt)}
                      >
                        Recorded {verifiedAt}
                      </time>
                    ) : null}
                  </div>
                  <VerificationBadge
                    state={item.state}
                    label={item.badgeLabel}
                    details={item.details}
                    showDetails={showVerificationDetails}
                    detailsLabel={verificationDetailsLabel}
                    compact
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ce-inline-empty">
            Verification details are not available for this caregiver.
          </p>
        )}
      </div>
    </section>
  );
}

function normalizeTimelineState(state) {
  const normalized = normalizeKey(state);
  if (["complete", "completed", "done"].includes(normalized)) {
    return "complete";
  }
  if (["current", "active", "in_progress"].includes(normalized)) {
    return "current";
  }
  if (["skipped", "cancelled", "canceled"].includes(normalized)) {
    return "skipped";
  }
  return "upcoming";
}

function getTimelineEvent(stage, events) {
  if (!Array.isArray(events)) {
    return null;
  }

  const keys = [stage.id].concat(stage.statusKeys || []).map(normalizeKey);
  return (
    events.find(function findEvent(event) {
      const record = event || {};
      const eventKeys = [
        record.stageId,
        record.stage,
        record.id,
        record.status,
        record.key,
      ]
        .filter(Boolean)
        .map(normalizeKey);

      return eventKeys.some(function includesStageKey(eventKey) {
        return keys.includes(eventKey);
      });
    }) || null
  );
}

function getTimelineState(stage, event, statusInfo) {
  if (stage.state) {
    return normalizeTimelineState(stage.state);
  }
  if (event && event.state) {
    return normalizeTimelineState(event.state);
  }

  const statusMatchesStage = [stage.id].concat(stage.statusKeys || [])
    .map(normalizeKey)
    .includes(statusInfo.key);
  if (statusMatchesStage || statusInfo.journeyStage === stage.id) {
    return "current";
  }

  if (
    Number.isFinite(statusInfo.journeyRank) &&
    Number.isFinite(Number(stage.rank)) &&
    !statusInfo.terminal
  ) {
    if (Number(stage.rank) < statusInfo.journeyRank) {
      return "complete";
    }
    if (Number(stage.rank) === statusInfo.journeyRank) {
      return "current";
    }
  }

  return "upcoming";
}

function getTimelineTimestamp(stage, event) {
  return (
    (event &&
      (event.at ||
        event.timestamp ||
        event.createdAt ||
        event.completedAt ||
        event.updatedAt)) ||
    stage.at ||
    stage.timestamp ||
    stage.completedAt
  );
}

function getTimelineDescription(stage, event) {
  return (
    (event && (event.description || event.message || event.note)) ||
    stage.description ||
    ""
  );
}

function buildTimelineStages(stages, events, statusInfo) {
  const sourceStages = Array.isArray(stages) ? stages : [];
  const resolvedStages = sourceStages.map(function createStage(stage, index) {
    const record = stage || {};
    const event = getTimelineEvent(record, events);
    return {
      id: record.id || "stage-" + index,
      label: record.label || record.title || "Care update",
      timestamp: getTimelineTimestamp(record, event),
      description: getTimelineDescription(record, event),
      state: getTimelineState(record, event, statusInfo),
    };
  });

  const terminalAlreadyRendered = resolvedStages.some(function hasTerminal(stage) {
    return normalizeKey(stage.id) === statusInfo.key;
  });

  if (statusInfo.terminal && !terminalAlreadyRendered) {
    resolvedStages.push({
      id: statusInfo.key,
      label: statusInfo.label,
      description: statusInfo.description || "",
      state: "current",
    });
  }

  return resolvedStages;
}

function NextAction({ nextAction, onAction }) {
  if (!nextAction) {
    return null;
  }

  const action =
    typeof nextAction === "string"
      ? { description: nextAction }
      : nextAction;

  return (
    <aside className="ce-next-action" aria-label="What happens next">
      <div>
        <p className="ce-eyebrow">What happens next</p>
        {action.title ? <h3>{action.title}</h3> : null}
        {action.description ? <p>{action.description}</p> : null}
      </div>
      <ActionControl action={action.action} onAction={onAction} />
    </aside>
  );
}

/**
 * A customer-facing booking journey. The component can use the standard
 * mapping or exact event data when a record has an audit/status history.
 */
export function CareJourneyTimeline({
  status,
  stages = DEFAULT_CARE_JOURNEY_STAGES,
  events,
  nextAction,
  onNextAction,
  statusMap,
  heading = "Care journey",
  description,
  emptyMessage = "Care journey details are not available yet.",
  compact = false,
  className,
}) {
  const headingId = React.useId();
  const statusInfo = resolveCareStatus(status, statusMap);
  const timelineStages = buildTimelineStages(stages, events, statusInfo);

  return (
    <section
      className={joinClassNames(
        "ce-care-journey",
        compact && "ce-care-journey--compact",
        className
      )}
      aria-labelledby={headingId}
    >
      <div className="ce-section-heading">
        <div>
          <p className="ce-eyebrow">Booking status</p>
          <h2 id={headingId}>{heading}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <StatusBadge status={status} statusMap={statusMap} size="small" />
      </div>

      {timelineStages.length ? (
        <ol className="ce-timeline">
          {timelineStages.map(function renderStage(stage) {
            const timestamp = formatCareDateTime(stage.timestamp);
            const isCurrent = stage.state === "current";

            return (
              <li
                className={joinClassNames(
                  "ce-timeline__item",
                  "ce-timeline__item--" + stage.state
                )}
                key={stage.id}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="ce-timeline__marker" aria-hidden="true">
                  {stage.state === "complete" ? "✓" : null}
                </span>
                <div className="ce-timeline__content">
                  <h3>{stage.label}</h3>
                  {stage.description ? <p>{stage.description}</p> : null}
                  {timestamp ? (
                    <time
                      className="ce-timeline__time"
                      dateTime={getDateTimeAttribute(stage.timestamp)}
                    >
                      {timestamp}
                    </time>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ce-inline-empty">{emptyMessage}</p>
      )}

      <NextAction nextAction={nextAction} onAction={onNextAction} />
    </section>
  );
}

function resolveCurrentStepIndex(steps, currentStep) {
  if (typeof currentStep === "number" && Number.isFinite(currentStep)) {
    return Math.max(0, Math.min(steps.length - 1, Math.floor(currentStep)));
  }

  if (typeof currentStep === "string") {
    const foundIndex = steps.findIndex(function findStep(step) {
      return step && step.id === currentStep;
    });
    return foundIndex >= 0 ? foundIndex : 0;
  }

  return 0;
}

function resolveBookingStepState(step, index, currentIndex, completedSteps) {
  if (step.state) {
    return normalizeTimelineState(step.state);
  }

  if (
    Array.isArray(completedSteps) &&
    completedSteps.some(function hasCompletedStep(completedStep) {
      return completedStep === step.id || completedStep === index;
    })
  ) {
    return "complete";
  }

  if (index < currentIndex) {
    return "complete";
  }

  if (index === currentIndex) {
    return "current";
  }

  return "upcoming";
}

/**
 * Four-step booking progress with optional, caller-controlled navigation.
 * onStepChange receives (step, index, event); no route behaviour is built in.
 */
export function BookingStepper({
  steps = DEFAULT_BOOKING_STEPS,
  currentStep = 0,
  completedSteps,
  onStepChange,
  allowStepNavigation = false,
  heading = "Book care",
  description,
  ariaLabel = "Booking progress",
  className,
}) {
  const validSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];
  const currentIndex = resolveCurrentStepIndex(validSteps, currentStep);
  const headingId = React.useId();

  if (!validSteps.length) {
    return null;
  }

  return (
    <nav
      className={joinClassNames("ce-booking-stepper", className)}
      aria-labelledby={headingId}
      aria-label={ariaLabel}
    >
      <div className="ce-booking-stepper__heading">
        <div>
          <p className="ce-eyebrow">Booking</p>
          <h2 id={headingId}>{heading}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <span className="ce-booking-stepper__count" aria-live="polite">
          Step {currentIndex + 1} of {validSteps.length}
        </span>
      </div>

      <ol className="ce-booking-stepper__list">
        {validSteps.map(function renderStep(step, index) {
          const state = resolveBookingStepState(
            step,
            index,
            currentIndex,
            completedSteps
          );
          const canNavigate =
            typeof onStepChange === "function" &&
            !step.disabled &&
            (allowStepNavigation || index <= currentIndex);
          const label = step.label || step.title || "Step " + (index + 1);
          const clickStep = function clickStep(event) {
            if (canNavigate) {
              onStepChange(step, index, event);
            }
          };
          const content = (
            <>
              <span className="ce-booking-stepper__number" aria-hidden="true">
                {state === "complete" ? "✓" : index + 1}
              </span>
              <span className="ce-booking-stepper__copy">
                <strong>{step.shortLabel || label}</strong>
                {step.description ? <small>{step.description}</small> : null}
              </span>
            </>
          );

          return (
            <li
              className={joinClassNames(
                "ce-booking-stepper__item",
                "ce-booking-stepper__item--" + state,
                canNavigate && "ce-booking-stepper__item--interactive"
              )}
              key={step.id || index}
              aria-current={state === "current" ? "step" : undefined}
            >
              {canNavigate ? (
                <button
                  type="button"
                  onClick={clickStep}
                  aria-label={"Go to " + label}
                >
                  {content}
                </button>
              ) : (
                <span className="ce-booking-stepper__static">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function normalizeTaskState(task) {
  const record = task || {};
  const rawState =
    record.state !== undefined
      ? record.state
      : record.status !== undefined
        ? record.status
        : record.completed;

  if (rawState === true) {
    return "complete";
  }
  if (rawState === false) {
    return "pending";
  }

  const normalized = normalizeKey(rawState);
  if (["complete", "completed", "done"].includes(normalized)) {
    return "complete";
  }
  if (["active", "in_progress", "inprogress"].includes(normalized)) {
    return "active";
  }
  if (["pending", "todo", "not_started", "open"].includes(normalized)) {
    return "pending";
  }
  if (["skipped", "not_required"].includes(normalized)) {
    return "skipped";
  }
  return "unknown";
}

function getTaskStateLabel(state) {
  if (state === "complete") {
    return "Completed";
  }
  if (state === "active") {
    return "In progress";
  }
  if (state === "pending") {
    return "Not completed";
  }
  if (state === "skipped") {
    return "Not required";
  }
  return "Status not recorded";
}

/**
 * Read-only by default. Supply onTaskSelect only when the caller has a real,
 * authorised task action to perform.
 */
export function CareChecklist({
  tasks = [],
  onTaskSelect,
  heading,
  emptyMessage = "No care tasks have been shared yet.",
  className,
}) {
  const validTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const headingId = React.useId();

  return (
    <section
      className={joinClassNames("ce-care-checklist", className)}
      aria-labelledby={heading ? headingId : undefined}
    >
      {heading ? <h2 id={headingId}>{heading}</h2> : null}
      {validTasks.length ? (
        <ul className="ce-care-checklist__list">
          {validTasks.map(function renderTask(task, index) {
            const state = normalizeTaskState(task);
            const label = task.label || task.task || task.name || "Care task";
            const completedAt = formatCareDateTime(
              task.completedAt || task.updatedAt
            );
            const taskContent = (
              <>
                <span
                  className={joinClassNames(
                    "ce-care-checklist__indicator",
                    "ce-care-checklist__indicator--" + state
                  )}
                  aria-hidden="true"
                >
                  {state === "complete" ? "✓" : state === "active" ? "•" : ""}
                </span>
                <span className="ce-care-checklist__copy">
                  <strong>{label}</strong>
                  <small>
                    {getTaskStateLabel(state)}
                    {completedAt ? " · " + completedAt : ""}
                  </small>
                </span>
              </>
            );

            return (
              <li key={task.id || task.key || index}>
                {typeof onTaskSelect === "function" ? (
                  <button
                    type="button"
                    className="ce-care-checklist__button"
                    onClick={function onClick(event) {
                      onTaskSelect(task, index, event);
                    }}
                    aria-label={label + ". " + getTaskStateLabel(state)}
                  >
                    {taskContent}
                  </button>
                ) : (
                  <div className="ce-care-checklist__item">{taskContent}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ce-inline-empty">{emptyMessage}</p>
      )}
    </section>
  );
}

function normalizeUpdates(updates) {
  if (!Array.isArray(updates)) {
    return [];
  }

  return updates
    .filter(Boolean)
    .map(function addUpdateMetadata(update, index) {
      const record = typeof update === "string" ? { message: update } : update;
      const timestamp =
        record.createdAt ||
        record.timestamp ||
        record.at ||
        record.updatedAt ||
        record.time;

      return {
        ...record,
        id: record.id || "update-" + index,
        timestamp,
        sortTime: toValidDate(timestamp),
        index,
      };
    })
    .sort(function sortNewestFirst(left, right) {
      if (left.sortTime && right.sortTime) {
        return right.sortTime.getTime() - left.sortTime.getTime();
      }
      return left.index - right.index;
    });
}

export function CareUpdateTimeline({
  updates = [],
  heading,
  emptyMessage = "No care updates have been shared yet.",
  limit,
  className,
}) {
  const headingId = React.useId();
  const normalizedUpdates = normalizeUpdates(updates);
  const displayedUpdates =
    typeof limit === "number" && limit > 0
      ? normalizedUpdates.slice(0, limit)
      : normalizedUpdates;

  return (
    <section
      className={joinClassNames("ce-care-updates", className)}
      aria-labelledby={heading ? headingId : undefined}
    >
      {heading ? <h2 id={headingId}>{heading}</h2> : null}
      {displayedUpdates.length ? (
        <ol className="ce-care-updates__list">
          {displayedUpdates.map(function renderUpdate(update) {
            const timestamp = formatCareDateTime(update.timestamp);
            const updateType = update.type || update.label;
            const message = update.message || update.note || update.description;

            return (
              <li className="ce-care-updates__item" key={update.id}>
                <span className="ce-care-updates__marker" aria-hidden="true" />
                <div>
                  <div className="ce-care-updates__meta">
                    {timestamp ? (
                      <time dateTime={getDateTimeAttribute(update.timestamp)}>
                        {timestamp}
                      </time>
                    ) : null}
                    {updateType ? <span>{updateType}</span> : null}
                  </div>
                  {message ? <p>{message}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ce-inline-empty">{emptyMessage}</p>
      )}
    </section>
  );
}

function getInitials(value) {
  if (!value) {
    return "CG";
  }

  return String(value)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function initial(part) {
      return part.charAt(0).toUpperCase();
    })
    .join("");
}

function getActiveCareHeading(statusInfo, heading) {
  if (heading) {
    return heading;
  }
  if (statusInfo.key === "unknown") {
    return "Care session";
  }
  return statusInfo.label;
}

/**
 * Customer-facing active-care card. It presents only supplied session fields;
 * no check-in time, task, update, or live state is fabricated.
 */
export function ActiveCareCard({
  session,
  caregiver,
  status,
  statusMap,
  heading,
  service,
  caregiverName,
  caregiverImage,
  checkedInAt,
  checkedOutAt,
  scheduledStart,
  scheduledEnd,
  tasks,
  updates,
  latestUpdateLimit = 3,
  carePlanHeading = "Care plan",
  updatesHeading = "Care updates",
  showTaskEmptyState = false,
  messageAction,
  supportAction,
  onMessageCaregiver,
  onContactSupport,
  onTaskSelect,
  footer,
  className,
}) {
  const headingId = React.useId();
  const sessionData = session && typeof session === "object" ? session : {};
  const caregiverData =
    caregiver && typeof caregiver === "object"
      ? caregiver
      : sessionData.caregiver && typeof sessionData.caregiver === "object"
        ? sessionData.caregiver
        : {};
  const actualStatus =
    status !== undefined && status !== null ? status : sessionData.status;
  const statusInfo = resolveCareStatus(actualStatus, statusMap);
  const actualCaregiverName =
    caregiverName ||
    caregiverData.name ||
    caregiverData.displayName ||
    sessionData.caregiverName ||
    "";
  const actualCaregiverImage =
    caregiverImage ||
    caregiverData.photoURL ||
    caregiverData.photoUrl ||
    caregiverData.image ||
    sessionData.caregiverImage ||
    "";
  const actualService = service || sessionData.service || sessionData.serviceName || "";
  const actualCheckedInAt =
    checkedInAt || sessionData.actualCheckIn || sessionData.checkedInAt;
  const actualCheckedOutAt =
    checkedOutAt || sessionData.actualCheckOut || sessionData.checkedOutAt;
  const scheduledWindow = resolveScheduledCareWindow(
    sessionData,
    scheduledStart,
    scheduledEnd,
  );
  const actualScheduledStart = scheduledWindow.start;
  const actualScheduledEnd = scheduledWindow.end;
  const actualTasks = tasks !== undefined ? tasks : sessionData.tasks;
  const actualUpdates = updates !== undefined ? updates : sessionData.updates;
  const resolvedMessageAction = resolveAction(
    messageAction,
    "Message caregiver",
    onMessageCaregiver
  );
  const resolvedSupportAction = resolveAction(
    supportAction,
    "Contact support",
    onContactSupport
  );
  const hasScheduleDetails =
    actualCheckedInAt ||
    actualCheckedOutAt ||
    actualScheduledStart ||
    actualScheduledEnd;
  const hasTasks = Array.isArray(actualTasks) && actualTasks.length > 0;
  const hasUpdates = Array.isArray(actualUpdates) && actualUpdates.length > 0;

  return (
    <article
      className={joinClassNames("ce-active-care-card", className)}
      aria-labelledby={headingId}
    >
      <header className="ce-active-care-card__header">
        <div>
          <p className="ce-eyebrow">Care session</p>
          <h2 id={headingId}>{getActiveCareHeading(statusInfo, heading)}</h2>
        </div>
        <StatusBadge
          status={actualStatus}
          statusMap={statusMap}
          live={statusInfo.live}
        />
      </header>

      <div className="ce-active-care-card__caregiver">
        {actualCaregiverImage ? (
          <img
            className="ce-active-care-card__avatar"
            src={actualCaregiverImage}
            alt={actualCaregiverName ? actualCaregiverName + ", caregiver" : "Caregiver"}
          />
        ) : (
          <span className="ce-active-care-card__avatar ce-active-care-card__avatar--fallback" aria-hidden="true">
            {getInitials(actualCaregiverName)}
          </span>
        )}
        <div>
          <p className="ce-active-care-card__caregiver-label">Providing care</p>
          <h3>{actualCaregiverName || "Caregiver details unavailable"}</h3>
          {actualService ? <p>{actualService}</p> : null}
        </div>
      </div>

      {hasScheduleDetails ? (
        <dl className="ce-active-care-card__schedule">
          {actualCheckedInAt ? (
            <div>
              <dt>Checked in</dt>
              <dd>
                <time dateTime={getDateTimeAttribute(actualCheckedInAt)}>
                  {formatCareDateTime(actualCheckedInAt)}
                </time>
              </dd>
            </div>
          ) : null}
          {actualScheduledStart || actualScheduledEnd ? (
            <div>
              <dt>Scheduled</dt>
              <dd>
                {actualScheduledStart ? (
                  <time dateTime={getDateTimeAttribute(actualScheduledStart)}>
                    {formatCareDateTime(actualScheduledStart)}
                  </time>
                ) : null}
                {actualScheduledStart && actualScheduledEnd ? " – " : null}
                {actualScheduledEnd ? (
                  <time dateTime={getDateTimeAttribute(actualScheduledEnd)}>
                    {formatCareDateTime(actualScheduledEnd)}
                  </time>
                ) : null}
              </dd>
            </div>
          ) : null}
          {actualCheckedOutAt ? (
            <div>
              <dt>Checked out</dt>
              <dd>
                <time dateTime={getDateTimeAttribute(actualCheckedOutAt)}>
                  {formatCareDateTime(actualCheckedOutAt)}
                </time>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {hasTasks || showTaskEmptyState ? (
        <CareChecklist
          tasks={actualTasks}
          heading={carePlanHeading}
          onTaskSelect={onTaskSelect}
        />
      ) : null}

      {hasUpdates ? (
        <CareUpdateTimeline
          updates={actualUpdates}
          heading={updatesHeading}
          limit={latestUpdateLimit}
        />
      ) : null}

      {resolvedMessageAction || resolvedSupportAction ? (
        <div className="ce-active-care-card__actions">
          <ActionControl
            action={resolvedMessageAction}
            className="ce-action--primary"
          />
          <ActionControl action={resolvedSupportAction} />
        </div>
      ) : null}

      {footer ? <div className="ce-active-care-card__footer">{footer}</div> : null}
    </article>
  );
}

export function CareSessionStatus({ session, status, statusMap, ...props }) {
  const sessionStatus =
    status !== undefined ? status : session && typeof session === "object" ? session.status : undefined;
  return <StatusBadge status={sessionStatus} statusMap={statusMap} {...props} />;
}

function dimensionStyle(width, height) {
  const style = {};
  if (width !== undefined) {
    style.width = typeof width === "number" ? width + "px" : width;
  }
  if (height !== undefined) {
    style.height = typeof height === "number" ? height + "px" : height;
  }
  return style;
}

export function SkeletonBlock({
  width,
  height,
  rounded = "medium",
  className,
  label = "Loading content",
}) {
  return (
    <span
      className={joinClassNames(
        "ce-skeleton-block",
        "ce-skeleton-block--" + rounded,
        className
      )}
      style={dimensionStyle(width, height)}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="ce-visually-hidden">{label}</span>
    </span>
  );
}

/**
 * Structure-matched loading placeholders. Variants: caregiver, dashboard,
 * booking, and care. They have no implied data or status.
 */
export function SkeletonCard({
  variant = "caregiver",
  lines = 3,
  className,
  label = "Loading content",
}) {
  const safeLines = Math.max(1, Math.min(6, Number(lines) || 3));

  return (
    <div
      className={joinClassNames(
        "ce-skeleton-card",
        "ce-skeleton-card--" + variant,
        className
      )}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="ce-visually-hidden">{label}</span>
      <div className="ce-skeleton-card__header">
        <span className="ce-skeleton-card__avatar" aria-hidden="true" />
        <div className="ce-skeleton-card__identity" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
      <div className="ce-skeleton-card__body" aria-hidden="true">
        {Array.from({ length: safeLines }).map(function renderLine(_, index) {
          return <span key={index} />;
        })}
      </div>
      <span className="ce-skeleton-card__action" aria-hidden="true" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  children,
  compact = false,
  className,
}) {
  const headingId = React.useId();
  const resolvedAction = resolveAction(action, actionLabel, onAction);

  return (
    <section
      className={joinClassNames(
        "ce-empty-state",
        compact && "ce-empty-state--compact",
        className
      )}
      aria-labelledby={headingId}
    >
      {icon ? (
        <span className="ce-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {title ? <h2 id={headingId}>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      {children ? <div className="ce-empty-state__content">{children}</div> : null}
      <ActionControl action={resolvedAction} className="ce-action--primary" />
    </section>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retryAction,
  retryLabel = "Try again",
  onRetry,
  className,
}) {
  const headingId = React.useId();
  const action = resolveAction(retryAction, retryLabel, onRetry);

  return (
    <section
      className={joinClassNames("ce-error-state", className)}
      role="alert"
      aria-labelledby={headingId}
    >
      <span className="ce-error-state__icon" aria-hidden="true">
        !
      </span>
      <div>
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <ActionControl action={action} />
    </section>
  );
}
