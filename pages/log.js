import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout"; // adjust if needed
import { supabase } from "../lib/supabaseClient"; // adjust if needed

export default function LogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // fields matching breakdowns table
  const [mineSite, setMineSite] = useState("Dishaba");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const [startTime, setStartTime] = useState(hhmm);
  const [endTime, setEndTime] = useState(hhmm);
  const [isPast, setIsPast] = useState(false); // when true, allow manual date/time
  const [category, setCategory] = useState("");
  const [equipmentItem, setEquipmentItem] = useState("");
  const [level, setLevel] = useState(""); // 'Lower' or 'Upper'
  const [section, setSection] = useState("");
  const [eventType, setEventType] = useState("Breakdown"); // dropdown
  const [description, setDescription] = useState("");
  const commonIssues = [
    "Power failure",
    "Mechanical jam",
    "Sensor fault",
    "Overheating",
    "Other",
  ];
  const [supervisor, setSupervisor] = useState(""); // supervisor id (from dropdown)
  const [operator, setOperator] = useState("");     // operator id (from dropdown)
  // shift is derived via memo
  // eslint-disable-next-line no-unused-vars
  const [reviewData, setReviewData] = useState(null);
  // compute shift automatically based on startTime/endTime
  // downtime not entered here; calculated on close

  // Dropdown lists
  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);

  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["operator", "supervisor"]);

      if (error) {
        setToast({ type: "error", text: error.message });
        return;
      }

      const profiles = data || [];

      setOperatorList(
        profiles
          .filter((p) => p.role === "operator")
          .map((p) => ({ id: p.id, name: p.full_name || p.id }))
      );

      setSupervisorList(
        profiles
          .filter((p) => p.role === "supervisor")
          .map((p) => ({ id: p.id, name: p.full_name || p.id }))
      );
    }

    async function fetchEquipment() {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, name, category, section")
        .eq("is_active", true);

      if (error) {
        setToast({ type: "error", text: error.message });
        return;
      }

      setEquipmentList(data || []);
    }

    fetchProfiles();
    fetchEquipment();
  }, []);

  // equipment change handler will auto-fill category & section

  // compute shift via memo, no effect needed
  const shift = useMemo(() => {
    function calcShift(start, end) {
      if (!start) return '';
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = (end || start).split(':').map(Number);
      const mins1 = h1 * 60 + m1;
      const mins2 = h2 * 60 + m2;
      if (mins2 < mins1) return 'Night';
      if (mins1 >= 360 && mins1 < 1080) return 'Day';
      return 'Night';
    }
    return calcShift(startTime, endTime);
  }, [startTime, endTime]);

  // no effect; reset handled in checkbox onChange

  const submit = async (e) => {
    e.preventDefault();
    setToast(null);
    // prepare operator/supervisor objects
    const operatorObj = operatorList.find((o) => o.id === operator);
    const supervisorObj = supervisorList.find((s) => s.id === supervisor);
    if (!startTime) return setToast({ type: "error", text: "Start time is required" });
    if (!endTime) return setToast({ type: "error", text: "End time is required" });
    if (!category.trim()) return setToast({ type: "error", text: "Category is required" });
    if (!equipmentItem.trim()) return setToast({ type: "error", text: "Select equipment" });
    if (!section.trim()) return setToast({ type: "error", text: "Section is required" });
    if (!eventType) return setToast({ type: "error", text: "Select event type" });
    if (!supervisor) return setToast({ type: "error", text: "Select supervisor" });
    if (!operator) return setToast({ type: "error", text: "Select operator" });
    if (!shift) return setToast({ type: "error", text: "Select shift" });


    setLoading(true);
    try {
      const payload = {
        mine_site: mineSite || "Dishaba",
        occurred_on: occurredOn,
        start_time: startTime,
        end_time: endTime,
        category: category.trim(),
        equipment_item: equipmentItem.trim(),
        level: level || null,
        section: section.trim(),
        event_type: eventType || "Breakdown",
        description: description || null,

        // supervisor column is TEXT, so store name (readable)
        supervisor: supervisorObj?.name || null,

        shift: shift || null,

        reported_by: operator, // uuid
        reported_by_name: operatorObj?.name || null,

        status: "Open",
      };
      setReviewData(payload);
      setLoading(false);
      return;
    } catch (err) {
      setToast({ type: "error", text: err.message || String(err) });
      setLoading(false);
    }
  };

  return (
    <Layout title="Log breakdown — Dishaba Mine" pageTitle="Log breakdown">
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            className="input"
            value={mineSite}
            onChange={(e) => setMineSite(e.target.value)}
            placeholder="Mine site"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              id="past-toggle"
              type="checkbox"
              checked={isPast}
              onChange={(e) => setIsPast(e.target.checked)}
            />
            <label htmlFor="past-toggle">Past incident</label>
          </div>
          <input
            className="input"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            disabled={!isPast}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input
            className="input"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="Start time"
            disabled={!isPast}
          />
          <input
            className="input"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="End time"
            disabled={!isPast}
          />
          <input
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            readOnly={!!equipmentItem}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <select className="input" value={equipmentItem} onChange={(e) => setEquipmentItem(e.target.value)}>
            <option value="">Select equipment</option>
            {equipmentList.map((eq) => (
              <option key={eq.id} value={eq.name}>
                {eq.name}
              </option>
            ))}
          </select>

          <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Select level</option>
            <option value="Lower">Lower</option>
            <option value="Upper">Upper</option>
          </select>

          <input
            className="input"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Section"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            className="input"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="Event type"
          />
          <select className="input" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}>
            <option value="">Select supervisor</option>
            {supervisorList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select className="input" value={operator} onChange={(e) => setOperator(e.target.value)}>
            <option value="">Select operator</option>
            {operatorList.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <input className="input" value={shift} readOnly placeholder="Shift (auto)" />
        </div>

        <textarea
          className="input"
          rows={4}
          list="common-issues"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description / notes (optional)"
        />
        <datalist id="common-issues">
          {commonIssues.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>



        {toast && (
          <div
            style={{
              padding: 8,
              borderRadius: 8,
              background: toast.type === "error" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
              color: toast.type === "error" ? "#ef4444" : "#059669",
            }}
          >
            {toast.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn primary" disabled={loading}>
            {loading ? "Logging…" : "Review"}
          </button>
          <button type="button" className="btn ghost" onClick={() => {
            setReviewData(null);
            router.push("/admin");
          }}>
            Cancel
          </button>
        </div>
      </form>
      {reviewData && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Review breakdown before saving</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(reviewData, null, 2)}</pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn primary"
              onClick={async () => {
                setLoading(true);
                try {
                  const { data, error } = await supabase.from('breakdowns').insert([reviewData]).select();
                  if (error) throw error;
                  const created = data && data[0];
                  try { window.dispatchEvent(new CustomEvent('breakdown:created', { detail: created })); } catch (_) {
  // ignore
}
                  setToast({ type: 'success', text: 'Breakdown logged' });
                  router.push('/admin');
                } catch (e) {
                  setToast({ type: 'error', text: String(e) });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Confirm & Save'}
            </button>
            <button
              className="btn ghost"
              onClick={() => setReviewData(null)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}