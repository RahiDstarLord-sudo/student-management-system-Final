import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./TeacherPortal.css";

const API_BASE = "http://localhost:5000/api";

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders({
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    const error = new Error("Your session has expired. Please sign in again.");
    error.status = 401;
    throw error;
  }
  if (!response.ok) throw new Error(data.error || "Could not complete the request");
  return data;
}

export default function TeacherPortal({ user, onLogout }) {
  const onLogoutRef = useRef(onLogout);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  const [profile, setProfile] = useState(user || {});
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(localDateValue);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAttendance = useCallback(async (date, assignmentId) => {
    if (!assignmentId) {
      setAttendance([]);
      return;
    }
    setAttendance([]);
    try {
      const rows = await apiRequest(
        `/teacher/attendance?date=${encodeURIComponent(date)}&teacherCourseId=${encodeURIComponent(assignmentId)}`
      );
      setAttendance(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message);
      if (err.status === 401) onLogoutRef.current?.();
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, courseRows, studentRows, timetableRows] = await Promise.all([
        apiRequest("/teachers/me"),
        apiRequest("/teachers/me/courses"),
        apiRequest("/teachers/me/students"),
        apiRequest("/teachers/me/timetable"),
      ]);
      const safeCourses = Array.isArray(courseRows) ? courseRows : [];
      setProfile(profileData || {});
      setCourses(safeCourses);
      setStudents(Array.isArray(studentRows) ? studentRows : []);
      setTimetable(Array.isArray(timetableRows) ? timetableRows : []);
      setSelectedCourseId((current) => {
        if (current && safeCourses.some((course) => String(course.assignmentId) === String(current))) return current;
        return safeCourses.length ? String(safeCourses[0].assignmentId) : "";
      });
    } catch (err) {
      setError(err.message);
      if (err.status === 401) onLogoutRef.current?.();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!loading) loadAttendance(attendanceDate, selectedCourseId);
  }, [attendanceDate, selectedCourseId, loading, loadAttendance]);

  const attendanceCounts = useMemo(() => ({
    present: attendance.filter((row) => row.attendanceStatus === "Present").length,
    absent: attendance.filter((row) => row.attendanceStatus === "Absent").length,
    late: attendance.filter((row) => row.attendanceStatus === "Late").length,
    unmarked: attendance.filter((row) => !row.attendanceStatus).length,
  }), [attendance]);

  function changeAttendance(studentId, status) {
    setAttendance((current) => current.map((row) =>
      row.studentId === studentId ? { ...row, attendanceStatus: status } : row
    ));
  }

  async function saveAttendance() {
    setError("");
    setMessage("");
    if (!attendance.length) {
      setError("There are no students in the selected course to mark for this date.");
      return;
    }
    if (attendance.some((row) => !row.attendanceStatus)) {
      setError("Please select an attendance status for every listed student.");
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest("/teacher/attendance", {
        method: "PUT",
        body: JSON.stringify({
          date: attendanceDate,
          teacherCourseId: Number(selectedCourseId),
          records: attendance.map((row) => ({
            studentId: row.studentId,
            status: row.attendanceStatus,
          })),
        }),
      });
      setMessage(`Attendance saved successfully for ${result.saved} students in the selected course.`);
      await loadAttendance(attendanceDate, selectedCourseId);
    } catch (err) {
      setError(err.message);
      if (err.status === 401) onLogoutRef.current?.();
    } finally {
      setSaving(false);
    }
  }

  const timetableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="teacher-portal">
      <header className="teacher-portal-header">
        <div className="teacher-brand">
          <div className="teacher-brand-mark">G</div>
          <div><strong>Greenfield College</strong><span>TEACHER PORTAL</span></div>
        </div>
        <div className="teacher-account">
          <div><strong>{profile.name || user?.name || "Teacher"}</strong><span>{profile.designation || "Teaching staff"}</span></div>
          <button type="button" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <main className="teacher-portal-main">
        <section className="teacher-welcome">
          <div>
            <p className="teacher-eyebrow">TEACHER DASHBOARD</p>
            <h1>Welcome, {profile.name || "Teacher"}</h1>
            <p>{profile.department || "Greenfield College"} {profile.teacherId ? `· ${profile.teacherId}` : ""}</p>
          </div>
          <button type="button" className="teacher-refresh" onClick={loadDashboard} disabled={loading}>Refresh data</button>
        </section>

        {error && <div className="teacher-alert teacher-alert-error">{error}</div>}
        {message && <div className="teacher-alert teacher-alert-success">{message}</div>}

        {loading ? <div className="teacher-panel teacher-loading">Loading your dashboard…</div> : (
          <>
            <section className="teacher-stat-grid">
              <article><span>Assigned courses</span><strong>{courses.length}</strong></article>
              <article><span>Assigned students</span><strong>{students.length}</strong></article>
              <article><span>Timetable sessions</span><strong>{timetable.length}</strong></article>
              <article><span>Attendance marked for selected course</span><strong>{attendance.length - attendanceCounts.unmarked}</strong></article>
            </section>

            <div className="teacher-dashboard-grid">
              <section className="teacher-panel">
                <div className="teacher-panel-heading"><div><h2>My courses</h2><p>Courses assigned by the administration</p></div></div>
                {courses.length ? <div className="teacher-course-list">{courses.map((course) => (
                  <article className="teacher-course-item" key={course.assignmentId}>
                    <div className="teacher-course-code">{course.course_code}</div>
                    <div><strong>{course.course_name}</strong><span>{course.credits} credits{course.section ? ` · Section ${course.section}` : ""}</span></div>
                  </article>
                ))}</div> : <p className="teacher-empty">No courses have been assigned to your account yet.</p>}
              </section>

              <section className="teacher-panel">
                <div className="teacher-panel-heading"><div><h2>My timetable</h2><p>Your scheduled teaching sessions</p></div></div>
                {timetable.length ? <div className="teacher-timetable-list">{timetableDays.map((day) => {
                  const entries = timetable.filter((item) => item.day_of_week === day);
                  if (!entries.length) return null;
                  return <div className="teacher-day-group" key={day}><h3>{day}</h3>{entries.map((item) => (
                    <article className="teacher-timetable-item" key={item.id}>
                      <div className="teacher-time">{String(item.start_time).slice(0, 5)}–{String(item.end_time).slice(0, 5)}</div>
                      <div><strong>{item.course_code || "Course"} · {item.course_name || ""}</strong><span>{item.room || "Room not set"} · {item.semester} · {item.academic_year}</span></div>
                    </article>
                  ))}</div>;
                })}</div> : <p className="teacher-empty">No timetable sessions have been assigned to you yet.</p>}
              </section>
            </div>

            <section className="teacher-panel teacher-attendance-panel">
              <div className="teacher-panel-heading teacher-attendance-heading">
                <div><h2>Student attendance</h2><p>Choose one assigned course. Only that course’s students will be shown and saved.</p></div>
                <div className="teacher-attendance-filters">
                  <label className="teacher-date-field">Course
                    <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} disabled={!courses.length}>
                      {!courses.length && <option value="">No assigned courses</option>}
                      {courses.map((course) => <option key={course.assignmentId} value={course.assignmentId}>{course.course_code} — {course.course_name}{course.section ? ` (Section ${course.section})` : ""}</option>)}
                    </select>
                  </label>
                  <label className="teacher-date-field">Attendance date<input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label>
                </div>
              </div>
              <div className="teacher-attendance-summary">
                <span>Present: <strong>{attendanceCounts.present}</strong></span>
                <span>Absent: <strong>{attendanceCounts.absent}</strong></span>
                <span>Late: <strong>{attendanceCounts.late}</strong></span>
                <span>Not marked: <strong>{attendanceCounts.unmarked}</strong></span>
              </div>
              {attendance.length ? <>
                <div className="teacher-attendance-table-wrap"><table className="teacher-attendance-table">
                  <thead><tr><th>Student</th><th>Student ID</th><th>Course</th><th>Attendance</th></tr></thead>
                  <tbody>{attendance.map((student) => <tr key={student.studentId}>
                    <td><strong>{student.name}</strong><small>{student.email}</small></td>
                    <td>{student.studentId}</td><td>{student.course}</td>
                    <td><select value={student.attendanceStatus || ""} onChange={(event) => changeAttendance(student.studentId, event.target.value)}>
                      <option value="">Select status</option><option value="Present">Present</option><option value="Absent">Absent</option><option value="Late">Late</option>
                    </select></td>
                  </tr>)}</tbody>
                </table></div>
                <div className="teacher-attendance-actions"><span>{attendance.length} assigned-course student(s)</span><button type="button" onClick={saveAttendance} disabled={saving}>{saving ? "Saving…" : "Save attendance"}</button></div>
              </> : <p className="teacher-empty">No students were found for this assigned course. Check that each student’s Course value matches the course code or course name.</p>}
            </section>
          </>
        )}
        <footer className="teacher-portal-footer">Greenfield College · Teacher Portal</footer>
      </main>
    </div>
  );
}
