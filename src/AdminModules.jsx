import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminModules.css";
import { API_BASE } from "./services/apiConfig";

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

function useResource(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}${path}`, { headers: headers() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load records.");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, setItems, loading, error, refresh };
}

function PageIntro({ eyebrow, title, description, action }) {
  return <div className="module-intro"><div><span className="module-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}
function Stat({ label, value, note }) {
  return <article className="module-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
function Status({ children }) {
  const value = String(children || "").toLowerCase();
  return <span className={`module-status ${value.replace(/\s+/g, "-")}`}>{children}</span>;
}
function EmptyState({ title, message }) {
  return <div className="module-empty"><span className="module-empty-icon">◇</span><strong>{title}</strong><p>{message}</p></div>;
}
function Modal({ title, onClose, children }) {
  return <div className="module-modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="module-modal" role="dialog" aria-modal="true" aria-label={title}><header><div><span className="module-eyebrow">GREENFIELD COLLEGE</span><h3>{title}</h3></div><button className="module-icon-button" onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>;
}
function Field({ label, children }) { return <label className="module-field"><span>{label}</span>{children}</label>; }
function FormActions({ onCancel, busy, label = "Save changes" }) { return <div className="module-form-actions"><button type="button" className="module-button module-button-quiet" onClick={onCancel}>Cancel</button><button className="module-button module-button-primary" disabled={busy}>{busy ? "Saving…" : label}</button></div>; }

const emptyExam = { name: "", exam_type: "Midterm", academic_year: "2026–2027", start_date: "", end_date: "", status: "Upcoming" };
export function ExaminationsPage() {
  const { items, loading, error, refresh } = useResource("/examinations");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyExam);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [courseModal, setCourseModal] = useState(null);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [examCourses, setExamCourses] = useState([]);
  const [courseForm, setCourseForm] = useState({ course_id: "", max_marks: "100", pass_marks: "33" });
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState("");
  const filtered = useMemo(() => items.filter(x => `${x.name} ${x.exam_type} ${x.academic_year}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  async function openCourseManager(exam) {
    setCourseModal(exam);
    setCourseError("");
    setCourseForm({ course_id: "", max_marks: "100", pass_marks: "33" });
    setCourseLoading(true);
    try {
      const [courseResponse, assignedResponse] = await Promise.all([
        fetch(`${API_BASE}/courses`, { headers: headers() }),
        fetch(`${API_BASE}/examinations/${exam.id}/courses`, { headers: headers() }),
      ]);
      const [courseData, assignedData] = await Promise.all([
        courseResponse.json(), assignedResponse.json(),
      ]);
      if (!courseResponse.ok) throw new Error(courseData.error || "Could not load courses.");
      if (!assignedResponse.ok) throw new Error(assignedData.error || "Could not load assigned courses.");
      setAvailableCourses(Array.isArray(courseData) ? courseData : []);
      setExamCourses(Array.isArray(assignedData) ? assignedData : []);
    } catch (err) {
      setCourseError(err.message || "Could not load course assignments.");
    } finally {
      setCourseLoading(false);
    }
  }

  async function addExamCourse(e) {
    e.preventDefault();
    if (!courseModal) return;
    setCourseBusy(true);
    setCourseError("");
    try {
      const response = await fetch(`${API_BASE}/examinations/${courseModal.id}/courses`, {
        method: "POST", headers: headers(), body: JSON.stringify(courseForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not assign course.");
      setExamCourses(current => [...current, data].sort((a,b) => String(a.course_code).localeCompare(String(b.course_code))));
      setCourseForm({ course_id: "", max_marks: "100", pass_marks: "33" });
    } catch (err) {
      setCourseError(err.message || "Could not assign course.");
    } finally {
      setCourseBusy(false);
    }
  }

  async function removeExamCourse(examCourseId) {
    if (!courseModal || !window.confirm("Remove this course from the examination?")) return;
    setCourseError("");
    try {
      const response = await fetch(`${API_BASE}/examinations/${courseModal.id}/courses/${examCourseId}`, { method: "DELETE", headers: headers() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove course.");
      setExamCourses(current => current.filter(item => item.id !== examCourseId));
    } catch (err) {
      setCourseError(err.message || "Could not remove course.");
    }
  }
  const openForm = exam => { setEditing(exam); setForm(exam ? { ...exam, start_date: String(exam.start_date || "").slice(0,10), end_date: String(exam.end_date || "").slice(0,10) } : emptyExam); setModal(true); };
  async function save(e) { e.preventDefault(); setBusy(true); setNotice(""); try { const response = await fetch(`${API_BASE}/examinations${editing ? `/${editing.id}` : ""}`, { method: editing ? "PUT" : "POST", headers: headers(), body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save exam."); setModal(false); await refresh(); setNotice(editing ? "Examination updated." : "Examination created."); } catch (err) { setNotice(err.message); } finally { setBusy(false); } }
  async function remove(id) { if (!window.confirm("Delete this examination and its schedule?")) return; try { const r = await fetch(`${API_BASE}/examinations/${id}`, { method: "DELETE", headers: headers() }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not delete exam."); await refresh(); } catch (e) { setNotice(e.message); } }
  return <div className="module-page"><PageIntro eyebrow="ACADEMIC MANAGEMENT" title="Examinations" description="Plan examination periods and keep academic schedules organised." action={<button className="module-button module-button-primary" onClick={() => openForm(null)}>＋ Create examination</button>} />
    <div className="module-stats"><Stat label="Total examinations" value={items.length} note="Across academic years"/><Stat label="Upcoming" value={items.filter(x => x.status === "Upcoming").length} note="Scheduled to take place"/><Stat label="Completed" value={items.filter(x => x.status === "Completed").length} note="Finished examination periods"/></div>
    <section className="module-panel"><div className="module-toolbar"><div><h3>Examination register</h3><p>Manage exam dates, type and current status</p></div><input className="module-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search examinations…"/></div>
      {notice && <div className="module-notice">{notice}</div>}{error && <div className="module-error">{error}</div>}
      {loading ? <div className="module-loading">Loading examinations…</div> : filtered.length ? <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Examination</th><th>Type</th><th>Academic year</th><th>Start date</th><th>End date</th><th>Status</th><th/></tr></thead><tbody>{filtered.map(x => <tr key={x.id}><td><strong>{x.name}</strong><small>EXM-{String(x.id).padStart(4,"0")}</small></td><td>{x.exam_type}</td><td>{x.academic_year}</td><td>{String(x.start_date).slice(0,10)}</td><td>{String(x.end_date).slice(0,10)}</td><td><Status>{x.status}</Status></td><td><div className="module-row-actions"><button onClick={() => openCourseManager(x)}>Courses</button><button onClick={() => openForm(x)}>Edit</button><button className="danger" onClick={() => remove(x.id)}>Delete</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No examinations yet" message="Create your first examination to start managing the academic calendar."/>}
    </section>
    {modal && <Modal title={editing ? "Edit examination" : "Create examination"} onClose={() => setModal(false)}><form className="module-form" onSubmit={save}><Field label="Examination name"><input required maxLength="150" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. Midterm Assessment"/></Field><div className="module-form-grid"><Field label="Examination type"><select value={form.exam_type} onChange={e => setForm({...form,exam_type:e.target.value})}><option>Midterm</option><option>Final</option><option>Quiz</option><option>Practical</option><option>Supplementary</option></select></Field><Field label="Academic year"><input required value={form.academic_year} onChange={e => setForm({...form,academic_year:e.target.value})}/></Field><Field label="Start date"><input type="date" required value={form.start_date} onChange={e => setForm({...form,start_date:e.target.value})}/></Field><Field label="End date"><input type="date" required min={form.start_date || undefined} value={form.end_date} onChange={e => setForm({...form,end_date:e.target.value})}/></Field><Field label="Status"><select value={form.status} onChange={e => setForm({...form,status:e.target.value})}><option>Upcoming</option><option>Ongoing</option><option>Completed</option><option>Cancelled</option></select></Field></div><FormActions onCancel={() => setModal(false)} busy={busy} label={editing ? "Update examination" : "Create examination"}/></form></Modal>}
    {courseModal && <Modal title={`Courses · ${courseModal.name}`} onClose={() => setCourseModal(null)}>
      <div className="module-form">
        {courseError && <div className="module-error">{courseError}</div>}
        {courseLoading ? <div className="module-loading">Loading courses…</div> : <>
          <form className="module-form" onSubmit={addExamCourse}>
            <Field label="Select course"><select required value={courseForm.course_id} onChange={e => setCourseForm({...courseForm,course_id:e.target.value})}><option value="">Choose a course</option>{availableCourses.filter(c => !examCourses.some(ec => Number(ec.course_id) === Number(c.id))).map(c => <option key={c.id} value={c.id}>{c.course_code} — {c.course_name}</option>)}</select></Field>
            <div className="module-form-grid">
              <Field label="Maximum marks"><input type="number" min="0.01" max="99999.99" step="0.01" required value={courseForm.max_marks} onChange={e => setCourseForm({...courseForm,max_marks:e.target.value})}/></Field>
              <Field label="Pass marks"><input type="number" min="0" max={courseForm.max_marks || undefined} step="0.01" required value={courseForm.pass_marks} onChange={e => setCourseForm({...courseForm,pass_marks:e.target.value})}/></Field>
            </div>
            <FormActions onCancel={() => setCourseModal(null)} busy={courseBusy} label="Assign course"/>
          </form>
          <div className="module-toolbar"><div><h3>Assigned courses</h3><p>{examCourses.length} course(s) linked to this examination</p></div></div>
          {examCourses.length ? <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Course</th><th>Maximum</th><th>Pass</th><th/></tr></thead><tbody>{examCourses.map(item => <tr key={item.id}><td><strong>{item.course_code}</strong><small>{item.course_name}</small></td><td>{Number(item.max_marks).toFixed(2)}</td><td>{Number(item.pass_marks).toFixed(2)}</td><td><button className="module-text-button danger" type="button" onClick={() => removeExamCourse(item.id)}>Remove</button></td></tr>)}</tbody></table></div> : <EmptyState title="No courses assigned" message="Choose a course above to include it in this examination."/>}
        </>}
      </div>
    </Modal>}
  </div>;
}

const emptySlot = {
  day_of_week: "Monday",
  start_time: "09:00",
  end_time: "10:00",
  course_id: "",
  teacher_id: "",
  room: "",
  room_id: "",
  section_id: "",
  session_type: "lecture",
  semester: "1st Semester",
  academic_year: "2026–2027"
};

export function TimetablePage() {
  const [publishConflicts, setPublishConflicts] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [versionLoading, setVersionLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [day, setDay] = useState("All days");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySlot);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const selectedVersion = versions.find(
    version => String(version.id) === String(selectedVersionId)
  );

  const isLegacy = selectedVersionId === "legacy";
  const canEdit = isLegacy || selectedVersion?.status === "draft";

  const refreshVersions = async (preferredId = null) => {
    setVersionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/timetable/versions`, {
        headers: headers()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load timetable versions.");

      const list = Array.isArray(data) ? data : [];
      setVersions(list);

      const preferred = preferredId ?? selectedVersionId;
      const preferredExists = list.some(v => String(v.id) === String(preferred));

      if (preferredExists) {
        setSelectedVersionId(String(preferred));
      } else if (!selectedVersionId || selectedVersionId === "legacy") {
        const firstDraft = list.find(v => v.status === "draft");
        const firstVersion = firstDraft || list[0];
        setSelectedVersionId(firstVersion ? String(firstVersion.id) : "legacy");
      }
    } catch (err) {
      setError(err.message || "Could not load timetable versions.");
    } finally {
      setVersionLoading(false);
    }
  };

  useEffect(() => {
    refreshVersions();
    Promise.all([
      fetch(`${API_BASE}/courses`, { headers: headers() }),
      fetch(`${API_BASE}/teachers`, { headers: headers() }),
      fetch(`${API_BASE}/academic-structure/rooms`, { headers: headers() }),
      fetch(`${API_BASE}/academic-structure/sections`, { headers: headers() })
    ])
      .then(async responses => {
        const results = await Promise.all(responses.map(r => r.json()));
        if (Array.isArray(results[0])) setCourses(results[0]);
        if (Array.isArray(results[1])) setTeachers(results[1]);
        if (Array.isArray(results[2])) setRooms(results[2]);
        if (Array.isArray(results[3])) setSections(results[3]);
      })
      .catch(() => {});
  }, []);

  const refreshEntries = async () => {
    if (!selectedVersionId) return;

    setLoading(true);
    setError("");

    try {
      const query = selectedVersionId === "legacy"
        ? "?version_id=legacy"
        : `?version_id=${encodeURIComponent(selectedVersionId)}`;

      const response = await fetch(`${API_BASE}/timetable${query}`, {
        headers: headers()
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not load timetable entries.");

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load timetable.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEntries();
  }, [selectedVersionId]);

  const filtered = items
    .filter(item => day === "All days" || item.day_of_week === day)
    .sort((a, b) =>
      days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week) ||
      String(a.start_time).localeCompare(String(b.start_time))
    );

  const openForm = slot => {
    if (!canEdit) {
      setNotice("Only Draft versions can be edited.");
      return;
    }

    setEditing(slot);
    setForm(slot ? {
      ...slot,
      course_id: slot.course_id || "",
      teacher_id: slot.teacher_id || "",
      start_time: String(slot.start_time).slice(0, 5),
      end_time: String(slot.end_time).slice(0, 5),
      session_type: slot.session_type || "lecture",
      room_id: slot.room_id || "",
      section_id: slot.section_id || ""
    } : {
      ...emptySlot,
      semester: selectedVersion?.semester_name || emptySlot.semester,
      academic_year: selectedVersion?.year_name || emptySlot.academic_year
    });
    setModal(true);
  };

  async function save(e) {
    e.preventDefault();
    if (!canEdit) return;

    setBusy(true);
    setNotice("");

    try {
      const payload = {
        ...form,
        course_id: form.course_id || null,
        teacher_id: form.teacher_id || null,
        room_id: form.room_id || null,
        section_id: form.section_id || null,
        version_id: isLegacy ? null : Number(selectedVersionId)
      };

      const response = await fetch(
        `${API_BASE}/timetable${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: headers(),
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save timetable entry.");

      setModal(false);
      await refreshEntries();
      setNotice(editing ? "Timetable entry updated." : "Timetable entry added to this Draft.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!canEdit) return;
    if (!window.confirm("Remove this timetable entry?")) return;

    try {
      const response = await fetch(`${API_BASE}/timetable/${id}`, {
        method: "DELETE",
        headers: headers()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete entry.");

      await refreshEntries();
      setNotice("Timetable entry removed.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function createDraft() {
    if (!selectedVersion || busy) return;

    if (!window.confirm(
      `Create a new Draft for ${selectedVersion.department_name}, ${selectedVersion.year_name}, ${selectedVersion.semester_name}?`
    )) return;

    setBusy(true);
    setNotice("");

    try {
      const nextNumber = Math.max(
        0,
        ...versions
          .filter(v =>
            Number(v.department_id) === Number(selectedVersion.department_id) &&
            Number(v.academic_year_id) === Number(selectedVersion.academic_year_id) &&
            Number(v.semester_id) === Number(selectedVersion.semester_id)
          )
          .map(v => Number(v.version_number) || 0)
      ) + 1;

      const response = await fetch(`${API_BASE}/timetable/versions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          department_id: Number(selectedVersion.department_id),
          academic_year_id: Number(selectedVersion.academic_year_id),
          semester_id: Number(selectedVersion.semester_id),
          title: `${selectedVersion.department_name} ${selectedVersion.year_name} ${selectedVersion.semester_name} Draft v${nextNumber}`
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create Draft.");

      const createdId = data.version?.id || data.id || data.version_id;
      await refreshVersions(createdId ? String(createdId) : null);

      if (createdId) setSelectedVersionId(String(createdId));
      setNotice("New Draft version created successfully.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publishVersion() {
    if (!selectedVersion || selectedVersion.status !== "draft" || busy) return;

    if (!window.confirm("Publish this Draft? The previously published version in this scope will be archived.")) return;

    setBusy(true);
    setNotice("");
    setPublishConflicts([]);

    try {
      const response = await fetch(
        `${API_BASE}/timetable/versions/${selectedVersion.id}/publish`,
        { method: "PATCH", headers: headers() }
      );
      const data = await response.json();

      if (!response.ok) {
        if (Array.isArray(data.conflicts)) setPublishConflicts(data.conflicts);
        throw new Error(data.error || "Could not publish this version.");
      }

      await refreshVersions(selectedVersionId);
      setNotice("Timetable version published successfully.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveVersion() {
    if (!selectedVersion || selectedVersion.status === "archived" || busy) return;

    if (!window.confirm("Archive this timetable version?")) return;

    setBusy(true);
    setNotice("");

    try {
      const response = await fetch(
        `${API_BASE}/timetable/versions/${selectedVersion.id}/archive`,
        { method: "PATCH", headers: headers() }
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not archive this version.");

      await refreshVersions(selectedVersionId);
      setNotice("Timetable version archived.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="module-page">
      <PageIntro
        eyebrow="ACADEMIC MANAGEMENT"
        title="Timetable"
        description="Manage timetable drafts, published schedules and version history."
        action={
          <div className="module-row-actions">
            <button
              className="module-button module-button-quiet"
              onClick={createDraft}
              disabled={!selectedVersion || busy}
            >
              + New Draft
            </button>
            <button
              className="module-button module-button-primary"
              onClick={() => openForm(null)}
              disabled={!canEdit}
            >
              + Add schedule
            </button>
          </div>
        }
      />

      <section className="module-panel">
        <div className="module-toolbar">
          <div>
            <h3>Timetable version</h3>
            <p>Select a Draft to edit or a Published version to review</p>
          </div>
          <select
            className="module-search"
            value={selectedVersionId}
            onChange={e => {
              setSelectedVersionId(e.target.value);
              setNotice("");
              setPublishConflicts([]);
            }}
            disabled={versionLoading}
          >
            {versions.map(version => (
              <option key={version.id} value={String(version.id)}>
                {version.title || `Version ${version.version_number}`} · {version.status}
              </option>
            ))}
            <option value="legacy">Legacy timetable (unversioned)</option>
          </select>
        </div>

        {selectedVersion && (
          <div className="module-toolbar">
            <div>
              <strong>
                {selectedVersion.department_name} · {selectedVersion.year_name} · {selectedVersion.semester_name}
              </strong>
              <p>
                Version {selectedVersion.version_number} · <Status>{selectedVersion.status}</Status>
                {selectedVersion.published_at
                  ? ` · Published ${String(selectedVersion.published_at).slice(0, 10)}`
                  : ""}
              </p>
            </div>
            <div className="module-row-actions">
              {selectedVersion.status === "draft" && (
                <button
                  className="module-button module-button-primary"
                  onClick={publishVersion}
                  disabled={busy || items.length === 0}
                  title={items.length === 0 ? "Add timetable entries before publishing" : "Publish this Draft"}
                >
                  Publish
                </button>
              )}
              {selectedVersion.status !== "archived" && (
                <button
                  className="module-button module-button-quiet"
                  onClick={archiveVersion}
                  disabled={busy}
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        )}

        {isLegacy && (
          <div className="module-notice">
            Legacy entries are not linked to a timetable version. New versioned schedules should be created inside a Draft.
          </div>
        )}

        {!canEdit && selectedVersion && (
          <div className="module-notice">
            This version is read-only. Create a new Draft to make changes.
          </div>
        )}
      </section>

      <div className="module-stats">
        <Stat label="Scheduled classes" value={items.length} note="Entries in selected version" />
        <Stat label="Teaching days" value={new Set(items.map(x => x.day_of_week)).size} note="Days with classes" />
        <Stat label="Assigned rooms" value={new Set(items.map(x => x.room).filter(Boolean)).size} note="Unique classrooms" />
      </div>

      <section className="module-panel">
        <div className="module-toolbar">
          <div>
            <h3>Weekly schedule</h3>
            <p>Review class sessions in the selected timetable version</p>
          </div>
          <select
            className="module-search"
            value={day}
            onChange={e => setDay(e.target.value)}
          >
            <option>All days</option>
            {days.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {notice && <div className="module-notice">{notice}</div>}

        {publishConflicts.length > 0 && (
          <div className="module-validation-list" role="alert">
            <strong>Publishing blocked ? resolve these conflicts:</strong>
            <ul>
              {publishConflicts.map((conflict, index) => (
                <li key={index}>
                  <span>Timetable entry #{conflict.entry_id}</span>
                  {conflict.conflict_type === "section_capacity"
                    ? `Section capacity exceeded: ${conflict.enrolled_count} active students, capacity ${conflict.section_capacity}.`
                    : conflict.conflict_type === "room_capacity"
                    ? `Room ${conflict.room_code || ""} capacity exceeded: ${conflict.enrolled_count} active students, capacity ${conflict.room_capacity}.`
                    : conflict.conflict_type === "lab_room_compatibility"
                    ? "Laboratory session is assigned to a non-laboratory room."
                    : conflict.conflict_type === "lab_room_required"
                    ? "A laboratory room is required for this lab session."
                    : `Conflict: ${String(conflict.conflict_type || "validation error").replace(/_/g, " ")}.`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <div className="module-error">{error}</div>}

        {loading || versionLoading ? (
          <div className="module-loading">Loading timetable...</div>
        ) : filtered.length ? (
          <div className="module-table-wrap">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Teacher</th>
                  <th>Room</th>
                  <th>Session</th>
                  <th>Semester</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.day_of_week}</strong></td>
                    <td>{String(item.start_time).slice(0, 5)} – {String(item.end_time).slice(0, 5)}</td>
                    <td>
                      <strong>{item.course_name || "Unassigned course"}</strong>
                      <small>{item.course_code || "—"}</small>
                    </td>
                    <td>{item.teacher_name || "Unassigned"}</td>
                    <td>{item.room || "—"}</td>
                    <td>{(item.session_type || "lecture").replace(/^\w/, c => c.toUpperCase())}</td>
                    <td>{item.semester}</td>
                    <td>
                      <div className="module-row-actions">
                        <button disabled={!canEdit} onClick={() => openForm(item)}>Edit</button>
                        <button className="danger" disabled={!canEdit} onClick={() => remove(item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No timetable entries"
            message={selectedVersion?.status === "draft"
              ? "Add classes to this Draft before publishing it."
              : "There are no timetable entries in this version."}
          />
        )}
      </section>

      {modal && (
        <Modal
          title={editing ? "Edit schedule" : "Add schedule to Draft"}
          onClose={() => setModal(false)}
        >
          <form className="module-form" onSubmit={save}>
            <div className="module-form-grid">
              <Field label="Day">
                <select
                  value={form.day_of_week}
                  onChange={e => setForm({ ...form, day_of_week: e.target.value })}
                >
                  {days.map(d => <option key={d}>{d}</option>)}
                </select>
              </Field>

              <Field label="Course">
                <select
                  value={form.course_id}
                  onChange={e => setForm({ ...form, course_id: e.target.value })}
                >
                  <option value="">Select course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.course_code} · {c.course_name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Session type">
                <select
                  value={form.session_type || "lecture"}
                  onChange={e => setForm({ ...form, session_type: e.target.value })}
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Laboratory</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="exam">Exam</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Start time">
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={e => setForm({ ...form, start_time: e.target.value })}
                />
              </Field>

              <Field label="End time">
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={e => setForm({ ...form, end_time: e.target.value })}
                />
              </Field>

              <Field label="Teacher">
                <select
                  value={form.teacher_id}
                  onChange={e => setForm({ ...form, teacher_id: e.target.value })}
                >
                  <option value="">Select teacher</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Section">
                <select
                  value={form.section_id || ""}
                  onChange={e => setForm({ ...form, section_id: e.target.value })}
                >
                  <option value="">No section linked</option>
                  {sections.filter(section => String(section.status).toLowerCase() === "active").map(section => (
                    <option key={section.id} value={section.id}>
                      {section.section_code} · {section.section_name} (capacity {section.capacity || "not set"})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Room resource">
                <select
                  value={form.room_id || ""}
                  onChange={e => {
                    const selected = rooms.find(room => String(room.id) === e.target.value);
                    setForm({ ...form, room_id: e.target.value, room: selected ? selected.room_code : form.room });
                  }}
                >
                  <option value="">No room resource linked</option>
                  {rooms.filter(room => String(room.status).toLowerCase() === "active").map(room => (
                    <option key={room.id} value={room.id}>
                      {room.room_code} · {room.room_type} · capacity {room.capacity || "not set"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Room (display name)">
                <input
                  maxLength="60"
                  value={form.room || ""}
                  onChange={e => setForm({ ...form, room: e.target.value })}
                  placeholder="e.g. Room 204"
                />
              </Field>

              <p className="module-field-hint">Lab sessions require an active room classified as Laboratory. Section and room capacities are checked by the server before saving and publishing.</p>

              <Field label="Semester">
                <input required value={form.semester} readOnly />
              </Field>

              <Field label="Academic year">
                <input required value={form.academic_year} readOnly />
              </Field>
            </div>

            <FormActions
              onCancel={() => setModal(false)}
              busy={busy}
              label={editing ? "Update schedule" : "Add to Draft"}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
export function MessagesPage() {
  const {items,loading,error,refresh}=useResource("/messages");
  const [compose,setCompose]=useState(false); const [form,setForm]=useState({recipient_role:"all_students",subject:"",body:""}); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState(""); const [tab,setTab]=useState("All messages");
  const filtered=items.filter(m=>tab==="All messages"||(tab==="Unread"&&!m.is_read&&!m.is_sent)||(tab==="Sent"&&m.is_sent));
  async function send(e){e.preventDefault();setBusy(true);setNotice("");try{const r=await fetch(`${API_BASE}/messages`,{method:"POST",headers:headers(),body:JSON.stringify(form)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not send message.");setCompose(false);setForm({recipient_role:"all_students",subject:"",body:""});await refresh();setNotice("Message sent successfully.");}catch(e){setNotice(e.message);}finally{setBusy(false);}}
  async function markRead(message){if(message.is_read)return;try{await fetch(`${API_BASE}/messages/${message.id}/read`,{method:"PUT",headers:headers()});refresh();}catch{}}
  async function remove(id){if(!window.confirm("Delete this message?"))return;try{const r=await fetch(`${API_BASE}/messages/${id}`,{method:"DELETE",headers:headers()});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not delete message.");refresh();}catch(e){setNotice(e.message);}}
  return <div className="module-page"><PageIntro eyebrow="COMMUNICATION" title="Messages" description="Send college updates and keep important communication in one place." action={<button className="module-button module-button-primary" onClick={()=>setCompose(true)}>＋ Compose message</button>}/><div className="module-stats"><Stat label="Total messages" value={items.length} note="Stored in your message centre"/><Stat label="Unread" value={items.filter(m=>!m.is_read).length} note="Awaiting review"/><Stat label="Sent today" value={items.filter(m=>String(m.created_at).slice(0,10)===new Date().toISOString().slice(0,10)).length} note="Messages created today"/></div><section className="module-panel"><div className="module-toolbar"><div><h3>Message centre</h3><p>Review announcements and recent communication</p></div><div className="module-tabs">{["All messages","Unread","Sent"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</div></div>{notice&&<div className="module-notice">{notice}</div>}{error&&<div className="module-error">{error}</div>}{loading?<div className="module-loading">Loading messages…</div>:filtered.length?<div className="module-message-list">{filtered.map(m=><article key={m.id} className={`module-message ${!m.is_read?"unread":""}`} onClick={()=>markRead(m)}><div className="module-message-avatar">{(m.sender_name||m.sender_email||"A").slice(0,1).toUpperCase()}</div><div className="module-message-content"><div className="module-message-top"><strong>{m.subject}</strong><time>{new Date(m.created_at).toLocaleString()}</time></div><p>{m.body}</p><small>From {m.sender_name||m.sender_email||"College administration"} · {m.is_sent?"Sent":"Received"}</small></div><button className="module-text-button danger" onClick={e=>{e.stopPropagation();remove(m.id);}}>Delete</button></article>)}</div>:<EmptyState title="Nothing in this view" message="Messages will appear here when they are sent or received."/>}</section>
    {compose&&<Modal title="Compose message" onClose={()=>setCompose(false)}><form className="module-form" onSubmit={send}><Field label="Send to"><select value={form.recipient_role} onChange={e=>setForm({...form,recipient_role:e.target.value})}><option value="all_students">All students</option><option value="staff">All staff</option></select></Field><Field label="Subject"><input required maxLength="180" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Write a clear subject"/></Field><Field label="Message"><textarea required maxLength="10000" rows="6" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write your announcement…"/></Field><FormActions onCancel={()=>setCompose(false)} busy={busy} label="Send message"/></form></Modal>}
  </div>;
}

export function SettingsPage({ user, onLogout }) {
  const [form,setForm]=useState({currentPassword:"",newPassword:"",confirmPassword:""}); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState(""); const [isError,setIsError]=useState(false);
  async function changePassword(e){e.preventDefault();setNotice("");setIsError(false);if(form.newPassword!==form.confirmPassword){setNotice("New passwords do not match.");setIsError(true);return;}setBusy(true);try{const r=await fetch(`${API_BASE}/change-password`,{method:"PUT",headers:headers(),body:JSON.stringify({currentPassword:form.currentPassword,newPassword:form.newPassword})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not update password.");setNotice("Your password has been updated.");setForm({currentPassword:"",newPassword:"",confirmPassword:""});}catch(e){setNotice(e.message);setIsError(true);}finally{setBusy(false);}}
  return <div className="module-page"><PageIntro eyebrow="PREFERENCES & SECURITY" title="Settings" description="Manage your administrator account and keep your access secure."/><section className="module-panel settings-panel"><div className="settings-section"><div><h3>Administrator profile</h3><p>Account information currently associated with this session.</p></div><div className="settings-profile"><div className="settings-avatar">{(user?.email||"A").slice(0,1).toUpperCase()}</div><div><strong>{user?.email||"Administrator"}</strong><span>{user?.role||"Staff"} account</span></div></div></div><div className="settings-section"><div><h3>Change password</h3><p>Use a unique password with at least 8 characters.</p></div><form className="settings-password-form" onSubmit={changePassword}><Field label="Current password"><input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})}/></Field><Field label="New password"><input type="password" autoComplete="new-password" minLength="8" required value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})}/></Field><Field label="Confirm new password"><input type="password" autoComplete="new-password" minLength="8" required value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})}/></Field>{notice&&<div className={isError?"module-error":"module-notice"}>{notice}</div>}<button className="module-button module-button-primary" disabled={busy}>{busy?"Updating…":"Update password"}</button></form></div><div className="settings-section settings-danger-zone"><div><h3>Session</h3><p>Sign out of this administrator session on this device.</p></div><button className="module-button module-button-danger" onClick={onLogout}>Log out</button></div></section></div>;
}
