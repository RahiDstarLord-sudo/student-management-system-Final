import { useCallback, useEffect, useMemo, useState } from "react";
import "./StudentPortal.css";
import { API_ORIGIN } from "./services/apiConfig";

// Talks to the backend with the login token and returns the JSON answer
async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/* ---------- Static navigation and reference data ---------- */

const TABS = [
  { key: "Dashboard", icon: "▦" },
  { key: "Course Selection", icon: "▤" },
  { key: "Profile", icon: "♙" },
  { key: "Attendance", icon: "◷" },
  { key: "Results", icon: "▥" },
  { key: "Timetable", icon: "▤" },
  { key: "Exams", icon: "▣" },
  { key: "Leave", icon: "✎" },
  { key: "Library", icon: "❖" },
  { key: "Fees", icon: "৳" },
  { key: "Notices", label: "Messages & Notices", icon: "✉" },
  { key: "Password", icon: "✱" },
];

const PERIODS = ["09:00 - 10:00", "10:00 - 11:00", "11:15 - 12:15", "12:15 - 01:15"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const ROUTINE = {};

const EXAMS = [];

const LEAVE_TYPES = ["Sick leave", "Casual leave", "Family event", "Other"];

const BOOKS = [];

const FINE_PER_DAY = 5;

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + "T00:00:00");
  const b = new Date(toIso + "T00:00:00");
  return Math.round((b - a) / 86400000) + 1;
}

function bookState(b) {
  if (b.returned) return "Returned";
  const left = daysFromToday(b.due);
  if (left < 0) return "Overdue";
  if (left <= 3) return "Due soon";
  return "Issued";
}

function bookFine(b) {
  if (b.returned) return 0;
  const left = daysFromToday(b.due);
  return left < 0 ? Math.abs(left) * FINE_PER_DAY : 0;
}

function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysFromToday(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

/* ---------- Helper functions ---------- */

function taka(n) {
  return "৳" + n.toLocaleString("en-US");
}

function formatFeeDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}

function gradeOf(marks) {
  if (marks >= 80) return { grade: "A+", point: 5.0 };
  if (marks >= 70) return { grade: "A", point: 4.0 };
  if (marks >= 60) return { grade: "A-", point: 3.5 };
  if (marks >= 50) return { grade: "B", point: 3.0 };
  if (marks >= 40) return { grade: "C", point: 2.0 };
  if (marks >= 33) return { grade: "D", point: 1.0 };
  return { grade: "F", point: 0 };
}

function calcGpa(rows) {
  const credits = rows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
  const points = rows.reduce(
    (sum, row) => sum + gradeOf(Number(row.marks)).point * Number(row.credit || 0),
    0
  );
  return credits ? points / credits : 0;
}

function courseName(code, courses) {
  const found = courses.find((course) => course.code === code);
  return found ? found.name : code;
}

function buildCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    let status = "present";

    if (dow === 5 || dow === 6) status = "holiday";
    else if (d > now.getDate()) status = "upcoming";
    else if (d % 7 === 3) status = "absent";
    else if (d % 9 === 0) status = "late";

    cells.push({ day: d, status });
  }

  const label = now.toLocaleString("en", { month: "long", year: "numeric" });
  return { cells, label };
}

/* ---------- Main component ---------- */

function StudentPortal({ user, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Dashboard");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      onLogout();
      return;
    }

    fetch(`${API_ORIGIN}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((data) => {
        setStudent(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load your profile");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let active = true;

    api("/api/courses")
      .then((data) => {
        if (active) {
          setCourses(
            Array.isArray(data)
              ? data.map((course) => ({
                  code: course.course_code,
                  name: course.course_name,
                  teacher: course.teacher,
                  credit: course.credits,
                }))
              : []
          );
        }
      })
      .catch((err) => {
        console.error("Failed to load courses:", err);
      });

    return () => {
      active = false;
    };
  }, []);
  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p>Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: "red" }}>{error || "Something went wrong"}</p>
          <button className="button button-outline" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp">
      <header className="sp-header">
        <div className="sp-brand">
          <div className="brand-mark">G</div>
          <div>
            <strong>Greenfield University</strong>
            <span>Student Portal</span>
          </div>
        </div>

        <div className="sp-user">
          <div className="sp-avatar">
            {student.initials || student.name?.charAt(0)}
          </div>
          <div className="sp-user-text">
            <strong>{student.name}</strong>
            <span>{student.id}</span>
          </div>
          <button className="button button-outline" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="sp-tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            className={`sp-tab ${tab === item.key ? "sp-tab-active" : ""}`}
            onClick={() => setTab(item.key)}
          >
            <span>{item.icon}</span> {item.label || item.key}
          </button>
        ))}
      </nav>

      <main className="sp-content">
        {tab === "Dashboard" && <DashboardTab student={student} goTo={setTab} courses={courses} />}
        {tab === "Profile" && <ProfileTab student={student} courses={courses} />}
        {tab === "Course Selection" && <CourseSelectionTab />}
        {tab === "Attendance" && <AttendanceTab />}
        {tab === "Results" && <ResultsTab student={student} />}
        {tab === "Timetable" && <TimetableTab />}
        {tab === "Exams" && <ExamsTab student={student} courses={courses} />}
        {tab === "Leave" && <LeaveTab />}
        {tab === "Library" && <LibraryTab />}
        {tab === "Fees" && <FeesTab student={student} />}
        {tab === "Notices" && <NoticesTab />}
        {tab === "Password" && <PasswordTab />}
      </main>
    </div>
  );
}


function CourseSelectionTab() {
  const [data, setData] = useState(null);
  const [semesterId, setSemesterId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/api/student/course-selection")
      .then((result) => {
        setData(result);

        if (result.semesters?.length) {
          const first = result.semesters[0];
          setSemesterId(String(first.id));
          setSelectedIds(first.selectedCourseIds || []);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const semester = data?.semesters?.find(
    (item) => String(item.id) === semesterId
  );

  function changeSemester(value) {
    setSemesterId(value);
    const selected = data.semesters.find(
      (item) => String(item.id) === value
    );
    setSelectedIds(selected?.selectedCourseIds || []);
    setMessage("");
  }

  function toggleCourse(courseId) {
    setSelectedIds((previous) =>
      previous.includes(Number(courseId))
        ? previous.filter((id) => id !== Number(courseId))
        : [...previous, Number(courseId)]
    );
    setMessage("");
  }

  async function saveSelection() {
    if (!semesterId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await api("/api/student/course-selection", {
        method: "PUT",
        body: JSON.stringify({
          semesterId: Number(semesterId),
          courseIds: selectedIds,
        }),
      });

      setSelectedIds(result.selectedCourseIds || []);
      setData((previous) => ({
        ...previous,
        semesters: previous.semesters.map((item) =>
          String(item.id) === semesterId
            ? { ...item, selectedCourseIds: result.selectedCourseIds || [] }
            : item
        ),
      }));

      setMessage("Course selection saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading course selection...</p>;

  if (error && !data) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (!data?.semesters?.length) {
    return <p>No active semesters available. Contact administration.</p>;
  }

  return (
    <div>
      <h2>Course Selection</h2>
      <p>
        Academic Year: {data.academicYear?.year_name}
      </p>

      <div style={{ margin: "20px 0" }}>
        <label><strong>Select Semester</strong></label>
        <br />
        <select
          value={semesterId}
          onChange={(e) => changeSemester(e.target.value)}
          style={{ padding: "10px", marginTop: "8px", minWidth: "220px" }}
        >
          {data.semesters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.semester_name || `Semester ${item.semester_number}`}
            </option>
          ))}
        </select>
      </div>

      {semester?.courses?.length ? (
        <>
          <h3>Available Subjects</h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "12px", textAlign: "left" }}>Select</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Code</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Subject</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Credits</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Teacher</th>
                </tr>
              </thead>
              <tbody>
                {semester.courses.map((course) => (
                  <tr key={course.id}>
                    <td style={{ padding: "12px" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(Number(course.id))}
                        onChange={() => toggleCourse(course.id)}
                      />
                    </td>
                    <td style={{ padding: "12px" }}>{course.course_code}</td>
                    <td style={{ padding: "12px" }}>{course.course_name}</td>
                    <td style={{ padding: "12px" }}>{course.credits}</td>
                    <td style={{ padding: "12px" }}>{course.teacher || "Not assigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>Selected subjects: {selectedIds.length}</p>

          <button
            className="button"
            onClick={saveSelection}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Course Selection"}
          </button>
        </>
      ) : (
        <p>No courses available for this semester yet.</p>
      )}

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}


/* ---------- Tabs ---------- */

function DashboardTab({ student, goTo, courses }) {
  const [attendancePct, setAttendancePct] = useState("—");
  const [resultRows, setResultRows] = useState([]);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    api(`/api/my/attendance?month=${month}`)
      .then((records) => {
        const rows = Array.isArray(records) ? records : [];
        if (!rows.length) {
          setAttendancePct("—");
          return;
        }
        const attended = rows.filter((row) => row.status === "Present" || row.status === "Late").length;
        setAttendancePct(((attended / rows.length) * 100).toFixed(1));
      })
      .catch(() => setAttendancePct("—"));

    api("/api/my/results")
      .then((data) => setResultRows(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load dashboard results:", err));
  }, []);

  const cgpa = resultRows.length ? calcGpa(resultRows).toFixed(2) : "—";
  const latestSemester = [...new Set(resultRows.map((row) => row.semester))]
    .sort((a, b) => Number(String(b).match(/\d+/)?.[0] || 0) - Number(String(a).match(/\d+/)?.[0] || 0))[0];
  const latestRows = resultRows.filter((row) => row.semester === latestSemester);

  const todayIndex = new Date().getDay();
  const todayClasses = ROUTINE[todayIndex] || [];

  return (
    <>
      <h2 className="sp-title">Welcome back, {student.name?.split(" ")[0]}</h2>
      <p className="sp-sub">Here is a summary of your academic progress.</p>

      <div className="sp-stats">
        <div className="sp-stat">
          <span>Attendance</span>
          <strong>{attendancePct === "—" ? "—" : `${attendancePct}%`}</strong>
        </div>
        <div className="sp-stat">
          <span>CGPA</span>
          <strong>{cgpa}</strong>
        </div>
        <div className="sp-stat">
          <span>Enrolled courses</span>
          <strong>{courses.length}</strong>
        </div>
        <div className="sp-stat">
          <span>Status</span>
          <strong>{student.status}</strong>
        </div>
      </div>

      <div className="sp-grid-2">
        <section className="sp-card">
          <div className="sp-card-head">
            <h3>Today's classes</h3>
            <button className="sp-link" onClick={() => goTo("Timetable")}>
              Full routine →
            </button>
          </div>

          {todayClasses.length === 0 ? (
            <p className="sp-muted">Your timetable has not been published yet.</p>
          ) : (
            <ul className="sp-list">
              {todayClasses.map((c, i) => (
                <li key={i}>
                  <div>
                    <strong>{courseName(c.code, courses)}</strong>
                    <span>{c.room}</span>
                  </div>
                  <small>{PERIODS[i]}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sp-card">
          <div className="sp-card-head">
            <h3>Latest result</h3>
            <button className="sp-link" onClick={() => goTo("Results")}>
              View all →
            </button>
          </div>

          <ul className="sp-list">
            {latestRows.length ? latestRows.map((r) => (
              <li key={`${r.course_code}-${r.semester}`}>
                <div>
                  <strong>{r.course_name}</strong>
                  <span>{r.course_code}</span>
                </div>
                <small>{r.marks} · {gradeOf(Number(r.marks)).grade}</small>
              </li>
            )) : <li><div><strong>No results available</strong><span>Your results will appear here once published.</span></div></li>}
          </ul>
        </section>
      </div>
    </>
  );
}

function ProfileTab({ student, courses }) {
  const fields = [
    ["Full name", student.name],
    ["Student ID", student.id],
    ["Email", student.email],
    ["Course", student.course],
    ["Year", student.year],
    ["Status", student.status],
  ];

  return (
    <>
      <h2 className="sp-title">My profile</h2>
      <p className="sp-sub">Your personal and academic information.</p>

      <section className="sp-card">
        <div className="sp-profile-top">
          <div className="sp-avatar sp-avatar-big">
            {student.initials || student.name?.charAt(0)}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{student.name}</h3>
            <span className="sp-muted">{student.id}</span>
          </div>
        </div>

        <div className="sp-fields">
          {fields.map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <p>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sp-card" style={{ marginTop: 16 }}>
        <div className="sp-card-head">
          <h3>My courses</h3>
        </div>
        <div className="table-scroll">
          <table className="sp-table">
            <thead>
              <tr>
                <th>CODE</th>
                <th>COURSE</th>
                <th>TEACHER</th>
                <th>CREDIT</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.code}>
                  <td>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.teacher}</td>
                  <td>{c.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AttendanceTab() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api(`/api/my/attendance?month=${month}`)
      .then((data) => {
        if (active) setRecords(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [month]);

  const calendar = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const firstDay = new Date(year, monthNumber - 1, 1).getDay();
    const byDate = new Map(records.map((r) => [r.date, r.status.toLowerCase()]));
    const cells = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const iso = `${month}-${String(day).padStart(2, "0")}`;
        const status = byDate.get(iso) || "unmarked";
        return { day, status };
      }),
    ];
    const label = new Date(year, monthNumber - 1, 1).toLocaleDateString("en", {
      month: "long",
      year: "numeric",
    });
    return { cells, label };
  }, [month, records]);

  const present = records.filter((r) => r.status === "Present").length;
  const late = records.filter((r) => r.status === "Late").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const marked = records.length;
  const monthPct = marked ? (((present + late) / marked) * 100).toFixed(1) : "0.0";

  return (
    <>
      <h2 className="sp-title">Attendance</h2>
      <p className="sp-sub">Your attendance recorded by the college for each day.</p>

      <div className="sp-stats">
        <div className="sp-stat"><span>This month</span><strong>{monthPct}%</strong></div>
        <div className="sp-stat"><span>Present</span><strong>{present}</strong></div>
        <div className="sp-stat"><span>Late</span><strong>{late}</strong></div>
        <div className="sp-stat"><span>Absent</span><strong>{absent}</strong></div>
      </div>

      <section className="sp-card">
        <div className="sp-card-head">
          <h3>{calendar.label}</h3>
          <input
            className="sp-select"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Choose attendance month"
          />
        </div>

        {loading ? (
          <p className="sp-muted">Loading attendance...</p>
        ) : error ? (
          <p className="sp-low">{error}</p>
        ) : (
          <>
            {marked === 0 && (
              <p className="sp-muted">No attendance has been recorded for this month yet.</p>
            )}
            <div className="sp-calendar">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="sp-cal-head">{day}</div>
              ))}
              {calendar.cells.map((cell, index) =>
                cell ? (
                  <div key={index} className={`sp-cal-day sp-day-${cell.status}`}>
                    {cell.day}
                  </div>
                ) : <div key={index} />
              )}
            </div>
            <div className="sp-legend">
              <span><i className="lg lg-present" /> Present</span>
              <span><i className="lg lg-late" /> Late</span>
              <span><i className="lg lg-absent" /> Absent</span>
              <span><i className="lg lg-holiday" /> Not marked</span>
            </div>
          </>
        )}
      </section>
      <p className="sp-muted" style={{ marginTop: 14 }}>
        Attendance percentage = (Present + Late) ÷ total marked days. Minimum 75% is recommended.
      </p>
    </>
  );
}


function ResultsTab({ student }) {
  const [results, setResults] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api("/api/my/results")
      .then((data) => {
        if (!active) return;

        const rows = Array.isArray(data) ? data : [];
        setResults(rows);

        const semesters = [...new Set(rows.map((row) => row.semester))]
          .sort((a, b) => {
            const first = Number(String(a).match(/\d+/)?.[0] || 0);
            const second = Number(String(b).match(/\d+/)?.[0] || 0);
            return first - second;
          });

        setSelectedSemester(semesters[semesters.length - 1] || "");
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const semesters = [...new Set(results.map((row) => row.semester))]
    .sort((a, b) => {
      const first = Number(String(a).match(/\d+/)?.[0] || 0);
      const second = Number(String(b).match(/\d+/)?.[0] || 0);
      return first - second;
    });

  const semesterRows = results.filter(
    (row) => row.semester === selectedSemester
  );

  const semesterGpa = semesterRows.length
    ? calcGpa(semesterRows)
    : 0;

  const cgpa = results.length
    ? calcGpa(results)
    : 0;

  const totalCredits = results.reduce(
    (sum, row) => sum + Number(row.credit || 0),
    0
  );

  const selectedCredits = semesterRows.reduce(
    (sum, row) => sum + Number(row.credit || 0),
    0
  );

  const semesterReports = semesters.map((semester) => {
    const rows = results.filter((row) => row.semester === semester);

    return {
      semester,
      gpa: calcGpa(rows),
      credits: rows.reduce(
        (sum, row) => sum + Number(row.credit || 0),
        0
      ),
      courses: rows.length,
    };
  });

  return (
    <>
      <h2 className="sp-title">Academic Performance Report</h2>
      <p className="sp-sub">
        Your semester-wise GPA, cumulative CGPA and academic transcript.
      </p>

      {loading ? (
        <section className="sp-card">
          <p className="sp-muted">Loading academic report...</p>
        </section>
      ) : error ? (
        <section className="sp-card">
          <p className="sp-low">{error}</p>
        </section>
      ) : results.length === 0 ? (
        <section className="sp-card">
          <h3>No academic records available</h3>
          <p className="sp-muted">
            Your GPA and CGPA report will appear here after your results are published.
          </p>
        </section>
      ) : (
        <>
          <div className="sp-stats">
            <div className="sp-stat">
              <span>Overall CGPA</span>
              <strong>{cgpa.toFixed(2)}</strong>
            </div>

            <div className="sp-stat">
              <span>Semester GPA</span>
              <strong>{semesterGpa.toFixed(2)}</strong>
            </div>

            <div className="sp-stat">
              <span>Total Credits</span>
              <strong>{totalCredits.toFixed(2)}</strong>
            </div>

            <div className="sp-stat">
              <span>Completed Courses</span>
              <strong>{results.length}</strong>
            </div>
          </div>

          <section className="sp-card">
            <div className="sp-card-head">
              <div>
                <h3>Semester GPA History</h3>
                <p className="sp-muted">
                  Your academic progress across semesters.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
              {semesterReports.map((report) => (
                <div key={report.semester}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <strong>{report.semester}</strong>
                    <strong>{report.gpa.toFixed(2)} / 5.00</strong>
                  </div>

                  <div
                    style={{
                      height: 10,
                      background: "#e8edf2",
                      borderRadius: 20,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min((report.gpa / 5) * 100, 100)}%`,
                        height: "100%",
                        background: "#21865b",
                        borderRadius: 20,
                      }}
                    />
                  </div>

                  <small className="sp-muted">
                    {report.courses} courses · {report.credits.toFixed(2)} credits
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className="sp-card" style={{ marginTop: 16 }}>
            <div className="sp-card-head">
              <div>
                <h3>Academic Transcript</h3>
                <p className="sp-muted">
                  Select a semester to view detailed results.
                </p>
              </div>

              <div className="sp-actions">
                <select
                  className="sp-select"
                  value={selectedSemester}
                  onChange={(event) =>
                    setSelectedSemester(event.target.value)
                  }
                >
                  {semesters.map((semester) => (
                    <option key={semester} value={semester}>
                      {semester}
                    </option>
                  ))}
                </select>

                <button
                  className="button button-outline"
                  onClick={() => window.print()}
                >
                  ↓ Print transcript
                </button>
              </div>
            </div>

            <div className="sp-print-only">
              <h3>Greenfield University</h3>
              <p>Academic Transcript</p>
              <p>
                Student: {student.name} · ID: {student.id}
              </p>
              <p>Semester: {selectedSemester}</p>
            </div>

            <div className="sp-stats">
              <div className="sp-stat">
                <span>Semester GPA</span>
                <strong>{semesterGpa.toFixed(2)}</strong>
              </div>

              <div className="sp-stat">
                <span>Semester Credits</span>
                <strong>{selectedCredits.toFixed(2)}</strong>
              </div>

              <div className="sp-stat">
                <span>Courses</span>
                <strong>{semesterRows.length}</strong>
              </div>
            </div>

            <div className="table-scroll">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>SUBJECT</th>
                    <th>CREDIT</th>
                    <th>MARKS</th>
                    <th>GRADE</th>
                    <th>POINT</th>
                  </tr>
                </thead>

                <tbody>
                  {semesterRows.map((row) => {
                    const grade = gradeOf(Number(row.marks));

                    return (
                      <tr key={`${row.course_code}-${row.semester}`}>
                        <td>{row.course_code}</td>
                        <td>{row.course_name}</td>
                        <td>{Number(row.credit).toFixed(2)}</td>
                        <td>{Number(row.marks).toFixed(2)}</td>
                        <td>
                          <span
                            className={`sp-grade ${
                              grade.grade === "F" ? "sp-grade-f" : ""
                            }`}
                          >
                            {grade.grade}
                          </span>
                        </td>
                        <td>{grade.point.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan="2"><strong>Total</strong></td>
                    <td><strong>{selectedCredits.toFixed(2)}</strong></td>
                    <td colSpan="3">
                      <strong>GPA: {semesterGpa.toFixed(2)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="sp-card" style={{ marginTop: 16 }}>
            <h3>Overall Academic Summary</h3>

            <div className="sp-fields">
              <div>
                <small>Student Name</small>
                <p>{student.name}</p>
              </div>

              <div>
                <small>Student ID</small>
                <p>{student.id}</p>
              </div>

              <div>
                <small>Program</small>
                <p>{student.course}</p>
              </div>

              <div>
                <small>Overall CGPA</small>
                <p>{cgpa.toFixed(2)} / 5.00</p>
              </div>

              <div>
                <small>Total Credits</small>
                <p>{totalCredits.toFixed(2)}</p>
              </div>

              <div>
                <small>Total Semesters</small>
                <p>{semesters.length}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}


function TimetableTab() {
  const todayIndex = new Date().getDay();

  return (
    <>
      <h2 className="sp-title">Class routine</h2>
      <p className="sp-sub">Your weekly timetable. Today is highlighted.</p>

      <section className="sp-card">
        {!Object.values(ROUTINE).some((entries) => entries.length > 0) ? (
          <div className="sp-empty-state">Your timetable has not been published yet.</div>
        ) : <div className="table-scroll">
          <table className="sp-table sp-routine">
            <thead>
              <tr>
                <th>DAY</th>
                {PERIODS.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dayIndex) => (
                <tr key={day} className={todayIndex === dayIndex ? "sp-today" : ""}>
                  <td>
                    <strong>{day}</strong>
                  </td>
                  {(ROUTINE[dayIndex] || []).map((c, i) => (
                    <td key={i}>
                      <strong>{c.code}</strong>
                      <div className="sp-muted">{c.room}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </section>
    </>
  );
}

function ExamsTab({ student, courses }) {
  const [showCard, setShowCard] = useState(false);

  const totalDue = 0;

  const upcoming = EXAMS.filter((e) => daysFromToday(e.date) >= 0);
  const next = upcoming[0];

  if (showCard) {
    return (
      <>
        <div className="sp-noprint sp-actions" style={{ marginBottom: 14 }}>
          <button className="button button-outline" onClick={() => setShowCard(false)}>
            ← Back to schedule
          </button>
          <button className="button button-primary" onClick={() => window.print()}>
            ↓ Print admit card
          </button>
        </div>

        <section className="sp-card sp-admit">
          <div className="sp-admit-head">
            <div className="brand-mark">G</div>
            <div>
              <h3>Greenfield University</h3>
              <span>Admit card · Semester 2 final examination</span>
            </div>
          </div>

          <div className="sp-fields" style={{ marginBottom: 18 }}>
            <div>
              <small>Student name</small>
              <p>{student.name}</p>
            </div>
            <div>
              <small>Student ID</small>
              <p>{student.id}</p>
            </div>
            <div>
              <small>Course</small>
              <p>{student.course}</p>
            </div>
            <div>
              <small>Year</small>
              <p>{student.year}</p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>SUBJECT</th>
                  <th>TIME</th>
                  <th>ROOM</th>
                </tr>
              </thead>
              <tbody>
                {EXAMS.map((e) => (
                  <tr key={e.code}>
                    <td>{fmtDate(e.date)}</td>
                    <td>{courseName(e.code, courses)}</td>
                    <td>{e.time}</td>
                    <td>{e.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="sp-muted" style={{ marginTop: 16 }}>
            Bring this admit card and your student ID on every exam day.
          </p>

          {totalDue > 0 && (
            <p className="sp-low sp-noprint" style={{ marginTop: 6 }}>
              Note: you have {taka(totalDue)} in unpaid fees. Please clear it before
              collecting the original admit card.
            </p>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <h2 className="sp-title">Examinations</h2>
      <p className="sp-sub">Your exam schedule and admit card.</p>

      <div className="sp-stats">
        <div className="sp-stat">
          <span>Next exam</span>
          <strong style={{ fontSize: 18 }}>
            {next ? courseName(next.code, courses) : "None scheduled"}
          </strong>
        </div>
        <div className="sp-stat">
          <span>Days left</span>
          <strong>{next ? daysFromToday(next.date) : "-"}</strong>
        </div>
        <div className="sp-stat">
          <span>Total exams</span>
          <strong>{EXAMS.length}</strong>
        </div>
      </div>

      <section className="sp-card">
        <div className="sp-card-head">
          <h3>Published examination schedule</h3>
          <button className="button button-primary" onClick={() => setShowCard(true)} disabled={!EXAMS.length}>
            View admit card
          </button>
        </div>

        {EXAMS.length === 0 ? (
          <p className="sp-empty-state">No examination schedule has been published for your account.</p>
        ) : <div className="table-scroll">
          <table className="sp-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SUBJECT</th>
                <th>TIME</th>
                <th>ROOM</th>
                <th>COUNTDOWN</th>
              </tr>
            </thead>
            <tbody>
              {EXAMS.map((e) => {
                const left = daysFromToday(e.date);
                return (
                  <tr key={e.code}>
                    <td>{fmtDate(e.date)}</td>
                    <td>
                      <strong>{courseName(e.code, courses)}</strong>
                      <div className="sp-muted">{e.code}</div>
                    </td>
                    <td>{e.time}</td>
                    <td>{e.room}</td>
                    <td>
                      {left < 0 ? (
                        <span className="sp-muted">Completed</span>
                      ) : left === 0 ? (
                        <span className="sp-pill sp-pill-unpaid">Today</span>
                      ) : (
                        <span className="sp-pill sp-pill-partial">
                          in {left} days
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      </section>
    </>
  );
}

function LeaveTab() {
  const emptyForm = { type: LEAVE_TYPES[0], from: "", to: "", reason: "" };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/my/leaves")
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const count = (status) => items.filter((l) => l.status === status).length;
  const approvedDays = items
    .filter((l) => l.status === "Approved")
    .reduce((sum, l) => sum + daysBetween(l.from, l.to), 0);

  async function submit(event) {
    event.preventDefault();

    if (form.to < form.from) {
      setError("End date cannot be before the start date.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const created = await api("/api/my/leaves", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setItems((current) => [created, ...current]);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelLeave(id) {
    if (!window.confirm("Cancel this leave request?")) return;

    try {
      await api(`/api/my/leaves/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((l) => l.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const pillClass = { Pending: "sp-pill-partial", Approved: "sp-pill-paid", Rejected: "sp-pill-unpaid" };

  return (
    <>
      <h2 className="sp-title">Leave application</h2>
      <p className="sp-sub">Apply for leave and track your requests.</p>

      <div className="sp-stats">
        <div className="sp-stat">
          <span>Pending</span>
          <strong>{count("Pending")}</strong>
        </div>
        <div className="sp-stat">
          <span>Approved</span>
          <strong>{count("Approved")}</strong>
        </div>
        <div className="sp-stat">
          <span>Rejected</span>
          <strong>{count("Rejected")}</strong>
        </div>
        <div className="sp-stat">
          <span>Approved days</span>
          <strong>{approvedDays}</strong>
        </div>
      </div>

      <div className="sp-grid-2">
        <section className="sp-card">
          <div className="sp-card-head">
            <h3>New request</h3>
          </div>

          <form className="sp-form" onSubmit={submit}>
            <label>
              Leave type
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            <div className="sp-form-row">
              <label>
                From
                <input
                  required
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                />
              </label>

              <label>
                To
                <input
                  required
                  type="date"
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                />
              </label>
            </div>

            <label>
              Reason
              <textarea
                required
                rows={4}
                maxLength={500}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Briefly explain why you need leave"
              />
            </label>

            {error && <p className="sp-low">{error}</p>}

            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? "Submitting..." : "Submit request"}
            </button>
          </form>
        </section>

        <section className="sp-card">
          <div className="sp-card-head">
            <h3>My requests</h3>
          </div>

          {loading ? (
            <p className="sp-muted">Loading your requests...</p>
          ) : loadError ? (
            <p className="sp-low">{loadError}</p>
          ) : items.length === 0 ? (
            <p className="sp-muted">You have not made any leave requests.</p>
          ) : (
            <ul className="sp-list">
              {items.map((l) => {
                const days = daysBetween(l.from, l.to);
                return (
                  <li key={l.id}>
                    <div>
                      <strong>{l.type}</strong>
                      <span>
                        {fmtDate(l.from)}
                        {l.to !== l.from && ` to ${fmtDate(l.to)}`} · {days} day
                        {days === 1 ? "" : "s"}
                      </span>
                      <span>{l.reason}</span>
                    </div>

                    <div className="sp-actions">
                      <span className={`sp-pill ${pillClass[l.status]}`}>{l.status}</span>
                      {l.status === "Pending" && (
                        <button
                          className="button button-outline"
                          onClick={() => cancelLeave(l.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function LibraryTab() {
  const current = BOOKS.filter((b) => !b.returned);
  const history = BOOKS.filter((b) => b.returned);
  const overdueCount = current.filter((b) => bookState(b) === "Overdue").length;
  const totalFine = current.reduce((sum, b) => sum + bookFine(b), 0);

  const pillClass = {
    Overdue: "sp-pill-unpaid",
    "Due soon": "sp-pill-partial",
    Issued: "sp-as-submitted",
    Returned: "sp-pill-paid",
  };

  return (
    <>
      <h2 className="sp-title">Library</h2>
      <p className="sp-sub">Library borrowing information for your account.</p>

      <div className="sp-empty-state">Library loan records are not connected to the student portal yet. No borrowing balance or fine amount is being assumed.</div>

      <section className="sp-card">
        <div className="sp-card-head">
          <h3>Currently issued</h3>
        </div>

        {current.length === 0 ? (
          <p className="sp-muted">No issued-book records are available from the library system.</p>
        ) : (
          <ul className="sp-list">
            {current.map((b) => {
              const state = bookState(b);
              const left = daysFromToday(b.due);
              const fine = bookFine(b);

              let note = `Due ${fmtDate(b.due)}`;
              if (left < 0) note += ` · ${Math.abs(left)} days late · fine ${taka(fine)}`;
              else if (left === 0) note += " · due today";
              else note += ` · ${left} day${left === 1 ? "" : "s"} left`;

              return (
                <li key={b.id}>
                  <div>
                    <strong>{b.title}</strong>
                    <span>
                      {b.author} · issued {fmtDate(b.issued)}
                    </span>
                    <span>{note}</span>
                  </div>
                  <span className={`sp-pill ${pillClass[state]}`}>{state}</span>
                </li>
              );
            })}
          </ul>
        )}


      </section>

      <section className="sp-card" style={{ marginTop: 16 }}>
        <div className="sp-card-head">
          <h3>Borrowing history</h3>
        </div>

        {history.length === 0 ? <p className="sp-muted">No borrowing history is available.</p> : <div className="table-scroll">
          <table className="sp-table">
            <thead>
              <tr>
                <th>BOOK</th>
                <th>ISSUED</th>
                <th>RETURNED</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {history.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.title}</strong>
                    <div className="sp-muted">{b.author}</div>
                  </td>
                  <td>{fmtDate(b.issued)}</td>
                  <td>{fmtDate(b.returned)}</td>
                  <td>
                    <span className="sp-pill sp-pill-paid">Returned</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </section>
    </>
  );
}

function FeesTab({ student }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFees() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/my/fees");
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load your fee statement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFees();
  }, []);

  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const totalDue = invoices.reduce((sum, invoice) => sum + Number(invoice.due || 0), 0);

  return (
    <>
      <h2 className="sp-title">Fees and payments</h2>
      <p className="sp-sub">Your invoices, recorded payments and outstanding balance.</p>
      <div className="sp-stats">
        <div className="sp-stat"><span>Total fees</span><strong>{taka(totalAmount)}</strong></div>
        <div className="sp-stat"><span>Paid</span><strong>{taka(totalPaid)}</strong></div>
        <div className="sp-stat"><span>Due</span><strong className={totalDue > 0 ? "sp-low" : ""}>{taka(totalDue)}</strong></div>
      </div>
      <section className="sp-card">
        <div className="sp-card-head">
          <h3>Invoices</h3>
          <div className="sp-actions">
            <button className="button button-outline" onClick={() => window.print()}>↓ Print statement</button>
            <button className="button button-outline" onClick={loadFees} disabled={loading}>Refresh</button>
          </div>
        </div>
        <p className="sp-print-only">Fee statement · {student.name} · {student.id}</p>
        {error && <div className="sp-fee-alert sp-fee-error">{error}</div>}
        {loading ? <div className="sp-empty">Loading your fee statement...</div> :
          invoices.length === 0 ? <div className="sp-empty">No fee invoices have been issued to your account.</div> : (
            <div className="table-scroll">
              <table className="sp-table">
                <thead><tr><th>INVOICE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>PAID</th><th>DUE</th><th>DUE DATE</th><th>STATUS</th></tr></thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNo}</td>
                      <td><strong>{invoice.title}</strong>{invoice.notes && <div className="sp-muted">{invoice.notes}</div>}</td>
                      <td>{taka(Number(invoice.amount))}</td>
                      <td>{taka(Number(invoice.paid))}</td>
                      <td>{taka(Number(invoice.due))}</td>
                      <td>{formatFeeDate(invoice.dueDate)}</td>
                      <td><span className={`sp-pill sp-pill-${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
      {!loading && invoices.some((invoice) => invoice.payments?.length > 0) && (
        <section className="sp-card sp-fee-history">
          <div className="sp-card-head"><h3>Payment history</h3></div>
          <div className="table-scroll">
            <table className="sp-table">
              <thead><tr><th>DATE</th><th>INVOICE</th><th>METHOD</th><th>REFERENCE</th><th>AMOUNT</th></tr></thead>
              <tbody>
                {invoices.flatMap((invoice) => (invoice.payments || []).map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatFeeDate(payment.paid_at)}</td><td>{invoice.invoiceNo}</td>
                    <td>{payment.payment_method}</td><td>{payment.reference_no || "—"}</td>
                    <td>{taka(Number(payment.amount))}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function NoticesTab() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setAnnouncementError("");
    try {
      const rows = await api("/api/my/messages");
      setAnnouncements(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setAnnouncementError(error.message || "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function openAnnouncement(message) {
    if (message.is_read) return;
    try {
      await api(`/api/messages/${message.id}/read`, { method: "PUT" });
      setAnnouncements((current) => current.map((item) => item.id === message.id ? { ...item, is_read: true } : item));
    } catch (error) {
      setAnnouncementError(error.message || "Could not update message status.");
    }
  }

  const unreadCount = announcements.filter((item) => !item.is_read).length;

  return (
    <>
      <h2 className="sp-title">Messages & notices</h2>
      <p className="sp-sub">Official messages and announcements sent to your student account.</p>
      <section className="sp-card">
        <div className="sp-card-head">
          <div>
            <h3>From university administration</h3>
            <p className="sp-muted">{unreadCount} unread message{unreadCount === 1 ? "" : "s"}</p>
          </div>
          <button type="button" className="sp-link" onClick={loadAnnouncements} disabled={loading}>Refresh</button>
        </div>
        {announcementError && <p className="sp-alert sp-alert-error" role="alert">{announcementError}</p>}
        {loading ? <p className="sp-muted">Loading your messages…</p> : announcements.length === 0 ? (
          <p className="sp-empty-state">There are no messages or notices for your account yet.</p>
        ) : (
          <ul className="sp-notices">
            {announcements.map((message) => (
              <li key={message.id}>
                <button type="button" className="sp-notice-row" onClick={() => openAnnouncement(message)} aria-label={`Mark ${message.subject || "message"} as read`}>
                  <span className={`sp-unread ${message.is_read ? "sp-unread-off" : ""}`} aria-hidden="true" />
                  <div className="sp-notice-text">
                    <strong>{message.subject}</strong>
                    <span>{message.sender_email || "University administration"} · {message.created_at ? new Date(message.created_at).toLocaleDateString() : "Date unavailable"}</span>
                    <p className="sp-notice-body">{message.body}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PasswordTab() {
  const empty = { current: "", next: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage(null);

    if (form.next.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }

    if (form.next !== form.confirm) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    if (form.next === form.current) {
      setMessage({ type: "error", text: "New password must be different from the current one." });
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_ORIGIN}/api/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: form.current,
          newPassword: form.next,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not change password");
      }

      setForm(empty);
      setMessage({ type: "ok", text: "Password changed successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const inputType = show ? "text" : "password";

  return (
    <>
      <h2 className="sp-title">Change password</h2>
      <p className="sp-sub">Keep your account safe by using a strong password.</p>

      <section className="sp-card" style={{ maxWidth: 480 }}>
        <form className="sp-form" onSubmit={submit}>
          <label>
            Current password
            <input
              required
              type={inputType}
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              autoComplete="current-password"
            />
          </label>

          <label>
            New password
            <input
              required
              type={inputType}
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </label>

          <label>
            Confirm new password
            <input
              required
              type={inputType}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              autoComplete="new-password"
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
            Show passwords
          </label>

          {message && (
            <p
              className={message.type === "error" ? "sp-low" : ""}
              style={message.type === "ok" ? { color: "#1c7c4a", fontWeight: 600 } : {}}
            >
              {message.text}
            </p>
          )}

          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update password"}
          </button>
        </form>
      </section>
    </>
  );
}

export default StudentPortal;
