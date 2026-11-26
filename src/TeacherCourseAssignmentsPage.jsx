import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "./services/apiConfig";

function getAuthHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: getAuthHeaders({
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const initialForm = {
  teacher_id: "",
  course_id: "",
  academic_year_id: "",
  semester_id: "",
  section: "",
  status: "Active",
};

export default function TeacherCourseAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assignmentRows, teacherRows, courseRows, yearRows, semesterRows] = await Promise.all([
        request("/teachers/course-assignments"),
        request("/teachers"),
        request("/courses"),
        request("/academic-years").catch(() => []),
        request("/semesters").catch(() => []),
      ]);
      setAssignments(Array.isArray(assignmentRows) ? assignmentRows : []);
      setTeachers(Array.isArray(teacherRows) ? teacherRows.filter((item) => item.status === "Active" && String(item.registration_status || "").toLowerCase() === "approved") : []);
      setCourses(Array.isArray(courseRows) ? courseRows : []);
      setYears(Array.isArray(yearRows) ? yearRows.filter((item) => item.status === "Active") : []);
      setSemesters(Array.isArray(semesterRows) ? semesterRows.filter((item) => item.status === "Active") : []);
    } catch (err) {
      setError(err.message || "Could not load teacher-course assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => String(semester.id) === String(form.semester_id)),
    [semesters, form.semester_id]
  );

  const filteredCourses = useMemo(() => {
    if (!selectedSemester) return [];
    return courses.filter(
      (course) => String(course.semester_id) === String(selectedSemester.id)
    );
  }, [courses, selectedSemester]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter((item) => {
      const haystack = [item.teacher_code, item.teacher_name, item.course_code, item.course_name,
        item.academic_year_name, item.semester_name, item.section].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) &&
        (statusFilter === "All" || item.status === statusFilter);
    });
  }, [assignments, search, statusFilter]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  function editAssignment(item) {
    setEditingId(item.id);
    setForm({
      teacher_id: String(item.teacher_id),
      course_id: String(item.course_id),
      academic_year_id: item.academic_year_id ? String(item.academic_year_id) : "",
      semester_id: item.semester_id ? String(item.semester_id) : String(courses.find((course) => String(course.id) === String(item.course_id))?.semester_id || ""),
      section: item.section || "",
      status: item.status || "Active",
    });
    setError("");
    setNotice("");
  }

  async function saveAssignment(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        teacher_id: Number(form.teacher_id),
        course_id: Number(form.course_id),
        academic_year_id: form.academic_year_id ? Number(form.academic_year_id) : null,
        semester_id: form.semester_id ? Number(form.semester_id) : null,
        section: form.section.trim() || null,
        status: form.status,
      };
      if (!payload.teacher_id || !payload.course_id) {
        throw new Error("Select an approved teacher and an existing course.");
      }
      if (editingId) {
        await request(`/teachers/course-assignments/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Course assignment updated.");
      } else {
        await request(`/teachers/${payload.teacher_id}/assign-course`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Course assigned successfully.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save the assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateAssignment(item) {
    if (!window.confirm(`Deactivate ${item.course_code} for ${item.teacher_name}?`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request(`/teachers/course-assignments/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "Inactive" }),
      });
      setNotice("Assignment deactivated. The record was retained for history.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not deactivate the assignment.");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = { width: "100%", minWidth: 0, padding: "10px 12px", border: "1px solid #d8deea", borderRadius: 9, background: "#fff", color: "#172033" };
  const labelStyle = { display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#475467" };

  return (
    <section className="surface" style={{ marginTop: 24, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1.2, fontWeight: 700, color: "#64748b" }}>ACADEMIC MANAGEMENT</p>
          <h2 style={{ margin: 0 }}>Teacher–Course Assignments</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>Assign existing courses to active teachers and manage academic offerings.</p>
        </div>
        <button type="button" className="button button-outline" onClick={loadData} disabled={loading}>Refresh</button>
      </div>

      {error && <p role="alert" style={{ padding: 12, borderRadius: 8, background: "#fff1f2", color: "#be123c" }}>{error}</p>}
      {notice && <p role="status" style={{ padding: 12, borderRadius: 8, background: "#ecfdf3", color: "#166534" }}>{notice}</p>}

      <form onSubmit={saveAssignment} style={{ padding: 18, border: "1px solid #e5eaf2", borderRadius: 12, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px" }}>{editingId ? "Edit assignment" : "Create assignment"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          <label style={labelStyle}>Approved / active teacher
            <select required style={fieldStyle} value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
              <option value="">Select teacher</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.teacher_id} — {teacher.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Existing course
            <select required style={fieldStyle} value={form.course_id} disabled={!form.semester_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">{form.semester_id ? (filteredCourses.length ? "Select course" : "No subjects in this semester") : "Select semester first"}</option>
              {filteredCourses.map((course) => <option key={course.id} value={course.id}>{course.course_code} — {course.course_name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Academic year
            <select style={fieldStyle} value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}>
              <option value="">Not specified</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.year_name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Semester
            <select style={fieldStyle} value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value, course_id: "" })}>
              <option value="">Not specified</option>
              {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.semester_name} — {semester.department_name || semester.department_code || `Department ${semester.department_id}`}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Section
            <input maxLength={30} style={fieldStyle} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Optional section" />
          </label>
          <label style={labelStyle}>Status
            <select style={fieldStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Active</option><option>Inactive</option>
            </select>
          </label>
        </div>
        {!teachers.length && <p style={{ color: "#b45309", fontSize: 13 }}>No active teachers are available. Verify teacher approval and account status first.</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          {editingId && <button type="button" className="button button-outline" onClick={resetForm}>Cancel edit</button>}
          <button type="submit" className="button button-primary" disabled={saving || loading || !teachers.length || !courses.length}>{saving ? "Saving…" : editingId ? "Save assignment" : "Assign course"}</button>
        </div>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Assignment records <span style={{ color: "#64748b", fontWeight: 500 }}>({filteredAssignments.length})</span></h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input aria-label="Search assignments" style={{ ...fieldStyle, width: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teacher, course, section…" />
          <select aria-label="Filter assignment status" style={{ ...fieldStyle, width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select>
        </div>
      </div>

      {loading ? <p>Loading assignments…</p> : filteredAssignments.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead><tr>{["Teacher", "Course", "Academic year", "Semester", "Section", "Status", "Actions"].map((heading) => <th key={heading} style={{ padding: "12px 10px", textAlign: "left", borderBottom: "1px solid #e5eaf2", color: "#64748b", fontSize: 12 }}>{heading}</th>)}</tr></thead>
            <tbody>{filteredAssignments.map((item) => <tr key={item.id}>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5" }}><strong>{item.teacher_name}</strong><small style={{ display: "block", color: "#64748b" }}>{item.teacher_code}</small></td>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5" }}><strong>{item.course_code}</strong><small style={{ display: "block", color: "#64748b" }}>{item.course_name}</small></td>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5" }}>{item.academic_year_name || "—"}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5" }}>{item.semester_name || "—"}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5" }}>{item.section || "—"}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5" }}>{item.status}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #edf0f5", whiteSpace: "nowrap" }}><button type="button" className="button button-outline" onClick={() => editAssignment(item)}>Edit</button>{item.status === "Active" && <button type="button" className="button button-outline" style={{ marginLeft: 6 }} onClick={() => deactivateAssignment(item)} disabled={saving}>Deactivate</button>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : <p style={{ color: "#64748b" }}>No assignment records match your filters.</p>}
    </section>
  );
}
