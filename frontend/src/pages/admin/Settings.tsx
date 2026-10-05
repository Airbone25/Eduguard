import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminApi, type School } from "@/features/admin/api";
import { PageHeader } from "@/components/common/domain";
import { LoadingSkeleton, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
function SchoolForm({ school }: { school: School }) {
  const qc = useQueryClient();
  const form = useForm<{ name: string }>({
    resolver: zodResolver(
      z.object({ name: z.string().trim().min(1).max(200) }),
    ),
    defaultValues: { name: school.name },
  });
  const mutation = useMutation({
    mutationFn: (v: { name: string }) => adminApi.write("settings", v, "PATCH"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <form
      className="panel padded stack"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      <label>
        School name
        <input
          {...form.register("name")}
          aria-invalid={!!form.formState.errors.name}
        />
      </label>
      {form.formState.errors.name && (
        <p role="alert">{form.formState.errors.name.message}</p>
      )}
      <p>
        Sign-in code: <strong>{school.slug}</strong>
      </p>
      {school.domain && <p>Domain: {school.domain}</p>}
      <Button disabled={mutation.isPending}>Save school name</Button>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {mutation.isSuccess && <p role="status">School settings saved.</p>}
    </form>
  );
}
export default function Settings() {
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: ({ signal }) => adminApi.school(signal),
  });
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="School settings"
        description="The details your school shares."
      />
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <SchoolForm school={query.data} />
      )}
    </>
  );
}
