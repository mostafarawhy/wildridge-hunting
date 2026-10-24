import { requireStaff } from "@/lib/auth-staff";
import { getCategoryParentOptions } from "@/lib/db/queries/categories";
import CategoryForm from "@/components/admin/CategoryForm";

interface Props {
  searchParams: Promise<{ parent?: string }>;
}

export default async function AdminNewCategoryPage({ searchParams }: Props) {
  await requireStaff("catalog:write");

  const sp = await searchParams;
  const parentOptions = await getCategoryParentOptions();
  const initialParentId =
    sp.parent && parentOptions.some((p) => p.id === sp.parent)
      ? sp.parent
      : undefined;

  return (
    <CategoryForm
      mode="create"
      parentOptions={parentOptions}
      initialParentId={initialParentId}
    />
  );
}
