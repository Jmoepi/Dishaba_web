import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";

const STEPS = ["Basics", "Equipment", "Details", "Review"];

function ProgressBar({ step, setStep }) {
  const curIdx = STEPS.indexOf(step);
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ textAlign: "center" }}>
            <button
              className={`pill ${curIdx === i ? "primary" : curIdx > i ? "ghost" : ""}`}
              onClick={() => {
                if (i < curIdx) setStep(s);
              }}
              disabled={i > curIdx}
            >
              {i + 1}
            </button>
            <div className="small" style={{ marginTop: 4 }}>
              {s}
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: curIdx > i ? "#ccc" : "#eee",
                margin: "16px 10px 0",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function LogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [step, setStep] = useState("Basics");

  // core fields
  const mineSite = "Dishaba";
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));

  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);

  const [timeReported, setTimeReported] = useState(hhmm);
  const [timeCalled, setTimeCalled] = useState(hhmm);
  const [timeArrived, setTimeArrived] = useState("");
  const [timeComplete, setTimeComplete] = useState("");
  const [isPast, setIsPast] = useState(false);

  const [locationOrLevel, setLocationOrLevel] = useState("");
  const [section, setSection] = useState("");
  const [category, setCategory] = useState("");
  const [equipmentItem, setEquipmentItem] = useState("");
  const [eventType, setEventType] = useState("Breakdown");

  const [reportedTo, setReportedTo] = useState("");
  const [crOperator, setCrOperator] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [onShiftCallOut, setOnShiftCallOut] = useState("On Shift");

  const [description, setDescription] = useState("");
  const commonIssues = ["Power failure", "Mechanical jam", "Sensor fault", "Overheating", "Other"];

  const [reviewData, setReviewData] = useState(null);

  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data: staff, error: sError } = await supabase
        .from("staff")
        .select("id, full_name, role")
        .eq("is_active", true)
        .in("role", ["operator", "supervisor"])
        .order("full_name", { ascending: true });

      if (sError) setToast({ type: "error", text: sError.message });
      else {
        const staffData = staff || [];
        setOperatorList(staffData.filter(p => p.role === 'operator'));
        setSupervisorList(staffData.filter(p => p.role === 'supervisor'));
      }

      const { data: equipment, error: eError } = await supabase
        .from("equipment")
        .select("id, name, category, section")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (eError) setToast({ type: "error", text: eError.message });
      else setEquipmentList(equipment || []);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!equipmentItem) return;
    const eq = equipmentList.find((x) => x.name === equipmentItem);
    if (!eq) return;
  
    if (!category && eq.category) setCategory(eq.category);
    if (!section && eq.section) setSection(eq.section);
  }, [equipmentItem, equipmentList, category, section]);

  const shift = useMemo(() => {
    if (!timeReported) return "";
    const [h, m] = timeReported.split(":").map(Number);
    const minutes = h * 60 + m;
    if (minutes >= 360 && minutes < 1080) return "Day";
    return "Night";
  }, [timeReported]);

  const validateAndProceed = () => {
    setToast(null);
    switch (step) {
      case "Basics":
        if (!occurredOn || !timeReported || !timeCalled || !eventType) {
          return setToast({ type: "error", text: "Please fill all required fields in Basics." });
        }
        setStep("Equipment");
        break;
      case "Equipment":
        if (!equipmentItem || !category.trim() || !section.trim()) {
          return setToast({ type: "error", text: "Please fill all required fields in Equipment." });
        }
        setStep("Details");
        break;
      case "Details":
        if (!operatorId || !supervisorId) {
          return setToast({ type: "error", text: "Please select the operator and supervisor." });
        }
        submit();
        break;
      default:
        break;
    }
  };

  const submit = async () => {
    setToast(null);
    setLoading(true);
    
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      setLoading(false);
      return setToast({ type: "error", text: "You must be logged in to submit a breakdown." });
    }

    const operatorObj = operatorList.find((o) => o.id === operatorId);
    const supervisorObj = supervisorList.find((s) => s.id === supervisorId);

    const payload = {
      mine_site: mineSite,
      occurred_on: occurredOn,
      start_time: timeReported,
      end_time: timeComplete || timeReported,
      event_type: eventType,
      level: null,
      section: section.trim(),
      category: category.trim(),
      equipment_item: equipmentItem.trim(),
      description: description || null,
      time_called: timeCalled,
      time_arrived: timeArrived || null,
      location_or_level: locationOrLevel || null,
      reported_to: reportedTo || null,
      cr_operator: crOperator || null,
      on_shift_call_out: onShiftCallOut || null,
      
      // IDs for relations
      reported_by: auth.user.id,
      operator_id: operatorId,
      supervisor_id: supervisorId,

      // Denormalized names for easier display
      reported_by_name: operatorObj?.full_name || null,
      supervisor: supervisorObj?.full_name || null,
      
      shift: shift || null,
      downtime_minutes: 0,
      delay_time_minutes: 0,
      status: "Open",
    };
    
    setReviewData(payload);
    setLoading(false);
    setStep("Review");
  };
  
  const finalSubmit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("breakdowns")
        .insert([reviewData])
        .select();

      if (error) throw error;
      const created = data && data[0];

      try {
        window.dispatchEvent(new CustomEvent("breakdown:created", { detail: created }));
      } catch (_) {
        // ignore
      }

      setToast({ type: "success", text: "Breakdown logged" });

      router.push("/admin");
    } catch (e) {
      setToast({ type: "error", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "Basics":
        return (
          <div className="card">
            <h3>Basics</h3>
            <p className="small muted">Start with when and what type of event it is.</p>
            <div>
          <div style={{ fontWeight: 600 }}>Date of incident</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            If it happened earlier (not “right now”), tick <b>Past incident</b> to edit date/time.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
            <input
              className="input"
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              disabled={!isPast}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
              <input
                type="checkbox"
                checked={isPast}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsPast(checked);
                  if (!checked) {
                    const n = new Date();
                    setOccurredOn(n.toISOString().slice(0, 10));
                    const t = n.toTimeString().slice(0, 5);
                    setTimeReported(t);
                    setTimeCalled(t);
                  }
                }}
              />
              Past incident
            </label>
          </div>
        </div>

        {/* SECTION: Times */}
        <div>
          <div style={{ fontWeight: 600 }}>Times (as in Excel)</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            Time Reported + Time Called are logged at the start. Time Arrived/Complete can be filled now or on Close-Out.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Time Reported</div>
              <input
                className="input"
                type="time"
                value={timeReported}
                onChange={(e) => setTimeReported(e.target.value)}
                disabled={!isPast}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Time Called</div>
              <input
                className="input"
                type="time"
                value={timeCalled}
                onChange={(e) => setTimeCalled(e.target.value)}
                disabled={!isPast}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Time Arrived (optional)</div>
              <input
                className="input"
                type="time"
                value={timeArrived}
                onChange={(e) => setTimeArrived(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Time Complete (optional)</div>
              <input
                className="input"
                type="time"
                value={timeComplete}
                onChange={(e) => setTimeComplete(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Event Type</div>
          <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="Breakdown">Breakdown</option>
            <option value="Delay">Delay</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Standby">Standby</option>
            <option value="Other">Other</option>
          </select>
        </div>
          </div>
        );
      case "Equipment":
        return (
          <div className="card">
            <h3>Equipment</h3>
            <p className="small muted">Specify the equipment involved.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Equipment Item</div>
              <select className="input" value={equipmentItem} onChange={(e) => setEquipmentItem(e.target.value)}>
                <option value="">Select equipment</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.name}>
                    {eq.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Category</div>
              <input
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                readOnly={!!equipmentItem}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Section</div>
              <input
                className="input"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Engineering / Production"
              />
            </div>
          </div>
          </div>
        );
      case "Details":
        return (
          <div className="card">
            <h3>Details</h3>
            <p className="small muted">Provide more details about the event.</p>
            <div>
          <div style={{ fontWeight: 600 }}>People & Shift</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            Who reported, who was responsible, and whether it was on shift or a call-out.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Operator (Reported by in Excel)</div>
              <select className="input" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                <option value="">Select operator</option>
                {operatorList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Responsible Supervisor</div>
              <select className="input" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
                <option value="">Select supervisor</option>
                {supervisorList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Reported To (optional)</div>
              <input
                className="input"
                value={reportedTo}
                onChange={(e) => setReportedTo(e.target.value)}
                placeholder="Name/role of person notified"
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>C.R. Operator (optional)</div>
              <input
                className="input"
                value={crOperator}
                onChange={(e) => setCrOperator(e.target.value)}
                placeholder="If applicable"
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>On Shift / Call Out</div>
              <select className="input" value={onShiftCallOut} onChange={(e) => setOnShiftCallOut(e.target.value)}>
                <option value="On Shift">On Shift</option>
                <option value="Call Out">Call Out</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Shift (auto)</div>
            <input className="input" value={shift} readOnly placeholder="Shift (auto)" />
          </div>
        </div>

        {/* SECTION: Description outside the box */}
        <div>
          <div style={{ fontWeight: 600 }}>Description / Notes</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            Write what happened, symptoms, and any immediate action taken. Keep it short but specific.
          </div>

          <textarea
            className="input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Conveyor motor tripped, overheating alarm, operator stopped line and isolated power."
          />
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8}}>
            {commonIssues.map((i) => (
              <button key={i} className="btn ghost small" onClick={() => setDescription(d => d ? `${d}, ${i}`: i)}>{i}</button>
            ))}
            </div>
        </div>
          </div>
        );
      case "Review": {
        if (!reviewData) {
            return (
            <div className="card">
                <h3>Review and Submit</h3>
                <p>Go back to previous steps to enter breakdown details.</p>
            </div>
            );
        }
        
        const reviewItems = [
            { label: "Date of Incident", value: reviewData.occurred_on },
            { label: "Time Reported", value: reviewData.start_time },
            { label: "Time Called", value: reviewData.time_called },
            { label: "Shift", value: reviewData.shift },
            { label: "Event Type", value: reviewData.event_type },
            { label: "Location", value: reviewData.location_or_level || reviewData.level },
            { label: "Equipment", value: reviewData.equipment_item },
            { label: "Category", value: reviewData.category },
            { label: "Section", value: reviewData.section },
            { label: "Reported By", value: reviewData.reported_by_name },
            { label: "Supervisor", value: reviewData.supervisor },
            { label: "Reported To", value: reviewData.reported_to },
            { label: "CR Operator", value: reviewData.cr_operator },
            { label: "On Shift / Call Out", value: reviewData.on_shift_call_out },
            { label: "Description", value: reviewData.description, span: 2 },
        ];
    
        return (
            <div className="card">
            <h3>Review and Submit</h3>
            <p className="small muted">Please check the details below. You can go back to make changes.</p>
            
            <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                {reviewItems.map(({ label, value, span }) => (
                    <div key={label} style={{ gridColumn: span ? `span ${span}` : 'span 1' }}>
                        <div className="small muted" style={{ marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
                    </div>
                ))}
                </div>
            </div>
    
            <div style={{ display: "flex", gap: 8, marginTop: 24, borderTop: '1px solid #eee', paddingTop: 20 }}>
                <button
                className="btn primary"
                onClick={finalSubmit}
                disabled={loading}
                >
                {loading ? "Saving…" : "Confirm & Save"}
                </button>
    
                <button className="btn ghost" onClick={() => setStep("Details")} disabled={loading}>
                  Back to edit
                </button>
            </div>
            </div>
        );
    }
      default:
        return null;
    }
  };

  return (
    <Layout title="Log Breakdown" pageTitle="Log a New Breakdown">
      <ProgressBar step={step} setStep={setStep} />
      {toast && <div style={{padding: 8, borderRadius: 8, background: toast.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: toast.type === 'error' ? '#ef4444' : '#059669', marginBottom: 12}}>{toast.text}</div>}
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {renderStep()}
        <div style={{ display: "flex", justifyContent: step === 'Basics' ? 'flex-end' : "space-between", marginTop: 20 }}>
          {step !== "Basics" && step !== "Review" && <button className="btn ghost" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>Back</button>}
          {step !== "Review" && <button className="btn primary" onClick={validateAndProceed} disabled={loading}>{loading ? "Working..." : "Next"}</button>}
        </div>
      </div>
    </Layout>
  );
}
