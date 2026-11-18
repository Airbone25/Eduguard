import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileSpreadsheet, BookOpen } from "lucide-react";
import { teacherApi } from "@/lib/api/teacher";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadClasses = async () => {
    setError(null);
    try {
      setClasses((await teacherApi.classes()) || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadClasses();
  }, []);
  if (loading)
    return <LoadingSkeleton label="Getting your assigned classes…" />;
  if (error) return <ErrorState error={error} retry={loadClasses} />;
  return (
    <div>
      <PageHeader
        title="My classes"
        description="A place for every class. Record the week, notice a change, and follow through."
      />
      {classes.length ? (
        <section className="course-list" aria-label="Assigned classes">
          {classes.map((course) => (
            <article className="course-row" key={course.id}>
              <span className="course-symbol">
                <BookOpen size={24} strokeWidth={1.5} />
              </span>
              <div className="course-name">
                <h2>
                  <Link to={`/teacher/classes/${course.id}`}>
                    {course.subject_name}
                  </Link>
                </h2>
                <p>
                  {course.classroom_name} · Academic year {course.academic_year}
                </p>
              </div>
              <div className="course-actions">
                <Link
                  className="button button-secondary"
                  to={`/teacher/classes/${course.id}/weekly`}
                >
                  <FileSpreadsheet size={16} />
                  Record a week
                </Link>
                <Link
                  className="text-link"
                  to={`/teacher/classes/${course.id}`}
                >
                  Open class <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Your classes will appear here"
          description="Ask your school administrator to assign your course offerings."
        />
      )}
    </div>
  );
}
