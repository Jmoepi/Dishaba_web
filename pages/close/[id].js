import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { supabase } from "../../lib/supabaseClient";

function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e < s) e += 24 * 60; // overnight
  return Math.max(0, e - s);
}

export default function CloseOutPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [record, setRecord] = useState(null);

  // close-out fields
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

        // seed form fields from record
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

  const totalDelayMinutes = useMemo(() => {
    const responseDelay =
      record?.time_called && timeArrived
        ? diffMinutes(record.time_called, timeArrived)
        : 0;

    const rawOther = String(otherDelaysMinutes || "").trim();
    const otherMins = rawOther === "" ? 0 : Number.parseInt(rawOther, 10);
    const otherValid =
      Number.isFinite(otherMins) && otherMins >= 0 ? otherMins : 0;

    return responseDelay + otherValid;
  }, [record?.time_called, timeArrived, otherDelaysMinutes]);

  const saveCloseOut = async () => {
    setToast(null);

    if (!record) return;
    if (!timeComplete)
      return setToast({
        type: "error",
        text: "Time Complete is required to close the breakdown.",
      });

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setLoading(false);
        return setToast({ type: "error", text: "Sign in first" });
      }

      let closedOutName = user.email || "User";
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (p?.full_name) closedOutName = p.full_name;
      } catch (_) {
        // ignore
      }

      const updatePayload = {
        time_arrived: timeArrived || null,
        end_time: timeComplete,
        close_out: closeOut || null,
        action_taken: actionTaken || null,
        pm_job_card_no: pmJobCardNo || null,
        repair: repair || null,
        other_delays: otherDelays || null,

        downtime_minutes: downtimeMinutes,
        delay_time_minutes: totalDelayMinutes,

        resolution: resolution || null,

        closed_out_by: user.id,
        closed_out_by_name: closedOutName,

        status: "Closed",
      };

      const { error } = await supabase
        .from("breakdowns")
        .update(updatePayload)
        .eq("id", record.id);

      if (error) throw error;

      setToast({ type: "success", text: "Breakdown closed successfully" });
      router.push("/admin");
    } catch (e) {
      setToast({ type: "error", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout
      title="Close out breakdown — Dishaba Mine"
      pageTitle="Close out breakdown"
    >
      {!record && !loading && (
        <div className="card">
          <div style={{ fontWeight: 600 }}>No record found</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Check the breakdown ID in the URL.
          </div>
        </div>
      )}

      {record && (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Logged details</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                fontSize: 14,
              }}
            >
              <div><b>Date:</b> {record.occurred_on}</div>
              <div><b>Shift:</b> {record.shift || "-"}</div>
              <div><b>Time Reported:</b> {record.start_time}</div>
              <div><b>Time Called:</b> {record.time_called || "-"}</div>
              <div><b>Category:</b> {record.category}</div>
              <div><b>Equipment:</b> {record.equipment_item}</div>
              <div><b>Section:</b> {record.section}</div>
              <div><b>Supervisor:</b> {record.supervisor || "-"}</div>
              <div><b>Reported By:</b> {record.reported_by_name || "-"}</div>
              <div><b>Reported To:</b> {record.reported_to || "-"}</div>
            </div>

            {record.description && (
              <div style={{ marginTop: 14, fontSize: 14 }}>
                <b>Description:</b>
                <div style={{ opacity: 0.9, marginTop: 4, fontStyle: 'italic' }}>
                  &quot;{record.description}&quot;
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Close-Out Report</h3>
            <p style={{ fontSize: 14, opacity: 0.9, marginTop: -10, marginBottom: 20 }}>
              Follow the steps below to close this breakdown record.
            </p>

            {/* --- STEP 1: TIMELINE --- */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
              <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24, color: '#999' }}>1</span>
                <span>Timeline</span>
              </h4>
              <div style={{ paddingLeft: 32 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Time Arrived</div>
                    <input
                      className="input"
                      type="time"
                      value={timeArrived}
                      onChange={(e) => setTimeArrived(e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Time Complete*</div>
                    <input
                      className="input"
                      type="time"
                      value={timeComplete}
                      onChange={(e) => setTimeComplete(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Total Downtime</div>
                  <input
                    className="input"
                    value={`${downtimeMinutes} minutes`}
                    readOnly
                    style={{ background: '#f9f9f9' }}
                  />
                </div>
              </div>
            </div>

            {/* --- STEP 2: WORK PERFORMED --- */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
              <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24, color: '#999' }}>2</span>
                <span>Work Performed</span>
              </h4>
              <div style={{ paddingLeft: 32, display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Resolution*</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    Provide a final resolution statement for reporting.
                  </div>
                  <textarea
                    className="input"
                    rows={2}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="e.g. Breakdown resolved, conveyor returned to service."
                    required
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Action Taken</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    Describe the steps taken, parts replaced, tests, etc.
                  </div>
                  <textarea
                    className="input"
                    rows={3}
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="e.g. Inspected motor, replaced bearing, ran for 20 minutes."
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Repair Status</div>
                    <select className="input" value={repair} onChange={(e) => setRepair(e.target.value)}>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Partial">Partial</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>PM Job Card No.</div>
                    <input
                      className="input"
                      value={pmJobCardNo}
                      onChange={(e) => setPmJobCardNo(e.target.value)}
                      placeholder="e.g. PM-12345"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* --- STEP 3: DELAYS --- */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
              <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24, color: '#999' }}>3</span>
                <span>Delays Encountered</span>
              </h4>
              <div style={{ paddingLeft: 32, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Delay Reason</div>
                    <input
                      className="input"
                      value={otherDelays}
                      onChange={(e) => setOtherDelays(e.target.value)}
                      placeholder="e.g. Waiting for spares"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Delay Time (minutes)</div>
                    <input
                      className="input"
                      value={otherDelaysMinutes}
                      onChange={(e) => setOtherDelaysMinutes(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Total Delay Time</div>
                   <input
                    className="input"
                    value={`${totalDelayMinutes} minutes (includes response time)`}
                    readOnly
                    style={{ background: '#f9f9f9' }}
                  />
                </div>
              </div>
            </div>

            {/* --- STEP 4: HANDOVER --- */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
              <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24, color: '#999' }}>4</span>
                <span>Shift Handover</span>
              </h4>
              <div style={{ paddingLeft: 32, display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Summary for next shift</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    A brief summary of the work done.
                  </div>
                  <textarea
                    className="input"
                    rows={2}
                    value={closeOut}
                    onChange={(e) => setCloseOut(e.target.value)}
                    placeholder="e.g. Reset overload, replaced sensor, tested run OK."
                  />
                </div>
              </div>
            </div>

            {toast && (
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  borderRadius: 8,
                  background: toast.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                  color: toast.type === "error" ? "#ef4444" : "#059669",
                  border: `1px solid ${toast.type === "error" ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                }}
              >
                {toast.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 20, borderTop: '1px solid #eee', paddingTop: 14 }}>
              <button
                className="btn primary"
                onClick={saveCloseOut}
                disabled={loading}
              >
                {loading ? "Saving…" : "Confirm & Close Breakdown"}
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
      )}
    </Layout>
  );
}
