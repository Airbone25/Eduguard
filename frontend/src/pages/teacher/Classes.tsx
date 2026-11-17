import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";
import {
  useTeacherClasses,
  useTeacherClassStudents,
} from "@/features/classes/hooks";
import { PageHeader } from "@/components/common/domain";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import { courseLabel } from "@/lib/utils";

export default function Classes() {
  const classes = useTeacherClasses();
  if (classes.isPending)
    return <LoadingSkeleton label="Loading your classes" />;
  if (classes.error)
    return (
      <ErrorState
        error={classes.error}
        retry={() => {
          void classes.refetch();
        }}
      />
    );
  return (
    <>
      <PageHeader
        title="My classes"
        description="The courses you’re assigned to. The students you help move forward."
      />
      {classes.data.length ? (
        <div className="class-grid">
          {classes.data.map((c) => (
            <Link
              className="class-card"
              key={c.id}
              to={`/teacher/classes/${c.id}`}
            >
              <span className="course-icon">
                <BookOpen size={24} />
              </span>
              <span className="class-year">
                Academic year {c.academic_year}
              </span>
              <h2>{courseLabel(c)}</h2>
              <p>
                Assigned course <span className="id-label">{c.id}</span>
              </p>
              <span className="class-link">
                View students <ArrowUpRight size={17} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title="No assigned courses yet"
            description="Ask your school administrator to assign your classes. Only your assigned courses will appear here."
          />
        </section>
      )}
    </>
  );
}
export function ClassDetail() {
  const { courseId = "" } = useParams();
  const students = useTeacherClassStudents(courseId);
  return (
    <>
      <PageHeader
        title={`Course ${courseId.slice(0, 8)}`}
        description="Students currently enrolled in this assigned course."
      />
      <Link className="back-link" to="/teacher/classes">
        ← Back to my classes
      </Link>
      {students.isPending ? (
        <LoadingSkeleton label="Loading class roster" />
      ) : students.error ? (
        <ErrorState
          error={students.error}
          retry={() => {
            void students.refetch();
          }}
        />
      ) : (
        <section className="panel">
          <div className="section-heading">
            <h2>
              <Users size={18} /> {students.data.length} students
            </h2>
          </div>
          {students.data.length ? (
            <ul className="roster-list">
              {students.data.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/teacher/students/${s.id}?course=${encodeURIComponent(courseId)}`}
                  >
                    <span className="student-avatar">
                      {s.user.first_name[0]}
                      {s.user.last_name[0]}
                    </span>
                    <span>
                      <strong>
                        {s.user.first_name} {s.user.last_name}
                      </strong>
                      <small>
                        {s.roll_number} · {s.grade_label}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No students enrolled"
              description="Your school administrator can enroll students in this course."
            />
          )}
        </section>
      )}
    </>
  );
}
