import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "../../../components/Layout";
import { supabase } from "../../../lib/supabaseClient";

function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e < s) e += 24 * 60;
  return Math.max(0, e - s);
}

function formatMinutesHuman(minutes) {
  const safe = Number(minutes || 0);
  if (!safe) return "0 min";
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}

function formatDateFriendly(dateStr) {
  if (!dateStr) return "Not set";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InfoCard({ label, value, subtext, tone = "default" }) {
  const tones = {
    default: {
      bg: "#ffffff",
      border: "rgba(15,23,42,0.08)",
      value: "#0f172a",
      label: "#64748b",
    },
    accent: {
      bg: "linear-gradient(135deg, rgba(14,165,233,0.10), rgba(59,130,246,0.10))",
      border: "rgba(59,130,246,0.16)",
      value: "#0f172a",
      label: "#0369a1",
    },
    success: {
      bg: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(34,197,94,0.08))",
      border: "rgba(16,185,129,0.18)",
      value: "#065f46",
      label: "#047857",
    },
    warning: {
      bg: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.08))",
      border: "rgba(245,158,11,0.20)",
      value: "#92400e",
      label: "#b45309",
    },
  };

  const ui = tones[tone] || tones.default;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        border: `1px solid ${ui.border}`,
        background: ui.bg,
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: ui.label, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: ui.value, lineHeight: 1.1 }}>
        {value}
      </div>
      {subtext ? (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{subtext}</div>
      ) : null}
    </div>
  );
}

function SectionCard({ number, title, subtitle, children }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: "0 8px 18px rgba(37,99,235,0.22)",
          }}
        >
          {number}
        </div>

        <div>
          <h3 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>{title}</h3>
          {subtitle ? (
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>{subtitle}</p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

function Field({ label, hint, required = false, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
        {label} {required ? <span style={{ color: "#dc2626" }}>*</span> : null}
      </label>
      {hint ? <div style={{ fontSize: 12, color: "#64748b" }}>{hint}</div> : null}
      {children}
    </div>
  );
}

function QuickChip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid rgba(15,23,42,0.10)",
        background: "#fff",
        color: "#0f172a",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function CloseOutPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [record, setRecord] = useState(null);

  const [timeArrived, setTimeArrived] = useState("");
  const [timeComplete, setTimeComplete] = useState("");
  const [closeOut, setCloseOut] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [pmJobCardNo, setPmJobCardNo] = useState("");
  const [repair, setRepair] = useState("Yes");
  const [otherDelays, setOtherDelays] = useState("");
  const [otherDelaysMinutes, setOtherDelaysMinutes] = useState("");
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    if (!id) return;

    async function load() {
      setToast(null);
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("breakdowns")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        setRecord(data);
        setTimeArrived(data.time_arrived || "");
        setTimeComplete(data.end_time || "");
        setCloseOut(data.close_out || "");
        setActionTaken(data.action_taken || "");
        setPmJobCardNo(data.pm_job_card_no || "");
        setRepair(data.repair || "Yes");
        setOtherDelays(data.other_delays || "");
        setResolution(data.resolution || "");
      } catch (e) {
        setToast({ type: "error", text: String(e?.message || e) });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const downtimeMinutes = useMemo(() => {
    if (!record?.start_time || !timeComplete) return 0;
    return diffMinutes(record.start_time, timeComplete);
  }, [record?.start_time, timeComplete]);

  const responseDelayMinutes = useMemo(() => {
    if (!record?.time_called || !timeArrived) return 0;
    return diffMinutes(record.time_called, timeArrived);
  }, [record?.time_called, timeArrived]);

  const otherDelayMins = useMemo(() => {
    const raw = String(otherDelaysMinutes || "").trim();
    const parsed = raw === "" ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [otherDelaysMinutes]);

  const totalDelayMinutes = useMemo(() => {
    return responseDelayMinutes + otherDelayMins;
  }, [responseDelayMinutes, otherDelayMins]);

  const validationErrors = useMemo(() => {
    const issues = [];
    if (!timeComplete) issues.push("Add Time Complete");
    if (!resolution.trim()) issues.push("Add a final resolution");
    return issues;
  }, [timeComplete, resolution]);

  const closeHealthTone = useMemo(() => {
    if (!timeComplete || !resolution.trim()) return "warning";
    if (repair === "No") return "warning";
    return "success";
  }, [timeComplete, resolution, repair]);

  const saveCloseOut = async () => {
    setToast(null);

    if (!record) return;

    if (validationErrors.length > 0) {
      return setToast({
        type: "error",
        text: `Please complete: ${validationErrors.join(", ")}`,
      });
    }

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setLoading(false);
        return setToast({ type: "error", text: "Sign in first." });
      }

      let closedOutName = user.email || "User";
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profile?.full_name) closedOutName = profile.full_name;
      } catch (_) {
        // ignore
      }

      const updatePayload = {
        time_arrived: timeArrived || null,
        end_time: timeComplete,
        close_out: closeOut.trim() || null,
        action_taken: actionTaken.trim() || null,
        pm_job_card_no: pmJobCardNo.trim() || null,
        repair: repair || null,
        other_delays: otherDelays.trim() || null,
        downtime_minutes: downtimeMinutes,
        delay_time_minutes: totalDelayMinutes,
        resolution: resolution.trim() || null,
        closed_out_by: user.id,
        closed_out_by_name: closedOutName,
        status: "Closed",
      };

      const { error } = await supabase
        .from("breakdowns")
        .update(updatePayload)
        .eq("id", record.id);

      if (error) throw error;

      setToast({ type: "success", text: "Breakdown closed successfully." });
      setTimeout(() => {
        router.push("/admin");
      }, 1500);
    } catch (e) {
      setToast({ type: "error", text: String(e?.message || e) });
      setLoading(false);
    }
  };

  return (
    <Layout
      title="Close out breakdown | Dishaba Mine"
      pageTitle="Close Out Breakdown"
      pageDescription="Capture final repair details, update delays, and hand over a clean shift summary."
      pageActions={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/admin" className="btn ghost">
            Back to breakdown log
          </Link>
        </div>
      }
    >
      {!record && !loading && (
        <div
          className="card"
          style={{
            borderRadius: 22,
            padding: 24,
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>No record found</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
            Check the breakdown ID in the URL and try again.
          </div>
        </div>
      )}

      {loading && !record && (
        <div
          className="card"
          style={{
            borderRadius: 22,
            padding: 24,
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div className="skeleton shape-lg" />
        </div>
      )}

      {record && (
        <div style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              borderRadius: 28,
              overflow: "hidden",
              border: "1px solid rgba(15,23,42,0.08)",
              background:
                "linear-gradient(135deg, rgba(2,132,199,0.10), rgba(59,130,246,0.08) 45%, rgba(255,255,255,1) 100%)",
              boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
            }}
          >
            <div style={{ padding: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 999,
                        padding: "6px 12px",
                        background: "#fff",
                        border: "1px solid rgba(15,23,42,0.08)",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      Open breakdown
                    </span>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 999,
                        padding: "6px 12px",
                        background: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(15,23,42,0.06)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#334155",
                      }}
                    >
                      #{record.id}
                    </span>
                  </div>

                  <div>
                    <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, color: "#0f172a" }}>
                      {record.equipment_item || "Equipment item"}
                    </h2>
                    <div style={{ marginTop: 8, fontSize: 15, color: "#475569" }}>
                      {record.category || "No category"} • {record.section || "No section"} •{" "}
                      {record.shift || "No shift"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                    {[
                      `Occurred ${formatDateFriendly(record.occurred_on)}`,
                      `Reported ${record.start_time || "Not set"}`,
                      `Called ${record.time_called || "Not set"}`,
                      `Supervisor ${record.supervisor || "Not set"}`
                    ].map((item) => (
                      <span
                        key={item}
                        style={{
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.85)",
                          border: "1px solid rgba(15,23,42,0.06)",
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    minWidth: 240,
                    maxWidth: 340,
                    width: "100%",
                    background: "rgba(255,255,255,0.82)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 22,
                    padding: 18,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0369a1", marginBottom: 6 }}>
                    Close-out readiness
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                    {validationErrors.length === 0 ? "Ready to close" : "Needs attention"}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
                    {validationErrors.length === 0
                      ? "Required details are in place. Review the summary and close it out."
                      : `${validationErrors.length} required item${
                          validationErrors.length > 1 ? "s" : ""
                        } still missing.`}
                  </div>
                </div>
              </div>

              {record.description ? (
                <div
                  style={{
                    marginTop: 18,
                    borderRadius: 20,
                    padding: 16,
                    background: "rgba(255,255,255,0.80)",
                    border: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>
                    Logged description
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, color: "#1e293b" }}>
                    {record.description}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <InfoCard
              label="Downtime"
              value={formatMinutesHuman(downtimeMinutes)}
              subtext={`From ${record.start_time || "Not set"} to ${timeComplete || "Not set"}`}
              tone="accent"
            />
            <InfoCard
              label="Response delay"
              value={formatMinutesHuman(responseDelayMinutes)}
              subtext={`From ${record.time_called || "Not set"} to ${timeArrived || "Not set"}`}
              tone="default"
            />
            <InfoCard
              label="Other delays"
              value={formatMinutesHuman(otherDelayMins)}
              subtext={otherDelays ? otherDelays : "No extra delays added"}
              tone="warning"
            />
            <InfoCard
              label="Total delay"
              value={formatMinutesHuman(totalDelayMinutes)}
              subtext="Response delay + other delays"
              tone="default"
            />
            <InfoCard
              label="Close quality"
              value={repair === "Yes" ? "Fully repaired" : repair === "Partial" ? "Partial" : "Not repaired"}
              subtext="Repair status selected below"
              tone={closeHealthTone}
            />
          </div>

          {validationErrors.length > 0 && (
            <div
              style={{
                borderRadius: 20,
                border: "1px solid rgba(245,158,11,0.25)",
                background: "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(251,191,36,0.06))",
                padding: 16,
                color: "#92400e",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Complete these before closing</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                {validationErrors.map((item) => (
                  <li key={item} style={{ fontSize: 14 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "grid", gap: 18 }}>
            <details
              style={{
                borderRadius: 18,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(255,255,255,0.85)",
                padding: 14,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                <span>Helper panel</span>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                  Snapshot + phrases
                </span>
              </summary>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {/* Snapshot becomes compact */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  <InfoCard label="Occurred" value={formatDateFriendly(record.occurred_on)} />
                  <InfoCard label="Reported by" value={record.reported_by_name || "Not set"} />
                  <InfoCard label="Reported to" value={record.reported_to || "Not set"} />
                  <InfoCard label="Supervisor" value={record.supervisor || "Not set"} />
                </div>

                {/* Phrases become compact chips */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>
                    Suggested resolution phrases
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <QuickChip onClick={() => setResolution("Breakdown resolved and equipment returned to service.")}>
                      Returned to service
                    </QuickChip>
                    <QuickChip onClick={() => setResolution("Temporary repair completed and monitoring required on next shift.")}>
                      Temporary repair
                    </QuickChip>
                    <QuickChip onClick={() => setResolution("Fault isolated, component replaced, and machine tested successfully.")}>
                      Fault isolated and tested
                    </QuickChip>
                    <QuickChip onClick={() => setResolution("Repair incomplete. Equipment remains unavailable pending follow-up work.")}>
                      Not fully repaired
                    </QuickChip>
                  </div>
                </div>
              </div>
            </details>

            <div style={{ display: "grid", gap: 18 }}>
              <SectionCard
                number="1"
                title="Timeline"
                subtitle="Capture when the team arrived and when the job was completed."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <Field
                    label="Time Arrived"
                    hint="Optional, but useful for response-time reporting."
                  >
                    <input
                      className="input"
                      type="time"
                      value={timeArrived}
                      onChange={(e) => setTimeArrived(e.target.value)}
                    />
                  </Field>

                  <Field
                    label="Time Complete"
                    hint="This is required to close the breakdown."
                    required
                  >
                    <input
                      className="input"
                      type="time"
                      value={timeComplete}
                      onChange={(e) => setTimeComplete(e.target.value)}
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                number="2"
                title="Work performed"
                subtitle="Describe the fix in plain, useful language someone else can understand tomorrow."
              >
                <div style={{ display: "grid", gap: 14 }}>
                  <Field
                    label="Final Resolution"
                    hint="This should read well in reports and handovers."
                    required
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 10,
                      }}
                    >
                      <QuickChip onClick={() => setResolution("Breakdown resolved and equipment returned to service.")}>
                        Returned to service
                      </QuickChip>
                      <QuickChip onClick={() => setResolution("Fault isolated, component replaced, and machine tested successfully.")}>
                        Replaced + tested
                      </QuickChip>
                      <QuickChip onClick={() => setResolution("Temporary repair completed and monitoring required on next shift.")}>
                        Temporary repair
                      </QuickChip>
                      <QuickChip onClick={() => setResolution("Repair incomplete. Equipment remains unavailable pending follow-up work.")}>
                        Not repaired
                      </QuickChip>
                    </div>
                    <textarea
                      className="input"
                      rows={3}
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Example: Breakdown resolved, conveyor returned to service after sensor replacement and test run."
                    />
                  </Field>

                  <Field
                    label="Action Taken"
                    hint="List checks, repairs, parts replaced, and tests performed."
                  >
                    <textarea
                      className="input"
                      rows={4}
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      placeholder="Example: Inspected motor, replaced failed bearing, reset overload, and verified stable running for 20 minutes."
                    />
                  </Field>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 14,
                    }}
                  >
                    <Field label="Repair Status">
                      <select className="input" value={repair} onChange={(e) => setRepair(e.target.value)}>
                        <option value="Yes">Yes, repaired</option>
                        <option value="No">No, not repaired</option>
                        <option value="Partial">Partial repair</option>
                      </select>
                    </Field>

                    <Field
                      label="PM Job Card No."
                      hint="Optional reference number."
                    >
                      <input
                        className="input"
                        value={pmJobCardNo}
                        onChange={(e) => setPmJobCardNo(e.target.value)}
                        placeholder="Example: PM-12345"
                      />
                    </Field>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                number="3"
                title="Delays encountered"
                subtitle="Capture non-repair delays so downtime reporting tells the full story."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <Field
                    label="Delay reason"
                    hint="Optional. Example: waiting for spares, access permit, travel time."
                  >
                    <input
                      className="input"
                      value={otherDelays}
                      onChange={(e) => setOtherDelays(e.target.value)}
                      placeholder="Example: Waiting for spares"
                    />
                  </Field>

                  <Field
                    label="Delay time (minutes)"
                    hint="Optional extra delay, excluding response delay."
                  >
                    <input
                      className="input"
                      value={otherDelaysMinutes}
                      onChange={(e) => setOtherDelaysMinutes(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                number="4"
                title="Shift handover"
                subtitle="Leave the next shift a clean, useful summary."
              >
                <Field
                  label="Close-out summary"
                  hint="A short handover note for the next team."
                >
                  <textarea
                    className="input"
                    rows={3}
                    value={closeOut}
                    onChange={(e) => setCloseOut(e.target.value)}
                    placeholder="Example: Replaced sensor, tested run OK, monitor temperature on next shift."
                  />
                </Field>
              </SectionCard>

              {toast && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background:
                      toast.type === "error"
                        ? "rgba(239,68,68,0.10)"
                        : "rgba(16,185,129,0.10)",
                    color: toast.type === "error" ? "#b91c1c" : "#047857",
                    border: `1px solid ${
                      toast.type === "error"
                        ? "rgba(239,68,68,0.18)"
                        : "rgba(16,185,129,0.18)"
                    }`,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {toast.text}
                </div>
              )}

              <div
                style={{
                  position: "sticky",
                  bottom: 10,
                  zIndex: 10,
                  padding: 14,
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.88)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(15,23,42,0.08)",
                  boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                      Ready to close
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                      {validationErrors.length === 0
                        ? "All required fields completed"
                        : `${validationErrors.length} item${validationErrors.length > 1 ? "s" : ""} still needed`}
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Downtime: <strong style={{ color: "#0f172a" }}>{formatMinutesHuman(downtimeMinutes)}</strong> • Delay:{" "}
                    <strong style={{ color: "#0f172a" }}>{formatMinutesHuman(totalDelayMinutes)}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={saveCloseOut}
                    disabled={loading}
                    style={{
                      minWidth: 220,
                      boxShadow: "0 12px 28px rgba(37,99,235,0.20)",
                    }}
                  >
                    {loading ? "Closing breakdown..." : "Confirm and Close Breakdown"}
                  </button>

                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => router.push("/admin")}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}