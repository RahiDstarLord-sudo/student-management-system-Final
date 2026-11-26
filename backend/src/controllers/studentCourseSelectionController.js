
const db = require("../config/db");

function studentOnly(req, res) {
  if (!req.user || req.user.role !== "student" || !req.user.studentId) {
    res.status(403).json({ error: "Students only" });
    return false;
  }
  return true;
}

function adminOnly(req, res) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admins only" });
    return false;
  }
  return true;
}

async function getCourseSelectionData(req, res) {
  if (!studentOnly(req, res)) return;

  try {
    const [students] = await db.promise().query(
      "SELECT department_id, status FROM students WHERE student_id = ? LIMIT 1",
      [req.user.studentId]
    );

    if (!students.length || students[0].status !== "Active") {
      return res.status(403).json({
        error: "Your student account is not active",
      });
    }

    const departmentId = students[0].department_id;

    if (!departmentId) {
      return res.status(409).json({
        error: "Your department has not been assigned. Contact administration.",
      });
    }

    const [years] = await db.promise().query(
      `SELECT id, year_name
       FROM academic_years
       WHERE status = 'Active'
       ORDER BY start_date DESC
       LIMIT 1`
    );

    if (!years.length) {
      return res.status(409).json({
        error: "No active academic year is configured yet.",
      });
    }

    const academicYear = years[0];

    const [semesters] = await db.promise().query(
      `SELECT id, semester_number, semester_name
       FROM semesters
       WHERE department_id = ? AND status = 'Active'
       ORDER BY semester_number ASC`,
      [departmentId]
    );

    const [courses] = await db.promise().query(
      `SELECT c.id, c.course_code, c.course_name, c.credits,
              c.teacher, c.semester_id, s.semester_number
       FROM courses c
       INNER JOIN semesters s ON s.id = c.semester_id
       WHERE c.department_id = ?
         AND s.department_id = ?
         AND s.status = 'Active'
       ORDER BY s.semester_number, c.course_code`,
      [departmentId, departmentId]
    );

    const [selected] = await db.promise().query(
      `SELECT course_id, semester_id
       FROM course_selections
       WHERE student_id = ?
         AND academic_year_id = ?
         AND selection_status = 'Selected'`,
      [req.user.studentId, academicYear.id]
    );

    const [pendingRequests] = await db.promise().query(
      `SELECT id, semester_id, status, created_at
       FROM course_selection_requests
       WHERE student_id = ?
         AND academic_year_id = ?
         AND status = 'Pending'`,
      [req.user.studentId, academicYear.id]
    );

    let pendingItems = [];

    if (pendingRequests.length) {
      const requestIds = pendingRequests.map((request) => request.id);
      const placeholders = requestIds.map(() => "?").join(",");

      const [items] = await db.promise().query(
        `SELECT request_id, course_id
         FROM course_selection_request_items
         WHERE request_id IN (${placeholders})`,
        requestIds
      );

      pendingItems = items;
    }

    return res.json({
      academicYear,
      semesters: semesters.map((semester) => {
        const pendingRequest = pendingRequests.find(
          (request) =>
            Number(request.semester_id) === Number(semester.id)
        );

        return {
          ...semester,

          courses: courses.filter(
            (course) =>
              Number(course.semester_id) === Number(semester.id)
          ),

          selectedCourseIds: selected
            .filter(
              (row) =>
                Number(row.semester_id) === Number(semester.id)
            )
            .map((row) => Number(row.course_id)),

          requestStatus: pendingRequest
            ? pendingRequest.status
            : null,

          requestId: pendingRequest
            ? pendingRequest.id
            : null,

          pendingCourseIds: pendingRequest
            ? pendingItems
                .filter(
                  (item) =>
                    Number(item.request_id) === Number(pendingRequest.id)
                )
                .map((item) => Number(item.course_id))
            : [],
        };
      }),
    });
  } catch (error) {
    console.error("Course selection data error:", error);
    return res.status(500).json({
      error: "Could not load course selection data",
    });
  }
}

async function saveCourseSelection(req, res) {
  if (!studentOnly(req, res)) return;

  const semesterId = Number(req.body.semesterId);
  const courseIds = req.body.courseIds;

  if (
    !Number.isInteger(semesterId) ||
    semesterId < 1 ||
    !Array.isArray(courseIds) ||
    courseIds.length === 0 ||
    courseIds.some(
      (id) => !Number.isInteger(Number(id)) || Number(id) < 1
    )
  ) {
    return res.status(400).json({
      error: "Choose a valid semester and at least one course",
    });
  }

  const normalizedIds = [...new Set(courseIds.map(Number))];

  const conn = await db.promise().getConnection();

  try {
    await conn.beginTransaction();

    const [students] = await conn.query(
      `SELECT department_id, status
       FROM students
       WHERE student_id = ?
       FOR UPDATE`,
      [req.user.studentId]
    );

    if (
      !students.length ||
      students[0].status !== "Active" ||
      !students[0].department_id
    ) {
      await conn.rollback();
      return res.status(403).json({
        error: "Your active student profile or department was not found",
      });
    }

    const [years] = await conn.query(
      `SELECT id
       FROM academic_years
       WHERE status = 'Active'
       ORDER BY start_date DESC
       LIMIT 1`
    );

    if (!years.length) {
      await conn.rollback();
      return res.status(409).json({
        error: "No active academic year is configured yet",
      });
    }

    const yearId = years[0].id;

    const [semesters] = await conn.query(
      `SELECT id
       FROM semesters
       WHERE id = ?
         AND department_id = ?
         AND status = 'Active'
         AND semester_number BETWEEN 1 AND 8`,
      [semesterId, students[0].department_id]
    );

    if (!semesters.length) {
      await conn.rollback();
      return res.status(400).json({
        error: "This semester is not available for your department",
      });
    }

    const [existingRequests] = await conn.query(
      `SELECT id
       FROM course_selection_requests
       WHERE student_id = ?
         AND academic_year_id = ?
         AND semester_id = ?
         AND status = 'Pending'
       LIMIT 1
       FOR UPDATE`,
      [req.user.studentId, yearId, semesterId]
    );

    if (existingRequests.length) {
      await conn.rollback();
      return res.status(409).json({
        error: "You already have a pending request for this semester",
      });
    }

    const placeholders = normalizedIds.map(() => "?").join(",");

    const [validCourses] = await conn.query(
      `SELECT id
       FROM courses
       WHERE id IN (${placeholders})
         AND department_id = ?
         AND semester_id = ?`,
      [
        ...normalizedIds,
        students[0].department_id,
        semesterId,
      ]
    );

    if (validCourses.length !== normalizedIds.length) {
      await conn.rollback();
      return res.status(400).json({
        error: "One or more selected courses do not belong to this semester and department",
      });
    }

    const [requestResult] = await conn.query(
      `INSERT INTO course_selection_requests
       (student_id, academic_year_id, semester_id, status)
       VALUES (?, ?, ?, 'Pending')`,
      [req.user.studentId, yearId, semesterId]
    );

    const values = normalizedIds
      .map(() => "(?, ?)")
      .join(",");

    const params = normalizedIds.flatMap((courseId) => [
      requestResult.insertId,
      courseId,
    ]);

    await conn.query(
      `INSERT INTO course_selection_request_items
       (request_id, course_id)
       VALUES ${values}`,
      params
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Course selection request submitted for admin approval",
      requestId: requestResult.insertId,
      status: "Pending",
      pendingCourseIds: normalizedIds,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Save course selection request error:", error);

    return res.status(500).json({
      error: "Could not submit course selection request",
    });
  } finally {
    conn.release();
  }
}

// Admin: list pending course selection requests.
async function getPendingCourseSelectionRequests(req, res) {
  if (!adminOnly(req, res)) return;

  try {
    const [requests] = await db.promise().query(
      `SELECT
         r.id AS request_id,
         r.student_id,
         st.name AS student_name,
         st.email AS student_email,
         r.academic_year_id,
         ay.year_name,
         r.semester_id,
         s.semester_name,
         s.semester_number,
         r.status,
         r.created_at
       FROM course_selection_requests r
       INNER JOIN students st ON st.student_id = r.student_id
       INNER JOIN academic_years ay ON ay.id = r.academic_year_id
       INNER JOIN semesters s ON s.id = r.semester_id
       WHERE r.status = 'Pending'
       ORDER BY r.created_at ASC`
    );

    if (!requests.length) {
      return res.json([]);
    }

    const requestIds = requests.map((request) => request.request_id);
    const placeholders = requestIds.map(() => "?").join(",");

    const [items] = await db.promise().query(
      `SELECT
         i.request_id,
         c.id AS course_id,
         c.course_code,
         c.course_name,
         c.credits
       FROM course_selection_request_items i
       INNER JOIN courses c ON c.id = i.course_id
       WHERE i.request_id IN (${placeholders})
       ORDER BY c.course_code`,
      requestIds
    );

    return res.json(
      requests.map((request) => ({
        ...request,
        courses: items.filter(
          (item) =>
            Number(item.request_id) === Number(request.request_id)
        ),
      }))
    );
  } catch (error) {
    console.error("Get pending course requests error:", error);
    return res.status(500).json({
      error: "Could not load pending course selection requests",
    });
  }
}

// Admin: approve one pending request.
async function approveCourseSelectionRequest(req, res) {
  if (!adminOnly(req, res)) return;

  const requestId = Number(req.params.requestId);

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const conn = await db.promise().getConnection();

  try {
    await conn.beginTransaction();

    const [requests] = await conn.query(
      `SELECT *
       FROM course_selection_requests
       WHERE id = ?
       FOR UPDATE`,
      [requestId]
    );

    if (!requests.length) {
      await conn.rollback();
      return res.status(404).json({
        error: "Course selection request not found",
      });
    }

    const request = requests[0];

    if (request.status !== "Pending") {
      await conn.rollback();
      return res.status(409).json({
        error: "This request has already been reviewed",
      });
    }

    const [items] = await conn.query(
      `SELECT course_id
       FROM course_selection_request_items
       WHERE request_id = ?`,
      [requestId]
    );

    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({
        error: "This request contains no courses",
      });
    }

    for (const item of items) {
      await conn.query(
        `INSERT INTO course_selections
         (student_id, course_id, academic_year_id, semester_id, selection_status)
         VALUES (?, ?, ?, ?, 'Selected')
         ON DUPLICATE KEY UPDATE selection_status = 'Selected'`,
        [
          request.student_id,
          item.course_id,
          request.academic_year_id,
          request.semester_id,
        ]
      );
    }

    await conn.query(
      `INSERT INTO student_enrollments
       (student_id, academic_year_id, semester_id, enrollment_date, status)
       VALUES (?, ?, ?, CURDATE(), 'Active')
       ON DUPLICATE KEY UPDATE status = 'Active'`,
      [
        request.student_id,
        request.academic_year_id,
        request.semester_id,
      ]
    );

    await conn.query(
      `UPDATE course_selection_requests
       SET status = 'Approved',
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [req.user.id || null, requestId]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: "Course selection request approved",
    });
  } catch (error) {
    await conn.rollback();
    console.error("Approve course request error:", error);

    return res.status(500).json({
      error: "Could not approve course selection request",
    });
  } finally {
    conn.release();
  }
}

// Admin: reject one pending request.
async function rejectCourseSelectionRequest(req, res) {
  if (!adminOnly(req, res)) return;

  const requestId = Number(req.params.requestId);

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  try {
    const [result] = await db.promise().query(
      `UPDATE course_selection_requests
       SET status = 'Rejected',
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?
         AND status = 'Pending'`,
      [req.user.id || null, requestId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        error: "Pending course selection request not found",
      });
    }

    return res.json({
      success: true,
      message: "Course selection request rejected",
    });
  } catch (error) {
    console.error("Reject course request error:", error);

    return res.status(500).json({
      error: "Could not reject course selection request",
    });
  }
}

module.exports = {
  getCourseSelectionData,
  saveCourseSelection,
  getPendingCourseSelectionRequests,
  approveCourseSelectionRequest,
  rejectCourseSelectionRequest,
};


