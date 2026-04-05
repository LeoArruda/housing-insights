import { apiFetch } from "./client.ts";

export type SubjectSubscription = {
  id: number;
  subject_code: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchSubjectSubscriptions(): Promise<SubjectSubscription[]> {
  const res = await apiFetch<{ data: SubjectSubscription[] }>(
    "/statcan/subject-subscriptions",
  );
  return res.data;
}

export async function createSubjectSubscription(body: {
  subject_code: string;
  label?: string | null;
  enabled?: boolean;
}): Promise<SubjectSubscription> {
  return apiFetch<SubjectSubscription>("/statcan/subject-subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchSubjectSubscription(
  id: number,
  body: { label?: string | null; enabled?: boolean },
): Promise<SubjectSubscription> {
  return apiFetch<SubjectSubscription>(`/statcan/subject-subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSubjectSubscription(id: number): Promise<void> {
  await apiFetch<null>(`/statcan/subject-subscriptions/${id}`, {
    method: "DELETE",
  });
}
