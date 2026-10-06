"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import {
  Ban, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download,
  ExternalLink, FileText, Globe2, Link2, LoaderCircle, LockKeyhole, LogOut, MessageSquareText,
  List, Palette, Pencil, Plus, RefreshCw, Settings2, Trash2, UploadCloud, X,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { formatInterviewTime, getZonedDateKey, localInputToUtc, relativeStartLabel } from "@/lib/time";
import type { DashboardData, Interview, InterviewStatus, ResumeFile } from "@/lib/types";

const statusLabels: Record<InterviewStatus, string> = {
  UPCOMING: "Upcoming", DONE: "Done", CANCELED: "Canceled", FAILED: "Failed", RESCHEDULED: "Rescheduled",
};
const finalStatuses = ["DONE", "CANCELED", "FAILED", "RESCHEDULED"] as const;
const commonTimezones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
const themes = [
  { value: "warm", label: "Warm" },
  { value: "ocean", label: "Ocean" },
  { value: "forest", label: "Forest" },
  { value: "plum", label: "Plum" },
] as const;
type ThemeName = (typeof themes)[number]["value"];
type ViewMode = "OVERVIEW" | "CALENDAR";

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
  const [viewMode, setViewMode] = useState<ViewMode>("OVERVIEW");
  const themeSelect = useRef<HTMLSelectElement>(null);
  const [newInterviewTime, setNewInterviewTime] = useState<string | undefined>();
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("handoff-theme");
    const nextTheme = themes.some((item) => item.value === saved) ? saved as ThemeName : "warm";
    document.documentElement.dataset.theme = nextTheme;
    if (themeSelect.current) themeSelect.current.value = nextTheme;
  }, []);

  function changeTheme(nextTheme: ThemeName) {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("handoff-theme", nextTheme);
  }

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

  async function refreshOverview() {
    try {
      await refresh("You’re viewing the latest updates.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Couldn’t refresh the interviews.");
      window.setTimeout(() => setToast(""), 3500);
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
          <label className="theme-picker" title="Color theme"><Palette size={15} /><select ref={themeSelect} defaultValue="warm" onChange={(event) => changeTheme(event.target.value as ThemeName)} aria-label="Color theme">{themes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
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
          <h1>Interviews</h1>
          <p className="page-subtitle">{formatInTimeZone(now, data.user.timezone, "EEEE, MMMM d")} · {isCoordinator ? "Manage schedules and handoffs" : "Review your schedule and next actions"}</p>
        </div>
        <div className="welcome-actions">
          {viewMode === "OVERVIEW" && <button className="button button-secondary refresh-button" disabled={refreshing} onClick={() => void refreshOverview()}>{refreshing ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Refresh</button>}
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
  const startHour = 0;
  const endHour = 24;
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
    element.scrollTop = Math.max(0, (currentHour - startHour - 1) * pixelsPerHour - 20);
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
            <div className="calendar-body" style={{ height: gridHeight, gridTemplateColumns: `72px repeat(${days.length}, minmax(110px, 1fr))` }}>
              <div className="calendar-time-axis">{hours.map((hour) => <span key={hour} style={{ top: (hour - startHour) * pixelsPerHour }}>{hourLabel(hour)}</span>)}</div>
              <div className="calendar-day-columns">
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
                    {dayInterviews.map((item) => {
                      const hour = Number(formatInTimeZone(item.scheduledAt, timezone, "H"));
                      const minute = Number(formatInTimeZone(item.scheduledAt, timezone, "m"));
                      const top = (((hour * 60 + minute) - startHour * 60) / 60) * pixelsPerHour;
                      const height = Math.max(30, item.durationMinutes / 60 * pixelsPerHour);
                      return <button key={item.id} className={`calendar-event calendar-event-${item.status.toLowerCase()}`} style={{ top, height, left: 4 }} onClick={() => onOpen(item)} title={`${interviewName(item)} · ${formatInterviewTime(item.scheduledAt, timezone)}`}><strong>{formatInTimeZone(item.scheduledAt, timezone, "h:mm a")}</strong><span>{interviewName(item)}</span>{item.interviewerConfirmedAt && <Check size={11} />}</button>;
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
  const upcoming = interviews.filter((item) => item.status === "UPCOMING" && +new Date(item.scheduledAt) + item.durationMinutes * 60_000 > +now).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const next = upcoming[0];
  const visible = interviews.filter((item) => filter === "ALL" || item.status === filter).sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));

  return <>
    <section className="summary-grid" aria-label="Workspace summary">
      <SummaryCard icon={<CalendarDays />} tone="peach" count={upcoming.length} label="Upcoming" hint="Scheduled interviews" />
      <SummaryCard icon={<Clock3 />} tone="lilac" count={unconfirmed.length} label="To confirm" hint="Waiting for interviewer" />
      <SummaryCard icon={<MessageSquareText />} tone="mint" count={awaiting.length} label="Review feedback" hint="Needs your confirmation" />
    </section>
    {next && <NextInterviewPanel interview={next} timezone={timezone} now={now} onOpen={onOpen} />}

    <section className="section-block">
      <div className="section-title section-title-wrap">
        <div><p className="eyebrow">ALL INTERVIEWS</p><h2>Interview list</h2></div>
        <div className="filter-row" role="group" aria-label="Filter interviews">
          {filterValues.map((value) => <button key={value} className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value)}>{value === "ALL" ? "All" : statusLabels[value]}</button>)}
        </div>
      </div>
      {visible.length ? <div className="list-stack">{visible.map((item) => <InterviewRow key={item.id} interview={item} timezone={timezone} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}</div> : <EmptyState title="No interviews yet" text={filter === "ALL" ? "Schedule the first interview to get started." : "No interviews match this filter."} />}
    </section>
  </>;
}

type ViewProps = { interviews: Interview[]; timezone: string; onOpen: (i: Interview) => void; now: Date };
function InterviewerView({ interviews, timezone, onOpen, now }: ViewProps) {
  const todayKey = getZonedDateKey(now, timezone);
  const activeUpcoming = interviews.filter((item) => item.status === "UPCOMING" && (+new Date(item.scheduledAt) + item.durationMinutes * 60_000) > +now).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const next = activeUpcoming[0];
  const today = interviews.filter((item) => getZonedDateKey(item.scheduledAt, timezone) === todayKey);
  const needsFeedback = interviews.filter((item) => item.interviewerConfirmedAt && !item.feedbackConfirmedAt && +new Date(item.scheduledAt) <= +now);
  const visible = [...interviews].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));

  return <>
    <section className="summary-grid" aria-label="Interview summary">
      <SummaryCard icon={<CalendarDays />} tone="peach" count={today.length} label="Today" hint="Interviews on your schedule" />
      <SummaryCard icon={<Clock3 />} tone="lilac" count={activeUpcoming.length} label="Upcoming" hint="Still ahead" />
      <SummaryCard icon={<MessageSquareText />} tone="mint" count={needsFeedback.length} label="Needs feedback" hint="Your next actions" />
    </section>
    {next && <NextInterviewPanel interview={next} timezone={timezone} now={now} onOpen={onOpen} />}
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">ALL INTERVIEWS</p><h2>Your interview list</h2></div></div>{visible.length ? <div className="list-stack">{visible.map((item) => <InterviewRow key={item.id} interview={item} timezone={timezone} onOpen={onOpen} />)}</div> : <EmptyState title="No interviews yet" text="New interviews will appear here when they are scheduled." />}</section>
  </>;
}

function SummaryCard({ icon, tone, count, label, hint }: { icon: React.ReactNode; tone: string; count: number; label: string; hint: string }) {
  return <div className="summary-card"><span className={`summary-icon ${tone}`}>{icon}</span><div className="summary-copy"><h3>{label}</h3><p>{hint}</p></div><strong className="summary-count">{count}</strong></div>;
}

function NextInterviewPanel({ interview, timezone, now, onOpen }: { interview: Interview; timezone: string; now: Date; onOpen: (item: Interview) => void }) {
  return <button className="next-interview" onClick={() => onOpen(interview)}>
    <div className="next-interview-copy"><span>Next interview</span><strong>{interviewName(interview)}</strong><small>{formatInterviewTime(interview.scheduledAt, timezone)} · {relativeStartLabel(interview.scheduledAt, interview.durationMinutes, now)}</small></div>
    <span className="next-interview-action">Open interview <ChevronRight size={18} /></span>
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
  const [cancelMode, setCancelMode] = useState(false);
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
  const hasStarted = +now >= +new Date(interview.scheduledAt);
  const coordinatorCanceled = interview.status === "CANCELED" && !interview.feedback;
  const feedbackAvailable = hasStarted && (interview.status === "UPCOMING" || !!interview.feedback);
  return <Modal title={interviewName(interview)} subtitle={formatInterviewTime(interview.scheduledAt, timezone)} onClose={onClose} wide>
    <div className="detail-status-strip">
      <StatusBadge status={interview.status} />
      <Badge confirmed={!!interview.interviewerConfirmedAt} />
      {interview.feedbackConfirmedAt && <span className="micro-badge locked"><LockKeyhole size={12} /> Feedback confirmed</span>}
      <span className="detail-countdown">{relativeStartLabel(interview.scheduledAt, interview.durationMinutes, now)}</span>
      <div className="detail-primary-action">
        {!isCoordinator && !interview.interviewerConfirmedAt && <button className="button button-primary" disabled={pending} onClick={() => mutate(`/api/interviews/${interview.id}/confirm`, "POST", { expectedVersion: interview.version }, "Interview confirmed. Details are now locked.")}>Confirm interview</button>}
        {isCoordinator && interview.feedback && !interview.feedbackConfirmedAt && <button className="button button-ink" disabled={pending} onClick={() => mutate(`/api/interviews/${interview.id}/confirm-feedback`, "POST", { expectedVersion: interview.version }, "Feedback confirmed. The loop is closed.")}>Confirm feedback <Check size={16} /></button>}
      </div>
    </div>
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-section"><h3>Interview essentials</h3><div className="detail-facts"><div><Clock3 /><span><small>When</small>{formatInTimeZone(interview.scheduledAt, timezone, "EEEE, MMMM d · h:mm a")} – {formatInTimeZone(endTime, timezone, "h:mm a zzz")}</span></div><div><FileText /><span><small>Resume</small><a href={`/api/interviews/${interview.id}/resume`} target="_blank" rel="noopener noreferrer">{interview.resume.name}<Download size={14} /></a></span></div></div>{interview.status === "CANCELED" ? <div className="canceled-meeting-note"><Ban size={18} /><span><strong>Meeting canceled</strong><small>The confirmed details remain available for reference.</small></span></div> : <a className="button button-primary button-wide" href={interview.meetingUrl} target="_blank" rel="noopener noreferrer">Join interview <ExternalLink size={18} /></a>}</section>
        <section className="detail-section"><h3>Job description</h3><div className="rich-content" dangerouslySetInnerHTML={{ __html: interview.jobDescriptionHtml }} /></section>
        <section className="detail-section feedback-section"><div className="subsection-heading"><h3>Interviewer feedback</h3>{interview.feedbackSubmittedAt && <small>Updated {formatInTimeZone(interview.feedbackSubmittedAt, timezone, "MMM d, h:mm a zzz")}</small>}</div>
          {interview.feedback ? <div className="feedback-box"><StatusBadge status={interview.status} /><p>{interview.feedback}</p></div> : <div className="soft-empty">No feedback has been submitted yet.</div>}
          {!isCoordinator && interview.interviewerConfirmedAt && !interview.feedbackConfirmedAt && feedbackAvailable && !feedbackMode && <button className="button button-secondary" onClick={() => setFeedbackMode(true)}><MessageSquareText size={17} />{interview.feedback ? "Edit feedback" : "Add final status & feedback"}</button>}
          {!isCoordinator && interview.interviewerConfirmedAt && !interview.feedbackConfirmedAt && !hasStarted && interview.status === "UPCOMING" && <p className="feedback-locked-note"><LockKeyhole size={14} /> Feedback opens when the interview starts.</p>}
          {!isCoordinator && coordinatorCanceled && <p className="feedback-locked-note"><Ban size={14} /> This meeting was canceled; no feedback is required.</p>}
          {feedbackMode && <form className="feedback-form" onSubmit={submitFeedback}><label>Final status<select value={status} onChange={(e) => setStatus(e.target.value as InterviewStatus)}>{finalStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label>Feedback<textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6} maxLength={10000} placeholder="Share your recommendation, signals, and useful context…" required /></label><div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setFeedbackMode(false)}>Cancel</button><button className="button button-primary" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}Save feedback</button></div></form>}
        </section>
      </div>
      <aside className="detail-aside">
        <div className="aside-card"><h3>Handoff</h3>{interview.interviewerConfirmedAt ? <><div className="aside-check"><CheckCircle2 />Confirmed by {interview.interviewerConfirmedByName}</div><p>Interview details are permanently locked.</p></> : <><div className="aside-wait"><Clock3 />Waiting for interviewer</div><p>The interviewer can confirm from the action bar above.</p></>}</div>
        {isCoordinator && !interview.interviewerConfirmedAt && <div className="aside-card"><h3>Manage</h3><button className="button button-secondary button-wide" onClick={onEdit}><Pencil size={16} />Edit details</button><button className="button button-danger-ghost button-wide" onClick={onDelete}><Trash2 size={16} />Delete interview</button></div>}
        {isCoordinator && interview.interviewerConfirmedAt && interview.status === "UPCOMING" && <div className="aside-card cancellation-card"><h3>Meeting changes</h3><p>If this meeting will not happen, cancel it while preserving the confirmed record.</p>{cancelMode ? <div className="cancel-confirm"><strong>Cancel this interview?</strong><small>Both roles will see it as canceled.</small><div><button className="button button-ghost" disabled={pending} onClick={() => setCancelMode(false)}>Keep scheduled</button><button className="button button-danger" disabled={pending} onClick={() => void mutate(`/api/interviews/${interview.id}/cancel`, "POST", { expectedVersion: interview.version }, "Interview canceled.")}>{pending && <LoaderCircle className="spin" size={16} />}Cancel interview</button></div></div> : <button className="button button-danger-ghost button-wide" onClick={() => setCancelMode(true)}><Ban size={16} />Cancel interview</button>}</div>}
        {isCoordinator && interview.feedback && !interview.feedbackConfirmedAt && <div className="aside-card attention-card"><h3>Feedback ready</h3><p>Review the note carefully, then use the confirmation action above. Confirmation permanently locks the feedback and final status.</p></div>}
        {interview.feedbackConfirmedAt && <div className="aside-card"><div className="aside-check"><LockKeyhole />Feedback confirmed</div><p>Confirmed by {interview.feedbackConfirmedByName}. Status and feedback are permanently locked.</p></div>}
      </aside>
    </div>
    {error && <p className="modal-error" role="alert">{error}</p>}
  </Modal>;
}

function ResumeUploader({ onUploaded, onError, onUploadingChange }: { onUploaded: (resume: ResumeFile) => void; onError: (message: string) => void; onUploadingChange: (uploading: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");
  const { startUpload, isUploading } = useUploadThing("resume", {
    onClientUploadComplete: (uploadedFiles) => {
      const uploaded = uploadedFiles[0];
      if (!uploaded) {
        onError("UploadThing completed without returning file details.");
        return;
      }
      const server = uploaded.serverData as ResumeFile | null | undefined;
      onUploaded(server ?? { key: uploaded.key, url: uploaded.ufsUrl, name: uploaded.name, size: uploaded.size, mimeType: uploaded.type });
    },
    onUploadError: (uploadError) => onError(uploadError.message),
  });

  async function upload(files: FileList | File[]) {
    const file = files[0];
    if (!file || isUploading) return;
    const allowedMimeTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtension = /\.(pdf|doc|docx)$/i.test(file.name);
    if (!allowedMimeTypes.includes(file.type) && !allowedExtension) {
      setLocalError("Choose a PDF, DOC, or DOCX resume.");
      if (input.current) input.current.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setLocalError("Resume files must be 8 MB or smaller.");
      if (input.current) input.current.value = "";
      return;
    }
    setLocalError("");
    onError("");
    onUploadingChange(true);
    try {
      await startUpload([file]);
    } catch (uploadError) {
      onError(uploadError instanceof Error ? uploadError.message : "Resume upload failed.");
    } finally {
      onUploadingChange(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div>
    <div className={`resume-dropzone ${dragging ? "dragging" : ""} ${isUploading ? "uploading" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files); }}>
      <input ref={input} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => event.target.files && void upload(event.target.files)} disabled={isUploading} />
      <span className="resume-upload-icon">{isUploading ? <LoaderCircle className="spin" /> : <UploadCloud />}</span>
      <div className="resume-upload-copy"><strong>{isUploading ? "Uploading resume…" : "Drop a resume here"}</strong><span>or choose a file from your computer</span><small>PDF, DOC, or DOCX · up to 8 MB</small></div>
      <button type="button" className="button button-secondary" onClick={() => input.current?.click()} disabled={isUploading}>{isUploading ? "Uploading…" : "Choose file"}</button>
    </div>
    {localError && <p className="field-error" role="alert">{localError}</p>}
  </div>;
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li(?:\s[^>]*)?>/gi, "• ")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainTextToHtml(value: string) {
  const escaped = value.trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`).join("");
}

function ScheduleModal({ interview, initialDateTime, timezone, onClose, onSaved }: { interview: Interview | null; initialDateTime?: string; timezone: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [dateTime, setDateTime] = useState(() => interview ? formatInTimeZone(interview.scheduledAt, timezone, "yyyy-MM-dd'T'HH:mm") : initialDateTime ?? formatInTimeZone(Date.now() + 86_400_000, timezone, "yyyy-MM-dd'T'10:00"));
  const [duration, setDuration] = useState(interview?.durationMinutes ?? 60);
  const [customDuration, setCustomDuration] = useState(![15,30,45,60,90].includes(interview?.durationMinutes ?? 60));
  const [meetingUrl, setMeetingUrl] = useState(interview?.meetingUrl ?? "");
  const [resume, setResume] = useState<ResumeFile | null>(interview?.resume ?? null);
  const [resumeError, setResumeError] = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);
  const [jobDescription, setJobDescription] = useState(() => htmlToPlainText(interview?.jobDescriptionHtml ?? ""));
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    if (!resume) { setResumeError("Upload a resume before saving."); setPending(false); return; }
    try {
      await requestJson(interview ? `/api/interviews/${interview.id}` : "/api/interviews", { method: interview ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheduledAt: localInputToUtc(dateTime, timezone), durationMinutes: duration, meetingUrl, resume, jobDescriptionHtml: plainTextToHtml(jobDescription), rescheduledFromInterviewId: interview?.rescheduledFromInterviewId ?? null, ...(interview ? { expectedVersion: interview.version } : {}) }) });
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save the interview."); setPending(false); }
  }
  return <Modal title={interview ? "Edit interview" : "Schedule an interview"} subtitle={`Times use ${timezone.replaceAll("_", " ")}`} onClose={onClose} wide>
    <form className="schedule-form" onSubmit={submit}>
      <div className="form-grid"><label>Date & time <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required /><small>{timezone} · daylight saving handled automatically</small></label><fieldset><legend>Duration</legend><div className="duration-options">{[15,30,45,60,90].map((value) => <button type="button" key={value} className={!customDuration && duration === value ? "active" : ""} onClick={() => { setDuration(value); setCustomDuration(false); }}>{value}m</button>)}<button type="button" className={customDuration ? "active" : ""} onClick={() => setCustomDuration(true)}>Custom</button></div>{customDuration && <input type="number" min={10} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Custom duration in minutes" />}</fieldset></div>
      <label>Meeting link <span className="input-with-icon"><Link2 size={17} /><input type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/…" required /></span></label>
      <div className="field-group"><span className="field-label">Resume</span>{resume ? <div className="uploaded-file"><FileText /><span><strong>{resume.name}</strong><small>{(resume.size / 1024 / 1024).toFixed(1)} MB · stored in UploadThing</small></span><button type="button" className="icon-button" onClick={() => setResume(null)} aria-label="Remove resume"><X size={17} /></button></div> : <ResumeUploader onUploaded={(file) => { setResume(file); setResumeError(""); }} onError={setResumeError} onUploadingChange={setResumeUploading} />}{resumeError && <p className="field-error" role="alert">{resumeError}</p>}</div>
      <label>Job description <textarea className="jd-textarea" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Write or paste the role, responsibilities, and interview focus…" rows={8} maxLength={40_000} dir="ltr" required /><small>Plain text is saved with your paragraphs and line breaks.</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions sticky-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={pending || resumeUploading}>{(pending || resumeUploading) && <LoaderCircle className="spin" size={17} />}{resumeUploading ? "Uploading resume…" : interview ? "Save changes" : "Schedule interview"}</button></div>
    </form>
  </Modal>;
}

function TimezoneModal({ current, onClose, onSaved }: { current: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [timezone, setTimezone] = useState(current); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); try { await requestJson("/api/workspace/timezone", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone }) }); await onSaved(); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update timezone."); setPending(false); } }
  return <Modal title="Workspace timezone" subtitle="All interview times and date groups use this timezone." onClose={onClose}><form className="simple-form" onSubmit={submit}><label>Timezone<span className="select-wrap"><select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{commonTimezones.map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></span></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={pending}>Save timezone</button></div></form></Modal>;
}

function DeleteDialog({ interview, onClose, onDeleted }: { interview: Interview; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function remove() { setPending(true); try { await requestJson(`/api/interviews/${interview.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: interview.version }) }); await onDeleted(); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t delete this interview."); setPending(false); } }
  return <Modal title="Delete this interview?" subtitle="This can’t be undone. The uploaded resume will remain in UploadThing until your storage retention process removes it." onClose={onClose}><div className="delete-summary"><FileText /><div><strong>{interviewName(interview)}</strong><p>{interview.resume.name}</p></div></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button className="button button-ghost" onClick={onClose}>Keep it</button><button className="button button-danger" disabled={pending} onClick={remove}>{pending && <LoaderCircle className="spin" size={17} />}Delete interview</button></div></Modal>;
}
