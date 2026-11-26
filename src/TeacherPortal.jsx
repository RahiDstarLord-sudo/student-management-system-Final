import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./TeacherPortal.css";
import { API_BASE } from "./services/apiConfig";

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

  if (!response.ok) {
    throw new Error(data.error || "Could not complete the request");
  }

  return data;
}

export default function TeacherPortal({ user, onLogout }) {
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const [profile, setProfile] = useState(user || {});
  const [profileDraft, setProfileDraft] = useState(user || {});
  const [profileRequest, setProfileRequest] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

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

      if (err.status === 401) {
        onLogoutRef.current?.();
      }
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profileData, courseRows, studentRows, timetableRows] =
        await Promise.all([
          apiRequest("/teachers/me"),
          apiRequest("/teachers/me/courses"),
          apiRequest("/teachers/me/students"),
          apiRequest("/teachers/me/timetable"),
        ]);

      const safeCourses = Array.isArray(courseRows) ? courseRows : [];

      setProfile(profileData || {});
      setProfileDraft(profileData || {});

      try {
        const profileResponse = await apiRequest("/teachers/me/profile");
        const approvedProfile =
          profileResponse?.profile ||
          profileResponse?.teacher ||
          profileResponse ||
          {};

        setProfile((current) => ({ ...current, ...approvedProfile }));
        setProfileDraft(approvedProfile);
        setProfileRequest(profileResponse?.request || null);
      } catch (profileError) {
        if (profileError.status === 401) {
          throw profileError;
        }

        setProfileRequest(null);
      }

      setCourses(safeCourses);
      setStudents(Array.isArray(studentRows) ? studentRows : []);
      setTimetable(Array.isArray(timetableRows) ? timetableRows : []);

      setSelectedCourseId((current) => {
        if (
          current &&
          safeCourses.some(
            (course) => String(course.assignmentId) === String(current)
          )
        ) {
          return current;
        }

        return safeCourses.length
          ? String(safeCourses[0].assignmentId)
          : "";
      });
    } catch (err) {
      setError(err.message);

      if (err.status === 401) {
        onLogoutRef.current?.();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!loading) {
      loadAttendance(attendanceDate, selectedCourseId);
    }
  }, [attendanceDate, selectedCourseId, loading, loadAttendance]);

  const attendanceCounts = useMemo(
    () => ({
      present: attendance.filter(
        (row) => row.attendanceStatus === "Present"
      ).length,
      absent: attendance.filter(
        (row) => row.attendanceStatus === "Absent"
      ).length,
      late: attendance.filter(
        (row) => row.attendanceStatus === "Late"
      ).length,
      unmarked: attendance.filter((row) => !row.attendanceStatus).length,
    }),
    [attendance]
  );

  function changeAttendance(studentId, status) {
    setAttendance((current) =>
      current.map((row) =>
        row.studentId === studentId
          ? { ...row, attendanceStatus: status }
          : row
      )
    );
  }

  async function saveAttendance() {
    setError("");
    setMessage("");

    if (!attendance.length) {
      setError(
        "There are no students in the selected course to mark for this date."
      );
      return;
    }

    if (attendance.some((row) => !row.attendanceStatus)) {
      setError(
        "Please select an attendance status for every listed student."
      );
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

      setMessage(
        `Attendance saved successfully for ${result.saved} students in the selected course.`
      );

      await loadAttendance(attendanceDate, selectedCourseId);
    } catch (err) {
      setError(err.message);

      if (err.status === 401) {
        onLogoutRef.current?.();
      }
    } finally {
      setSaving(false);
    }
  }

  function updateProfileField(field, value) {
    setProfileDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setProfileSaving(true);

    try {
      const result = await apiRequest("/teachers/me/profile", {
        method: "PUT",
        body: JSON.stringify(profileDraft),
      });

      setProfileRequest(result.request || null);
      setMessage(
        result.message ||
          "Profile changes submitted for administrator approval."
      );
    } catch (err) {
      setError(err.message);

      if (err.status === 401) {
        onLogoutRef.current?.();
      }
    } finally {
      setProfileSaving(false);
    }
  }

  const timetableDays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className="teacher-portal">
      <style>{`
        .teacher-profile-panel {
          margin-top: 24px;
          color: #172033;
          background: #ffffff;
        }

        .teacher-profile-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .teacher-profile-form label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #263247;
          font-weight: 600;
          font-size: 14px;
        }

        .teacher-profile-form input,
        .teacher-profile-form select,
        .teacher-profile-form textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          color: #172033;
          font: inherit;
        }

        .teacher-profile-form input:focus,
        .teacher-profile-form select:focus,
        .teacher-profile-form textarea:focus {
          outline: 2px solid #93c5fd;
          border-color: #2563eb;
        }

        .teacher-profile-form input[readonly] {
          background: #f1f5f9;
          color: #475569;
        }

        .teacher-profile-wide,
        .teacher-profile-actions {
          grid-column: 1 / -1;
        }

        .teacher-profile-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .teacher-profile-actions span {
          color: #475569;
          font-size: 13px;
        }

        .teacher-profile-actions button {
          border: 0;
          border-radius: 8px;
          padding: 11px 18px;
          background: #1d4ed8;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .teacher-profile-actions button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .teacher-profile-status {
          margin: 0 0 16px;
          padding: 12px 14px;
          border-radius: 8px;
          color: #1e293b;
          background: #f1f5f9;
        }

        .teacher-profile-status.is-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .teacher-profile-status.is-rejected {
          background: #fee2e2;
          color: #991b1b;
        }

        .teacher-profile-status.is-approved {
          background: #dcfce7;
          color: #166534;
        }

        @media (max-width: 700px) {
          .teacher-profile-form {
            grid-template-columns: 1fr;
          }

          .teacher-profile-wide,
          .teacher-profile-actions {
            grid-column: auto;
          }
        }
      `}</style>

      <header className="teacher-portal-header">
        <div className="teacher-brand">
          <div className="teacher-brand-mark">G</div>
          <div>
            <strong>Greenfield University</strong>
            <span>TEACHER PORTAL</span>
          </div>
        </div>

        <div className="teacher-account">
          <div>
            <strong>{profile.name || user?.name || "Teacher"}</strong>
            <span>{profile.designation || "Teaching staff"}</span>
          </div>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="teacher-workspace-nav" aria-label="Teacher workspace">
        <a href="#teacher-overview">Overview</a>
        <a href="#teacher-courses">My courses</a>
        <a href="#teacher-students">My students</a>
        <a href="#teacher-attendance">Attendance</a>
        <a href="#teacher-timetable">Timetable</a>
        <a href="#teacher-profile">My profile</a>
      </nav>

      <main className="teacher-portal-main" id="teacher-overview">
        <section className="teacher-welcome">
          <div>
            <p className="teacher-eyebrow">TEACHER DASHBOARD</p>
            <h1>Welcome, {profile.name || "Teacher"}</h1>
            <p>
              {profile.department || "Greenfield University"}{" "}
              {profile.teacherId ? `· ${profile.teacherId}` : ""}
            </p>
          </div>

          <button
            type="button"
            className="teacher-refresh"
            onClick={loadDashboard}
            disabled={loading}
          >
            Refresh data
          </button>
        </section>

        {error && (
          <div className="teacher-alert teacher-alert-error">{error}</div>
        )}

        {message && (
          <div className="teacher-alert teacher-alert-success">{message}</div>
        )}

        {loading ? (
          <div className="teacher-panel teacher-loading">
            Loading your dashboard…
          </div>
        ) : (
          <>
            <section className="teacher-stat-grid">
              <article>
                <span>Assigned courses</span>
                <strong>{courses.length}</strong>
              </article>
              <article>
                <span>Assigned students</span>
                <strong>{students.length}</strong>
              </article>
              <article>
                <span>Timetable sessions</span>
                <strong>{timetable.length}</strong>
              </article>
              <article>
                <span>Attendance marked for selected course</span>
                <strong>{attendance.length - attendanceCounts.unmarked}</strong>
              </article>
            </section>

            <div className="teacher-dashboard-grid">
              <section className="teacher-panel" id="teacher-courses">
                <div className="teacher-panel-heading">
                  <div>
                    <h2>My courses</h2>
                    <p>Courses assigned by the administration</p>
                  </div>
                </div>

                {courses.length ? (
                  <div className="teacher-course-list">
                    {courses.map((course) => (
                      <article
                        className="teacher-course-item"
                        key={course.assignmentId}
                      >
                        <div className="teacher-course-code">
                          {course.course_code}
                        </div>
                        <div>
                          <strong>{course.course_name}</strong>
                          <span>
                            {course.credits} credits
                            {course.section
                              ? ` · Section ${course.section}`
                              : ""}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="teacher-empty">
                    No courses have been assigned to your account yet.
                  </p>
                )}
              </section>

              <section className="teacher-panel" id="teacher-timetable">
                <div className="teacher-panel-heading">
                  <div>
                    <h2>My timetable</h2>
                    <p>Your scheduled teaching sessions</p>
                  </div>
                </div>

                {timetable.length ? (
                  <div className="teacher-timetable-list">
                    {timetableDays.map((day) => {
                      const entries = timetable.filter(
                        (item) => item.day_of_week === day
                      );

                      if (!entries.length) return null;

                      return (
                        <div className="teacher-day-group" key={day}>
                          <h3>{day}</h3>

                          {entries.map((item) => (
                            <article
                              className="teacher-timetable-item"
                              key={item.id}
                            >
                              <div className="teacher-time">
                                {String(item.start_time).slice(0, 5)}–
                                {String(item.end_time).slice(0, 5)}
                              </div>
                              <div>
                                <strong>
                                  {item.course_code || "Course"} ·{" "}
                                  {item.course_name || ""}
                                </strong>
                                <span>
                                  {item.room || "Room not set"} · {item.semester}{" "}
                                  · {item.academic_year}
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="teacher-empty">
                    No timetable sessions have been assigned to you yet.
                  </p>
                )}
              </section>
            </div>

            <section
              className="teacher-panel teacher-students-panel"
              id="teacher-students"
            >
              <div className="teacher-panel-heading">
                <div>
                  <h2>My students</h2>
                  <p>
                    Students associated with your teaching assignments
                  </p>
                </div>
              </div>

              {students.length ? (
                <div className="teacher-attendance-table-wrap">
                  <table className="teacher-attendance-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Course</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => (
                        <tr
                          key={student.studentId || student.id || index}
                        >
                          <td>
                            <strong>
                              {student.name ||
                                student.full_name ||
                                student.student_name ||
                                "Student"}
                            </strong>
                            <small>{student.email || ""}</small>
                          </td>
                          <td>
                            {student.studentId ||
                              student.student_id ||
                              student.id ||
                              "—"}
                          </td>
                          <td>
                            {student.course ||
                              student.course_name ||
                              student.course_code ||
                              "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="teacher-empty">
                  No students are currently linked to your teaching
                  assignments.
                </p>
              )}
            </section>

            <section
              className="teacher-panel teacher-attendance-panel"
              id="teacher-attendance"
            >
              <div className="teacher-panel-heading teacher-attendance-heading">
                <div>
                  <h2>Student attendance</h2>
                  <p>
                    Choose one assigned course. Only that course’s students
                    will be shown and saved.
                  </p>
                </div>

                <div className="teacher-attendance-filters">
                  <label className="teacher-date-field">
                    Course
                    <select
                      value={selectedCourseId}
                      onChange={(event) =>
                        setSelectedCourseId(event.target.value)
                      }
                      disabled={!courses.length}
                    >
                      {!courses.length && (
                        <option value="">No assigned courses</option>
                      )}

                      {courses.map((course) => (
                        <option
                          key={course.assignmentId}
                          value={course.assignmentId}
                        >
                          {course.course_code} — {course.course_name}
                          {course.section ? ` (Section ${course.section})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="teacher-date-field">
                    Attendance date
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(event) =>
                        setAttendanceDate(event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="teacher-attendance-summary">
                <span>
                  Present: <strong>{attendanceCounts.present}</strong>
                </span>
                <span>
                  Absent: <strong>{attendanceCounts.absent}</strong>
                </span>
                <span>
                  Late: <strong>{attendanceCounts.late}</strong>
                </span>
                <span>
                  Not marked: <strong>{attendanceCounts.unmarked}</strong>
                </span>
              </div>

              {attendance.length ? (
                <>
                  <div className="teacher-attendance-table-wrap">
                    <table className="teacher-attendance-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Student ID</th>
                          <th>Course</th>
                          <th>Attendance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((student) => (
                          <tr key={student.studentId}>
                            <td>
                              <strong>{student.name}</strong>
                              <small>{student.email}</small>
                            </td>
                            <td>{student.studentId}</td>
                            <td>{student.course}</td>
                            <td>
                              <select
                                value={student.attendanceStatus || ""}
                                onChange={(event) =>
                                  changeAttendance(
                                    student.studentId,
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">Select status</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Late">Late</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="teacher-attendance-actions">
                    <span>
                      {attendance.length} assigned-course student(s)
                    </span>
                    <button
                      type="button"
                      onClick={saveAttendance}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save attendance"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="teacher-empty">
                  No students were found for this assigned course. Check that
                  each student’s Course value matches the course code or
                  course name.
                </p>
              )}
            </section>
          </>
        )}

        <section
          className="teacher-panel teacher-profile-panel"
          id="teacher-profile"
        >
          <div className="teacher-panel-heading">
            <div>
              <h2>My profile</h2>
              <p>
                Update your personal and professional details. Changes require
                administrator approval.
              </p>
            </div>
          </div>

          {profileRequest && (
            <div
              className={`teacher-profile-status ${
                profileRequest.status === "Pending"
                  ? "is-pending"
                  : profileRequest.status === "Rejected"
                    ? "is-rejected"
                    : "is-approved"
              }`}
            >
              Latest request: <strong>{profileRequest.status}</strong>
              {profileRequest.admin_note
                ? ` — ${profileRequest.admin_note}`
                : ""}
            </div>
          )}

          <form className="teacher-profile-form" onSubmit={submitProfile}>
            <label>
              Full name
              <input
                required
                maxLength="180"
                value={profileDraft.name || ""}
                onChange={(event) =>
                  updateProfileField("name", event.target.value)
                }
              />
            </label>

            <label>
              Teacher ID
              <input
                value={profile.teacherId || profile.teacher_id || ""}
                readOnly
              />
            </label>

            <label>
              Login email
              <input value={profile.email || ""} readOnly />
            </label>

            <label>
              Phone number
              <input
                maxLength="40"
                value={profileDraft.phone || ""}
                onChange={(event) =>
                  updateProfileField("phone", event.target.value)
                }
              />
            </label>

            <label>
              Department
              <input value={profile.department || ""} readOnly />
            </label>

            <label>
              Designation
              <input value={profile.designation || ""} readOnly />
            </label>

            <label>
              Date of birth
              <input
                type="date"
                value={profileDraft.dateOfBirth || ""}
                onChange={(event) =>
                  updateProfileField("dateOfBirth", event.target.value)
                }
              />
            </label>

            <label>
              Gender
              <select
                value={profileDraft.gender || ""}
                onChange={(event) =>
                  updateProfileField("gender", event.target.value)
                }
              >
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>

            <label>
              Highest qualification
              <input
                maxLength="180"
                value={profileDraft.qualification || ""}
                onChange={(event) =>
                  updateProfileField("qualification", event.target.value)
                }
                placeholder="e.g. MSc in Mathematics"
              />
            </label>

            <label>
              Specialization
              <input
                maxLength="180"
                value={profileDraft.specialization || ""}
                onChange={(event) =>
                  updateProfileField("specialization", event.target.value)
                }
              />
            </label>

            <label>
              Years of experience
              <input
                type="number"
                min="0"
                max="60"
                value={profileDraft.experienceYears ?? ""}
                onChange={(event) =>
                  updateProfileField("experienceYears", event.target.value)
                }
              />
            </label>

            <label>
              Emergency contact name
              <input
                maxLength="180"
                value={profileDraft.emergencyContactName || ""}
                onChange={(event) =>
                  updateProfileField("emergencyContactName", event.target.value)
                }
              />
            </label>

            <label>
              Emergency contact phone
              <input
                maxLength="40"
                value={profileDraft.emergencyContactPhone || ""}
                onChange={(event) =>
                  updateProfileField("emergencyContactPhone", event.target.value)
                }
              />
            </label>

            <label className="teacher-profile-wide">
              Residential address
              <textarea
                rows="3"
                maxLength="1000"
                value={profileDraft.address || ""}
                onChange={(event) =>
                  updateProfileField("address", event.target.value)
                }
              />
            </label>

            <label className="teacher-profile-wide">
              Professional bio
              <textarea
                rows="4"
                maxLength="2000"
                value={profileDraft.bio || ""}
                onChange={(event) =>
                  updateProfileField("bio", event.target.value)
                }
                placeholder="Briefly describe your teaching experience and interests."
              />
            </label>

            <div className="teacher-profile-actions">
              <span>
                Teacher ID, login email, department, and designation are
                managed by administration.
              </span>

              <button
                type="submit"
                disabled={
                  profileSaving || profileRequest?.status === "Pending"
                }
              >
                {profileSaving
                  ? "Submitting…"
                  : profileRequest?.status === "Pending"
                    ? "Awaiting approval"
                    : "Submit for approval"}
              </button>
            </div>
          </form>
        </section>

        <footer className="teacher-portal-footer">
          Greenfield University · Teacher Portal
        </footer>
      </main>
    </div>
  );
}