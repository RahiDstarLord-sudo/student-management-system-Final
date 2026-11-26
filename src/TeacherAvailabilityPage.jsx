import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "./services/apiConfig";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EMPTY = {
  teacher_id: "",
  day_of_week: "Monday",
  start_time: "09:00",
  end_time: "10:00",
  availability_type: "unavailable",
  effective_from: "",
  effective_until: "",
  reason: "",
};

function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders({
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function TeacherAvailabilityPage() {
  const [records, setRecords] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [dayFilter, setDayFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, teacherRows] = await Promise.all([
        request("/teacher-availability"),
        request("/teachers"),
      ]);
      setRecords(Array.isArray(rows) ? rows : []);
      setTeachers(Array.isArray(teacherRows)
        ? teacherRows.filter(t =>
            t.status === "Active" &&
            String(t.registration_status || "").toLowerCase() === "approved"
          )
        : []);
    } catch (err) {
      setError(err.message || "Could not load teacher availability.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const teacherName = useCallback((id) => {
    const teacher = teachers.find(t => String(t.teacher_id) === String(id));
    return teacher?.teacher_name || teacher?.name || teacher?.full_name ||
      teacher?.teacher_code || `Teacher #${id}`;
  }, [teachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(item => {
      const name = teacherName(item.teacher_id);
      const matchesSearch = !q ||
        `${name} ${item.teacher_id} ${item.reason || ""}`.toLowerCase().includes(q);
      return matchesSearch &&
        (typeFilter === "All" || item.availability_type === typeFilter) &&
        (dayFilter === "All" || item.day_of_week === dayFilter);
    });
  }, [records, search, typeFilter, dayFilter, teacherName]);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function editRecord(item) {
    setEditingId(item.id);
    setForm({
      teacher_id: String(item.teacher_id),
      day_of_week: item.day_of_week,
      start_time: String(item.start_time).slice(0, 5),
      end_time: String(item.end_time).slice(0, 5),
      availability_type: item.availability_type,
      effective_from: item.effective_from ? String(item.effective_from).slice(0, 10) : "",
      effective_until: item.effective_until ? String(item.effective_until).slice(0, 10) : "",
      reason: item.reason || "",
    });
    setError("");
    setNotice("");
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!form.teacher_id) throw new Error("Select a teacher.");
      if (form.start_time >= form.end_time) throw new Error("End time must be later than start time.");
      if (form.effective_from && form.effective_until &&
          form.effective_from > form.effective_until) {
        throw new Error("Effective until cannot be earlier than effective from.");
      }

      const payload = {
        ...form,
        teacher_id: Number(form.teacher_id),
        effective_from: form.effective_from || null,
        effective_until: form.effective_until || null,
        reason: form.reason.trim() || null,
      };

      if (editingId) {
        await request(`/teacher-availability/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Teacher availability updated successfully.");
      } else {
        await request("/teacher-availability", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Teacher availability created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(item) {
    if (!window.confirm(`Delete this ${item.availability_type} record for ${teacherName(item.teacher_id)}?`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request(`/teacher-availability/${item.id}`, { method: "DELETE" });
      setNotice("Availability record deleted.");
      if (editingId === item.id) resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete availability.");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = {
    width: "100%", minWidth: 0, padding: "10px 12px",
    border: "1px solid #d8deea", borderRadius: 9,
    background: "#fff", color: "#172033",
  };
  const labelStyle = {
    display: "grid", gap: 6, fontSize: 13,
    fontWeight: 600, color: "#475467",
  };
  const buttonStyle = {
    border: "1px solid #d8deea", borderRadius: 9,
    padding: "9px 13px", background: "#fff",
    color: "#344054", cursor: "pointer", fontWeight: 600,
  };

  const availableCount = records.filter(r => r.availability_type === "available").length;
  const unavailableCount = records.filter(r => r.availability_type === "unavailable").length;

  return (
    <section className="surface" style={{ marginTop: 24, padding: 24 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "start", gap: 16, flexWrap: "wrap", marginBottom: 20
      }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1.2, fontWeight: 700, color: "#64748b" }}>
            ACADEMIC MANAGEMENT
          </p>
          <h2 style={{ margin: 0, fontSize: 24, color: "#172033" }}>Teacher Availability</h2>
          <p style={{ margin: "7px 0 0", color: "#667085", fontSize: 14 }}>
            Manage weekly available and unavailable time slots for teachers.
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={loadData} disabled={loading || saving}>
          Refresh
        </button>
      </div>

      {error && <div role="alert" style={{ padding: 12, borderRadius: 9, background: "#fef3f2", color: "#b42318", marginBottom: 14 }}>{error}</div>}
      {notice && <div role="status" style={{ padding: 12, borderRadius: 9, background: "#ecfdf3", color: "#027a48", marginBottom: 14 }}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 22 }}>
        {[
          ["Total records", records.length],
          ["Available slots", availableCount],
          ["Unavailable slots", unavailableCount],
        ].map(([label, value]) => (
          <div key={label} style={{ border: "1px solid #e4e7ec", borderRadius: 12, padding: 16 }}>
            <div style={{ color: "#667085", fontSize: 12, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 25, fontWeight: 700, color: "#172033", marginTop: 5 }}>{value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={saveRecord} style={{ border: "1px solid #e4e7ec", borderRadius: 13, padding: 18, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 17, color: "#172033" }}>
          {editingId ? "Edit Availability" : "Add Availability"}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          <label style={labelStyle}>
            Teacher *
            <select required value={form.teacher_id} onChange={e => setForm(p => ({ ...p, teacher_id: e.target.value }))} style={fieldStyle}>
              <option value="">Select teacher</option>
              {teachers.map(t => (
                <option key={t.teacher_id} value={t.teacher_id}>
                  {t.teacher_code || `Teacher #${t.teacher_id}`} — {t.teacher_name || t.name || t.full_name || "Teacher"}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Day of week *
            <select value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: e.target.value }))} style={fieldStyle}>
              {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            Availability type *
            <select value={form.availability_type} onChange={e => setForm(p => ({ ...p, availability_type: e.target.value }))} style={fieldStyle}>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>

          <label style={labelStyle}>
            Start time *
            <input required type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            End time *
            <input required type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            Effective from
            <input type="date" value={form.effective_from} onChange={e => setForm(p => ({ ...p, effective_from: e.target.value }))} style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            Effective until
            <input type="date" value={form.effective_until} onChange={e => setForm(p => ({ ...p, effective_until: e.target.value }))} style={fieldStyle} />
          </label>

          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            Reason / Notes
            <input maxLength={255} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Optional reason or notes" style={fieldStyle} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button type="submit" disabled={saving} style={{ ...buttonStyle, background: "#2457d6", borderColor: "#2457d6", color: "#fff", opacity: saving ? 0.65 : 1 }}>
            {saving ? "Saving..." : editingId ? "Update Availability" : "Save Availability"}
          </button>
          {editingId && <button type="button" onClick={resetForm} disabled={saving} style={buttonStyle}>Cancel Edit</button>}
        </div>
      </form>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teacher or reason..." style={{ ...fieldStyle, flex: "1 1 220px" }} />
        <select value={dayFilter} onChange={e => setDayFilter(e.target.value)} style={{ ...fieldStyle, width: "auto", minWidth: 145 }}>
          <option value="All">All days</option>
          {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...fieldStyle, width: "auto", minWidth: 155 }}>
          <option value="All">All types</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #e4e7ec", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#475467", textAlign: "left" }}>
              {["Teacher", "Day", "Time", "Type", "Effective period", "Reason", "Actions"].map(label => (
                <th key={label} style={{ padding: "12px 13px", borderBottom: "1px solid #e4e7ec", whiteSpace: "nowrap" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: 24, textAlign: "center", color: "#667085" }}>Loading availability...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 24, textAlign: "center", color: "#667085" }}>No availability records found.</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id}>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3", fontWeight: 600 }}>
                  {teacherName(item.teacher_id)}
                </td>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3" }}>{item.day_of_week}</td>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3", whiteSpace: "nowrap" }}>
                  {String(item.start_time).slice(0, 5)} – {String(item.end_time).slice(0, 5)}
                </td>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3" }}>
                  <span style={{
                    display: "inline-block", padding: "4px 8px", borderRadius: 20,
                    background: item.availability_type === "available" ? "#ecfdf3" : "#fef3f2",
                    color: item.availability_type === "available" ? "#027a48" : "#b42318",
                    fontWeight: 700, textTransform: "capitalize"
                  }}>{item.availability_type}</span>
                </td>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3", whiteSpace: "nowrap" }}>
                  {item.effective_from ? String(item.effective_from).slice(0, 10) : "No start"} – {item.effective_until ? String(item.effective_until).slice(0, 10) : "No end"}
                </td>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3" }}>{item.reason || "—"}</td>
                <td style={{ padding: "12px 13px", borderBottom: "1px solid #eef0f3", whiteSpace: "nowrap" }}>
                  <button type="button" onClick={() => editRecord(item)} disabled={saving} style={{ ...buttonStyle, marginRight: 6 }}>Edit</button>
                  <button type="button" onClick={() => deleteRecord(item)} disabled={saving} style={{ ...buttonStyle, color: "#b42318" }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
