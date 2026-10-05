"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download,
  ExternalLink, FileText, Globe2, Link2, LoaderCircle, LockKeyhole, LogOut, MessageSquareText,
  List, Pencil, Plus, Settings2, Sparkles, Trash2, X,
} from "lucide-react";
import { UploadDropzone } from "@/lib/uploadthing";
import { formatInterviewTime, getZonedDateKey, localInputToUtc, relativeStartLabel } from "@/lib/time";
import type { DashboardData, Interview, InterviewStatus, ResumeFile } from "@/lib/types";

const statusLabels: Record<InterviewStatus, string> = {
  UPCOMING: "Upcoming", DONE: "Done", CANCELED: "Canceled", FAILED: "Failed", RESCHEDULED: "Rescheduled",
};
const finalStatuses = ["DONE", "CANCELED", "FAILED", "RESCHEDULED"] as const;
const commonTimezones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

function interviewName(interview: Interview) {
  return interview.resume.name.replace(/\.(pdf|docx?)$/i, "").replace(/[_-]+/g, " ");
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [selected, setSelected] = useState<Interview | null>(null);
  const [editing, setEditing] = useState<Interview | null | undefined>(undefined);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Interview | null>(null);
  const [viewMode, setViewMode] = useState<"OVERVIEW" | "CALENDAR">("OVERVIEW");
  const [newInterviewTime, setNewInterviewTime] = useState<string | undefined>();
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function refresh(message?: string) {
    setRefreshing(true);
    try {
      const next = await requestJson("/api/interviews", { cache: "no-store" });
      setData(next);
      setSelected((current) => current ? next.interviews.find((item: Interview) => item.id === current.id) ?? null : null);
      if (message) {
        setToast(message);
        window.setTimeout(() => setToast(""), 3500);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    await requestJson("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isCoordinator = data.user.role === "COORDINATOR";
  return (
    <main className="shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mini">✦</span><span>handoff</span></div>
        <div className="header-context">
          <span className="workspace-name">{data.user.workspaceName}</span>
          <span className="role-pill">{isCoordinator ? "Coordinator" : "Interviewer"}</span>
        </div>
        <div className="header-actions">
          <WorkspaceClock timezone={data.user.timezone} />
          <button className="timezone-chip" onClick={() => isCoordinator && setTimezoneOpen(true)} title={isCoordinator ? "Change workspace timezone" : "Workspace timezone"}>
            <Globe2 size={15} /> {data.user.timezone.replace("America/", "").replace("_", " ")}
            {isCoordinator && <Settings2 size={14} />}
          </button>
          <span className="avatar" aria-hidden="true">{data.user.displayName.charAt(0)}</span>
          <button className="icon-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="welcome-row">
        <div>
          <p className="eyebrow">{formatInTimeZone(now, data.user.timezone, "EEEE, MMMM d")}</p>
          <h1>{isCoordinator ? "Keep the handoff smooth." : `Hi, ${data.user.displayName.split(" ")[0]}! You’re all set.`}</h1>
        </div>
        <div className="welcome-actions">
          <div className="view-switcher" role="group" aria-label="Dashboard view">
            <button className={viewMode === "OVERVIEW" ? "active" : ""} onClick={() => setViewMode("OVERVIEW")}><List size={16} /> Overview</button>
            <button className={viewMode === "CALENDAR" ? "active" : ""} onClick={() => setViewMode("CALENDAR")}><CalendarDays size={16} /> Calendar</button>
          </div>
          {isCoordinator && <button className="button button-primary button-large" onClick={() => { setNewInterviewTime(undefined); setEditing(null); }}><Plus size={20} /> Schedule interview</button>}
        </div>
      </div>

      {viewMode === "CALENDAR" ? (
        <CalendarView interviews={data.interviews} timezone={data.user.timezone} now={now} canSchedule={isCoordinator} onOpen={setSelected} onCreate={(localDateTime) => { setNewInterviewTime(localDateTime); setEditing(null); }} />
      ) : isCoordinator ? (
        <CoordinatorView interviews={data.interviews} timezone={data.user.timezone} onOpen={setSelected} onEdit={(item) => setEditing(item)} onDelete={setDeleteTarget} now={now} />
      ) : (
        <InterviewerView interviews={data.interviews} timezone={data.user.timezone} onOpen={setSelected} now={now} />
      )}

      {selected && <InterviewDetails interview={selected} timezone={data.user.timezone} role={data.user.role} now={now} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={() => { setDeleteTarget(selected); setSelected(null); }} onChanged={refresh} />}
      {editing !== undefined && <ScheduleModal interview={editing} initialDateTime={newInterviewTime} timezone={data.user.timezone} onClose={() => { setEditing(undefined); setNewInterviewTime(undefined); }} onSaved={async () => { setEditing(undefined); setNewInterviewTime(undefined); await refresh(editing ? "Interview updated." : "Interview scheduled and ready for handoff."); }} />}
      {timezoneOpen && <TimezoneModal current={data.user.timezone} onClose={() => setTimezoneOpen(false)} onSaved={async () => { setTimezoneOpen(false); await refresh("Workspace timezone updated."); }} />}
      {deleteTarget && <DeleteDialog interview={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={async () => { setDeleteTarget(null); await refresh("Interview deleted."); }} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
      {refreshing && <div className="refresh-dot" aria-label="Refreshing"><LoaderCircle className="spin" size={16} /></div>}
    </main>
  );
}

function WorkspaceClock({ timezone }: { timezone: string }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setCurrentTime(new Date());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="workspace-clock" aria-label={`Current time in ${timezone}`}>
      <Clock3 size={16} />
      <span>{currentTime ? formatInTimeZone(currentTime, timezone, "h:mm:ss a") : "--:--:--"}</span>
      <small>{currentTime ? formatInTimeZone(currentTime, timezone, "zzz") : ""}</small>
    </div>
  );
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonthKey(dateKey: string, months: number) {
  const date = new Date(`${dateKey.slice(0, 8)}01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return shiftDateKey(dateKey, -((date.getUTCDay() + 6) % 7));
}

function dateKeyLabel(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function hourLabel(hour: number) {
  return `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
}

function CalendarView({ interviews, timezone, now, canSchedule, onOpen, onCreate }: ViewProps & { canSchedule: boolean; onCreate: (localDateTime: string) => void }) {
  const todayKey = getZonedDateKey(now, timezone);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarMode, setCalendarMode] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  const scrollArea = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = shiftDateKey(weekStart, 6);
  const days = calendarMode === "DAY" ? [selectedDate] : Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index));
  const visibleStart = days[0];
  const visibleEnd = days[days.length - 1];
  const visibleInterviews = interviews.filter((item) => {
    const key = getZonedDateKey(item.scheduledAt, timezone);
    return key >= visibleStart && key <= visibleEnd;
  });
  const interviewHours = visibleInterviews.map((item) => Number(formatInTimeZone(item.scheduledAt, timezone, "H")));
  const startHour = Math.max(0, Math.min(7, interviewHours.length ? Math.min(...interviewHours) : 7));
  const latestEnd = visibleInterviews.map((item) => Number(formatInTimeZone(new Date(+new Date(item.scheduledAt) + item.durationMinutes * 60_000), timezone, "H")) + 1);
  const endHour = Math.min(24, Math.max(20, latestEnd.length ? Math.max(...latestEnd) : 20));
  const pixelsPerHour = 68;
  const gridHeight = (endHour - startHour) * pixelsPerHour;
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const slots = Array.from({ length: (endHour - startHour) * 2 }, (_, index) => index);
  const monthStart = `${selectedDate.slice(0, 8)}01`;
  const monthDays = Array.from({ length: 42 }, (_, index) => shiftDateKey(startOfWeek(monthStart), index));
  const selectedMonth = selectedDate.slice(0, 7);

  useEffect(() => {
    if (calendarMode === "MONTH") return;
    const element = scrollArea.current;
    if (!element) return;
    const currentHour = Number(formatInTimeZone(new Date(), timezone, "H"));
    element.scrollTop = Math.max(0, (currentHour - startHour - 1) * pixelsPerHour);
  }, [calendarMode, startHour, timezone]);

  const rangeLabel = calendarMode === "DAY"
    ? dateKeyLabel(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : calendarMode === "MONTH"
      ? dateKeyLabel(monthStart, { month: "long", year: "numeric" })
      : `${dateKeyLabel(weekStart, { month: "short", day: "numeric" })} – ${dateKeyLabel(weekEnd, { month: "short", day: "numeric", year: "numeric" })}`;

  function navigate(direction: -1 | 1) {
    setSelectedDate((date) => calendarMode === "DAY" ? shiftDateKey(date, direction) : calendarMode === "WEEK" ? shiftDateKey(date, direction * 7) : shiftMonthKey(date, direction));
  }

  return (
    <section className="calendar-section" aria-label={`${calendarMode.toLowerCase()} interview calendar`}>
      <div className="calendar-toolbar">
        <div>
          <p className="eyebrow">INTERVIEW CALENDAR</p>
          <h2>{rangeLabel}</h2>
          <small>Times shown in {timezone.replaceAll("_", " ")}</small>
        </div>
        <div className="calendar-controls">
          <label className="calendar-date-picker"><CalendarDays size={15} /><span>Go to</span><input type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} /></label>
          <div className="calendar-mode-switch" role="group" aria-label="Calendar period">
            {(["DAY", "WEEK", "MONTH"] as const).map((mode) => <button key={mode} className={calendarMode === mode ? "active" : ""} aria-pressed={calendarMode === mode} onClick={() => setCalendarMode(mode)}>{mode.charAt(0) + mode.slice(1).toLowerCase()}</button>)}
          </div>
          <div className="calendar-nav">
            <button className="button button-ghost" onClick={() => setSelectedDate(todayKey)}>Today</button>
            <button className="icon-button calendar-nav-button" onClick={() => navigate(-1)} aria-label={`Previous ${calendarMode.toLowerCase()}`}><ChevronLeft /></button>
            <button className="icon-button calendar-nav-button" onClick={() => navigate(1)} aria-label={`Next ${calendarMode.toLowerCase()}`}><ChevronRight /></button>
          </div>
        </div>
      </div>
      {canSchedule && <p className="calendar-tip"><Plus size={14} /> Click an empty {calendarMode === "MONTH" ? "date" : "time"} to schedule an interview.</p>}
      {calendarMode === "MONTH" ? (
        <div className="month-calendar">
          <div className="month-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="month-grid">{monthDays.map((day) => {
            const dayInterviews = interviews.filter((item) => getZonedDateKey(item.scheduledAt, timezone) === day).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
            return <div key={day} className={`month-cell ${day.slice(0, 7) !== selectedMonth ? "outside" : ""} ${day === todayKey ? "today" : ""}`}>
              {canSchedule && <button className="month-add-target" onClick={() => onCreate(`${day}T10:00`)} aria-label={`Schedule interview on ${dateKeyLabel(day, { weekday: "long", month: "long", day: "numeric" })}`} />}
              <span className="month-date">{dateKeyLabel(day, { day: "numeric" })}</span>
              <div className="month-events">{dayInterviews.slice(0, 3).map((item) => <button key={item.id} className={`month-event calendar-event-${item.status.toLowerCase()}`} onClick={() => onOpen(item)} title={`${formatInterviewTime(item.scheduledAt, timezone)} · ${interviewName(item)}`}><b>{formatInTimeZone(item.scheduledAt, timezone, "h:mm a")}</b><span>{interviewName(item)}</span></button>)}{dayInterviews.length > 3 && <small>+{dayInterviews.length - 3} more</small>}</div>
            </div>;
          })}</div>
        </div>
      ) : (
        <div className="calendar-frame">
          <div className={`calendar-scroll ${calendarMode === "DAY" ? "day-mode" : "week-mode"}`} ref={scrollArea}>
            <div className="calendar-days-header" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(110px, 1fr))` }}>
              <div className="calendar-timezone">{formatInTimeZone(now, timezone, "zzz")}</div>
              {days.map((day) => <div key={day} className={day === todayKey ? "calendar-day-heading today" : "calendar-day-heading"}><span>{dateKeyLabel(day, { weekday: "short" })}</span><b>{dateKeyLabel(day, { day: "numeric" })}</b></div>)}
            </div>
            <div className="calendar-body" style={{ height: gridHeight }}>
              <div className="calendar-time-axis">{hours.map((hour) => <span key={hour} style={{ top: (hour - startHour) * pixelsPerHour }}>{hourLabel(hour)}</span>)}</div>
              <div className="calendar-day-columns" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(110px, 1fr))` }}>
                {days.map((day) => {
                  const dayInterviews = visibleInterviews.filter((item) => getZonedDateKey(item.scheduledAt, timezone) === day);
                  const currentMinutes = Number(formatInTimeZone(now, timezone, "H")) * 60 + Number(formatInTimeZone(now, timezone, "m"));
                  const currentTop = ((currentMinutes - startHour * 60) / 60) * pixelsPerHour;
                  return <div className={day === todayKey ? "calendar-day-column today" : "calendar-day-column"} key={day}>
                    {hours.map((hour) => <i className="calendar-hour-line" key={hour} style={{ top: (hour - startHour) * pixelsPerHour }} />)}
                    {canSchedule && slots.map((slot) => {
                      const totalMinutes = startHour * 60 + slot * 30;
                      const hour = Math.floor(totalMinutes / 60);
                      const minute = totalMinutes % 60;
                      const localDateTime = `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                      return <button key={slot} className="calendar-slot" style={{ top: slot * pixelsPerHour / 2, height: pixelsPerHour / 2 }} onClick={() => onCreate(localDateTime)} aria-label={`Schedule interview ${dateKeyLabel(day, { weekday: "long", month: "long", day: "numeric" })} at ${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`} />;
                    })}
                    {day === todayKey && currentTop >= 0 && currentTop <= gridHeight && <div className="calendar-now-line" style={{ top: currentTop }}><span /></div>}
                    {dayInterviews.map((item, index) => {
                      const hour = Number(formatInTimeZone(item.scheduledAt, timezone, "H"));
                      const minute = Number(formatInTimeZone(item.scheduledAt, timezone, "m"));
                      const top = (((hour * 60 + minute) - startHour * 60) / 60) * pixelsPerHour;
                      const height = Math.max(30, item.durationMinutes / 60 * pixelsPerHour);
                      return <button key={item.id} className={`calendar-event calendar-event-${item.status.toLowerCase()}`} style={{ top, height, left: 4 + (index % 3) * 3 }} onClick={() => onOpen(item)} title={`${interviewName(item)} · ${formatInterviewTime(item.scheduledAt, timezone)}`}><strong>{formatInTimeZone(item.scheduledAt, timezone, "h:mm a")}</strong><span>{interviewName(item)}</span>{item.interviewerConfirmedAt && <Check size={11} />}</button>;
                    })}
                  </div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CoordinatorView({ interviews, timezone, onOpen, onEdit, onDelete, now }: ViewProps & { onEdit: (i: Interview) => void; onDelete: (i: Interview) => void }) {
  const [filter, setFilter] = useState<"ALL" | InterviewStatus>("ALL");
  const filterValues: Array<"ALL" | InterviewStatus> = ["ALL", "UPCOMING", "DONE", "CANCELED", "FAILED", "RESCHEDULED"];
  const awaiting = interviews.filter((item) => item.feedback && !item.feedbackConfirmedAt);
  const unconfirmed = interviews.filter((item) => item.status === "UPCOMING" && !item.interviewerConfirmedAt);
  const visible = interviews.filter((item) => filter === "ALL" || item.status === filter).sort((a, b) => {
    const futureA = new Date(a.scheduledAt) >= now;
    const futureB = new Date(b.scheduledAt) >= now;
    if (futureA && futureB) return +new Date(a.scheduledAt) - +new Date(b.scheduledAt);
    return +new Date(b.scheduledAt) - +new Date(a.scheduledAt);
  });

  return <>
    <section className="summary-grid" aria-label="Workspace summary">
      <SummaryCard icon={<Clock3 />} tone="peach" count={unconfirmed.length} label="Waiting for interviewer" hint="Unconfirmed handoffs" />
      <SummaryCard icon={<MessageSquareText />} tone="lilac" count={awaiting.length} label="Feedback to review" hint={awaiting.length ? "Needs your confirmation" : "Nothing waiting—nice!"} />
      <SummaryCard icon={<Check />} tone="mint" count={interviews.filter((i) => i.feedbackConfirmedAt).length} label="Closed loops" hint="Feedback confirmed" />
    </section>

    {awaiting.length > 0 && <section className="section-block callout-section">
      <div className="section-title"><div><p className="eyebrow">YOUR TURN</p><h2>Feedback ready for review</h2></div><span className="count-bubble">{awaiting.length}</span></div>
      <div className="card-grid">{awaiting.map((item) => <InterviewCard key={item.id} interview={item} timezone={timezone} onOpen={onOpen} emphasized />)}</div>
    </section>}

    <section className="section-block">
      <div className="section-title section-title-wrap">
        <div><p className="eyebrow">INTERVIEW LIBRARY</p><h2>Everything in one place</h2></div>
        <div className="filter-row" role="group" aria-label="Filter interviews">
          {filterValues.map((value) => <button key={value} className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value)}>{value === "ALL" ? "All" : statusLabels[value]}</button>)}
        </div>
      </div>
      {visible.length ? <div className="list-stack">{visible.map((item) => <InterviewRow key={item.id} interview={item} timezone={timezone} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}</div> : <EmptyState title="No interviews here yet" text="Try another filter or schedule something new." />}
    </section>
  </>;
}

type ViewProps = { interviews: Interview[]; timezone: string; onOpen: (i: Interview) => void; now: Date };
function InterviewerView({ interviews, timezone, onOpen, now }: ViewProps) {
  const todayKey = getZonedDateKey(now, timezone);
  const activeUpcoming = interviews.filter((item) => item.status === "UPCOMING" && (+new Date(item.scheduledAt) + item.durationMinutes * 60_000) > +now);
  const next = activeUpcoming[0];
  const today = interviews.filter((item) => getZonedDateKey(item.scheduledAt, timezone) === todayKey).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const future = interviews.filter((item) => item.status === "UPCOMING" && getZonedDateKey(item.scheduledAt, timezone) > todayKey);
  const history = interviews.filter((item) => item.status !== "UPCOMING" || (+new Date(item.scheduledAt) + item.durationMinutes * 60_000) <= +now).sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));

  return <>
    <NextInterviewHero next={next} todayCount={today.filter((item) => item.status === "UPCOMING" && +new Date(item.scheduledAt) > +now).length} hadInterviewsToday={today.length > 0} timezone={timezone} now={now} onOpen={onOpen} />
    <section className="section-block">
      <div className="section-title"><div><p className="eyebrow">TODAY</p><h2>Your day at a glance</h2></div><span className="count-bubble">{today.length}</span></div>
      {today.length ? <div className="timeline">{today.map((item) => <TimelineItem key={item.id} interview={item} timezone={timezone} now={now} onOpen={onOpen} />)}</div> : <EmptyState title="A clear day" text="No interviews today. Enjoy the breathing room." />}
    </section>
    {future.length > 0 && <section className="section-block"><div className="section-title"><div><p className="eyebrow">COMING UP</p><h2>Later on the calendar</h2></div></div><div className="card-grid">{future.map((item) => <InterviewCard key={item.id} interview={item} timezone={timezone} onOpen={onOpen} />)}</div></section>}
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">HISTORY</p><h2>Previous interviews</h2></div></div>{history.length ? <div className="list-stack compact">{history.map((item) => <InterviewRow key={item.id} interview={item} timezone={timezone} onOpen={onOpen} />)}</div> : <EmptyState title="No history yet" text="Finished interviews will stay safe here." />}</section>
  </>;
}

function NextInterviewHero({ next, todayCount, hadInterviewsToday, timezone, now, onOpen }: { next?: Interview; todayCount: number; hadInterviewsToday: boolean; timezone: string; now: Date; onOpen: (i: Interview) => void }) {
  if (!next) return <section className="next-hero empty-next"><div className="hero-spark"><Sparkles /></div><div><p className="eyebrow">NEXT INTERVIEW</p><h2>{hadInterviewsToday ? "No more interviews today." : "No interviews on the horizon."}</h2><p>You’re all caught up. Tiny victory dance encouraged.</p></div></section>;
  const isToday = getZonedDateKey(next.scheduledAt, timezone) === getZonedDateKey(now, timezone);
  const todayParts = getZonedDateKey(now, timezone).split("-").map(Number);
  const tomorrowKey = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2] + 1)).toISOString().slice(0, 10);
  const isTomorrow = getZonedDateKey(next.scheduledAt, timezone) === tomorrowKey;
  const start = formatInTimeZone(next.scheduledAt, timezone, "h:mm a");
  const end = formatInTimeZone(+new Date(next.scheduledAt) + next.durationMinutes * 60_000, timezone, "h:mm a zzz");
  return <section className="next-hero">
    <div className="hero-copy">
      <p className="eyebrow">NEXT INTERVIEW</p>
      {!isToday && <p className="quiet-lead">No interviews today. Next one is {isTomorrow ? "tomorrow" : formatInTimeZone(next.scheduledAt, timezone, "EEEE, MMM d")} at {start}.</p>}
      <h2>{interviewName(next)}</h2>
      <div className="countdown"><span className="pulse-dot" />{relativeStartLabel(next.scheduledAt, next.durationMinutes, now)}</div>
      <p className="hero-time">{formatInTimeZone(next.scheduledAt, timezone, "EEEE, MMM d")} · {start} – {end}</p>
      <div className="hero-badges"><Badge confirmed={!!next.interviewerConfirmedAt} />{todayCount > 1 && <span>{todayCount - 1} more today</span>}</div>
    </div>
    <button className="button button-ink button-large" onClick={() => onOpen(next)}>Open interview <ArrowRight size={19} /></button>
    <div className="hero-doodle" aria-hidden="true">✦</div>
  </section>;
}

function SummaryCard({ icon, tone, count, label, hint }: { icon: React.ReactNode; tone: string; count: number; label: string; hint: string }) {
  return <div className="summary-card"><span className={`summary-icon ${tone}`}>{icon}</span><div><strong>{count}</strong><h3>{label}</h3><p>{hint}</p></div></div>;
}

function InterviewCard({ interview, timezone, onOpen, emphasized = false }: { interview: Interview; timezone: string; onOpen: (i: Interview) => void; emphasized?: boolean }) {
  return <button className={`interview-card ${emphasized ? "emphasized" : ""}`} onClick={() => onOpen(interview)}>
    <div className="card-top"><StatusBadge status={interview.status} />{interview.feedback && !interview.feedbackConfirmedAt && <span className="attention-dot" title="Feedback waiting" />}</div>
    <h3>{interviewName(interview)}</h3><p><CalendarDays size={16} />{formatInterviewTime(interview.scheduledAt, timezone)}</p>
    <div className="card-bottom"><Badge confirmed={!!interview.interviewerConfirmedAt} /><ChevronRight size={18} /></div>
  </button>;
}

function InterviewRow({ interview, timezone, onOpen, onEdit, onDelete }: { interview: Interview; timezone: string; onOpen: (i: Interview) => void; onEdit?: (i: Interview) => void; onDelete?: (i: Interview) => void }) {
  return <article className="interview-row">
    <button className="row-main" onClick={() => onOpen(interview)}>
      <span className="date-tile"><b>{formatInTimeZone(interview.scheduledAt, timezone, "d")}</b>{formatInTimeZone(interview.scheduledAt, timezone, "MMM")}</span>
      <span className="row-copy"><strong>{interviewName(interview)}</strong><small>{formatInTimeZone(interview.scheduledAt, timezone, "EEE · h:mm a zzz")} · {interview.durationMinutes} min</small></span>
      <span className="row-badges"><StatusBadge status={interview.status} /><Badge confirmed={!!interview.interviewerConfirmedAt} />{interview.feedbackConfirmedAt && <span className="micro-badge locked"><LockKeyhole size={12} /> Feedback confirmed</span>}</span>
    </button>
    {onEdit && !interview.interviewerConfirmedAt && <div className="row-actions"><button className="icon-button" onClick={() => onEdit(interview)} aria-label={`Edit ${interviewName(interview)}`}><Pencil size={17} /></button><button className="icon-button danger" onClick={() => onDelete?.(interview)} aria-label={`Delete ${interviewName(interview)}`}><Trash2 size={17} /></button></div>}
    {onEdit && interview.interviewerConfirmedAt && <span className="locked-note"><LockKeyhole size={14} /> Details locked</span>}
    <button className="icon-button row-chevron" onClick={() => onOpen(interview)} aria-label="Open details"><ChevronRight size={19} /></button>
  </article>;
}

function TimelineItem({ interview, timezone, now, onOpen }: { interview: Interview; timezone: string; now: Date; onOpen: (i: Interview) => void }) {
  const happening = +now >= +new Date(interview.scheduledAt) && +now < +new Date(interview.scheduledAt) + interview.durationMinutes * 60_000;
  return <button className={`timeline-item ${happening ? "happening" : ""}`} onClick={() => onOpen(interview)}>
    <span className="timeline-time">{formatInTimeZone(interview.scheduledAt, timezone, "h:mm")}<small>{formatInTimeZone(interview.scheduledAt, timezone, "a")}</small></span>
    <span className="timeline-line"><i /></span>
    <span className="timeline-copy"><strong>{interviewName(interview)}</strong><small>{interview.durationMinutes} minutes · {happening ? "Happening now" : statusLabels[interview.status]}</small></span>
    <Badge confirmed={!!interview.interviewerConfirmedAt} /><ChevronRight size={18} />
  </button>;
}

function Badge({ confirmed }: { confirmed: boolean }) {
  return confirmed ? <span className="micro-badge confirmed"><Check size={12} /> Confirmed</span> : <span className="micro-badge waiting"><Clock3 size={12} /> Awaiting confirmation</span>;
}
function StatusBadge({ status }: { status: InterviewStatus }) { return <span className={`status-badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span aria-hidden="true">☁</span><h3>{title}</h3><p>{text}</p></div>; }

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header className="modal-header"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button></header>
      {children}
    </section>
  </div>;
}

function InterviewDetails({ interview, timezone, role, now, onClose, onEdit, onDelete, onChanged }: { interview: Interview; timezone: string; role: DashboardData["user"]["role"]; now: Date; onClose: () => void; onEdit: () => void; onDelete: () => void; onChanged: (message?: string) => Promise<void> }) {
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [status, setStatus] = useState<InterviewStatus>(interview.status === "UPCOMING" ? "DONE" : interview.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isCoordinator = role === "COORDINATOR";
  async function mutate(url: string, method: string, body: object, message: string) {
    setPending(true); setError("");
    try { await requestJson(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); await onChanged(message); }
    catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setPending(false); }
  }
  async function submitFeedback(event: React.FormEvent) {
    event.preventDefault();
    await mutate(`/api/interviews/${interview.id}/feedback`, "PUT", { status, feedback, expectedVersion: interview.version }, interview.feedback ? "Feedback updated." : "Feedback sent to the Coordinator.");
    setFeedbackMode(false);
  }
  const endTime = +new Date(interview.scheduledAt) + interview.durationMinutes * 60_000;
  return <Modal title={interviewName(interview)} subtitle={formatInterviewTime(interview.scheduledAt, timezone)} onClose={onClose} wide>
    <div className="detail-status-strip"><StatusBadge status={interview.status} /><Badge confirmed={!!interview.interviewerConfirmedAt} />{interview.feedbackConfirmedAt && <span className="micro-badge locked"><LockKeyhole size={12} /> Feedback confirmed</span>}<span className="detail-countdown">{relativeStartLabel(interview.scheduledAt, interview.durationMinutes, now)}</span></div>
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-section"><h3>Interview essentials</h3><div className="detail-facts"><div><Clock3 /><span><small>When</small>{formatInTimeZone(interview.scheduledAt, timezone, "EEEE, MMMM d · h:mm a")} – {formatInTimeZone(endTime, timezone, "h:mm a zzz")}</span></div><div><FileText /><span><small>Resume</small><a href={`/api/interviews/${interview.id}/resume`} target="_blank" rel="noopener noreferrer">{interview.resume.name}<Download size={14} /></a></span></div></div><a className="button button-primary button-wide" href={interview.meetingUrl} target="_blank" rel="noopener noreferrer">Join interview <ExternalLink size={18} /></a></section>
        <section className="detail-section"><h3>Job description</h3><div className="rich-content" dangerouslySetInnerHTML={{ __html: interview.jobDescriptionHtml }} /></section>
        <section className="detail-section feedback-section"><div className="subsection-heading"><h3>Interviewer feedback</h3>{interview.feedbackSubmittedAt && <small>Updated {formatInTimeZone(interview.feedbackSubmittedAt, timezone, "MMM d, h:mm a zzz")}</small>}</div>
          {interview.feedback ? <div className="feedback-box"><StatusBadge status={interview.status} /><p>{interview.feedback}</p></div> : <div className="soft-empty">No feedback has been submitted yet.</div>}
          {!isCoordinator && interview.interviewerConfirmedAt && !interview.feedbackConfirmedAt && !feedbackMode && <button className="button button-secondary" onClick={() => setFeedbackMode(true)}><MessageSquareText size={17} />{interview.feedback ? "Edit feedback" : "Add final status & feedback"}</button>}
          {feedbackMode && <form className="feedback-form" onSubmit={submitFeedback}><label>Final status<select value={status} onChange={(e) => setStatus(e.target.value as InterviewStatus)}>{finalStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label>Feedback<textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6} maxLength={10000} placeholder="Share your recommendation, signals, and useful context…" required /></label><div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setFeedbackMode(false)}>Cancel</button><button className="button button-primary" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}Save feedback</button></div></form>}
        </section>
      </div>
      <aside className="detail-aside">
        <div className="aside-card"><h3>Handoff</h3>{interview.interviewerConfirmedAt ? <><div className="aside-check"><CheckCircle2 />Confirmed by {interview.interviewerConfirmedByName}</div><p>Interview details are permanently locked.</p></> : <><div className="aside-wait"><Clock3 />Waiting for interviewer</div><p>Confirm to let the Coordinator know you’ve seen it.</p>{!isCoordinator && <button className="button button-primary button-wide" disabled={pending} onClick={() => mutate(`/api/interviews/${interview.id}/confirm`, "POST", { expectedVersion: interview.version }, "Interview confirmed. Details are now locked.")}>Confirm interview</button>}</>}</div>
        {isCoordinator && !interview.interviewerConfirmedAt && <div className="aside-card"><h3>Manage</h3><button className="button button-secondary button-wide" onClick={onEdit}><Pencil size={16} />Edit details</button><button className="button button-danger-ghost button-wide" onClick={onDelete}><Trash2 size={16} />Delete interview</button></div>}
        {isCoordinator && interview.feedback && !interview.feedbackConfirmedAt && <div className="aside-card attention-card"><h3>Feedback ready</h3><p>Review the note carefully. Confirmation permanently locks the feedback and final status.</p><button className="button button-ink button-wide" disabled={pending} onClick={() => mutate(`/api/interviews/${interview.id}/confirm-feedback`, "POST", { expectedVersion: interview.version }, "Feedback confirmed. The loop is closed.")}>Confirm feedback <Check size={17} /></button></div>}
        {interview.feedbackConfirmedAt && <div className="aside-card"><div className="aside-check"><LockKeyhole />Feedback confirmed</div><p>Confirmed by {interview.feedbackConfirmedByName}. Status and feedback are permanently locked.</p></div>}
      </aside>
    </div>
    {error && <p className="modal-error" role="alert">{error}</p>}
  </Modal>;
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  function command(name: string, argument?: string) { editor.current?.focus(); document.execCommand(name, false, argument); onChange(editor.current?.innerHTML ?? ""); }
  return <div className="editor-wrap"><div className="editor-toolbar" role="toolbar" aria-label="Text formatting"><button type="button" onClick={() => command("formatBlock", "h2")}>H</button><button type="button" onClick={() => command("bold")}><b>B</b></button><button type="button" onClick={() => command("italic")}><i>I</i></button><button type="button" onClick={() => command("insertUnorderedList")}>• List</button><span className="editor-link"><Link2 size={14} /><input aria-label="Link URL" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" /><button type="button" disabled={!linkUrl} onMouseDown={(event) => event.preventDefault()} onClick={() => { command("createLink", linkUrl); setLinkUrl(""); }}>Add</button></span></div><div ref={editor} className="rich-editor" contentEditable suppressContentEditableWarning onInput={(event) => onChange(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: value }} aria-label="Job description" /></div>;
}

function ScheduleModal({ interview, initialDateTime, timezone, onClose, onSaved }: { interview: Interview | null; initialDateTime?: string; timezone: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [dateTime, setDateTime] = useState(() => interview ? formatInTimeZone(interview.scheduledAt, timezone, "yyyy-MM-dd'T'HH:mm") : initialDateTime ?? formatInTimeZone(Date.now() + 86_400_000, timezone, "yyyy-MM-dd'T'10:00"));
  const [duration, setDuration] = useState(interview?.durationMinutes ?? 60);
  const [customDuration, setCustomDuration] = useState(![15,30,45,60,90].includes(interview?.durationMinutes ?? 60));
  const [meetingUrl, setMeetingUrl] = useState(interview?.meetingUrl ?? "");
  const [resume, setResume] = useState<ResumeFile | null>(interview?.resume ?? null);
  const [jobDescription, setJobDescription] = useState(interview?.jobDescriptionHtml ?? "<p></p>");
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    if (!resume) { setError("Upload a resume before saving."); setPending(false); return; }
    try {
      await requestJson(interview ? `/api/interviews/${interview.id}` : "/api/interviews", { method: interview ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheduledAt: localInputToUtc(dateTime, timezone), durationMinutes: duration, meetingUrl, resume, jobDescriptionHtml: jobDescription, rescheduledFromInterviewId: interview?.rescheduledFromInterviewId ?? null, ...(interview ? { expectedVersion: interview.version } : {}) }) });
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save the interview."); setPending(false); }
  }
  return <Modal title={interview ? "Edit interview" : "Schedule an interview"} subtitle={`Times use ${timezone.replaceAll("_", " ")}`} onClose={onClose} wide>
    <form className="schedule-form" onSubmit={submit}>
      <div className="form-grid"><label>Date & time <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required /><small>{timezone} · daylight saving handled automatically</small></label><fieldset><legend>Duration</legend><div className="duration-options">{[15,30,45,60,90].map((value) => <button type="button" key={value} className={!customDuration && duration === value ? "active" : ""} onClick={() => { setDuration(value); setCustomDuration(false); }}>{value}m</button>)}<button type="button" className={customDuration ? "active" : ""} onClick={() => setCustomDuration(true)}>Custom</button></div>{customDuration && <input type="number" min={10} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Custom duration in minutes" />}</fieldset></div>
      <label>Meeting link <span className="input-with-icon"><Link2 size={17} /><input type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/…" required /></span></label>
      <div className="field-group"><span className="field-label">Resume</span>{resume ? <div className="uploaded-file"><FileText /><span><strong>{resume.name}</strong><small>{(resume.size / 1024 / 1024).toFixed(1)} MB · securely stored in UploadThing</small></span><button type="button" className="icon-button" onClick={() => setResume(null)} aria-label="Remove resume"><X size={17} /></button></div> : <UploadDropzone endpoint="resume" className="upload-dropzone" onClientUploadComplete={(files) => { const file = files[0]; const server = file?.serverData as ResumeFile | undefined; if (server) setResume(server); else if (file) setResume({ key: file.key, url: file.ufsUrl, name: file.name, size: file.size, mimeType: file.type }); }} onUploadError={(uploadError) => setError(uploadError.message)} />}</div>
      <label>Job description <RichTextEditor value={jobDescription} onChange={setJobDescription} /><small>Use headings, emphasis, lists, and links to make the brief easy to scan.</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions sticky-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}{interview ? "Save changes" : "Schedule interview"}</button></div>
    </form>
  </Modal>;
}

function TimezoneModal({ current, onClose, onSaved }: { current: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [timezone, setTimezone] = useState(current); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); try { await requestJson("/api/workspace/timezone", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone }) }); await onSaved(); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update timezone."); setPending(false); } }
  return <Modal title="Workspace timezone" subtitle="All interview times and date groups use this timezone." onClose={onClose}><form className="simple-form" onSubmit={submit}><label>Timezone<select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{commonTimezones.map((value) => <option key={value}>{value}</option>)}</select></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={pending}>Save timezone</button></div></form></Modal>;
}

function DeleteDialog({ interview, onClose, onDeleted }: { interview: Interview; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function remove() { setPending(true); try { await requestJson(`/api/interviews/${interview.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: interview.version }) }); await onDeleted(); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t delete this interview."); setPending(false); } }
  return <Modal title="Delete this interview?" subtitle="This can’t be undone. The uploaded resume will remain in UploadThing until your storage retention process removes it." onClose={onClose}><div className="delete-summary"><FileText /><div><strong>{interviewName(interview)}</strong><p>{interview.resume.name}</p></div></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button className="button button-ghost" onClick={onClose}>Keep it</button><button className="button button-danger" disabled={pending} onClick={remove}>{pending && <LoaderCircle className="spin" size={17} />}Delete interview</button></div></Modal>;
}
