import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import { getAdminProductForEdit, getAdminProductImages, getProductStockMovements, getProductAccessories, getLinkableAccessories } from "@/lib/db/queries/products";
import { getAdminCategoryList } from "@/lib/db/queries/categories";
import { getBrandOptions } from "@/lib/db/queries/brands";
import ProductForm from "@/components/admin/ProductForm";
import { getSetting } from "@/lib/db/queries/settings";
import ProductInventoryManager from "@/components/admin/ProductInventoryManager";
import ProductSpecsPanel from "@/components/admin/ProductSpecsPanel";
import { getAdminProductSpecs } from "@/lib/db/queries/product-specs";
import ProductImageManager from "@/components/admin/ProductImageManager";
import ProductAccessoriesManager from "@/components/admin/ProductAccessoriesManager";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEditProductPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("catalog:write");

  const initial = await getAdminProductForEdit(id);
  if (!initial) notFound();

  const [categoryList, brandOptions, images, movements, accessories, linkableAccessories, specs, loyaltyProgram] = await Promise.all([
    getAdminCategoryList(),
    getBrandOptions(),
    getAdminProductImages(initial.sku),
    getProductStockMovements(initial.sku),
    getProductAccessories(initial.sku),
    getLinkableAccessories(initial.sku),
    getAdminProductSpecs(initial.sku),
    getSetting("loyalty_program"),
  ]);

  const categoryTree = categoryList.map((c) => ({
    id: c.id,
    slug: c.slug,
    nameEn: c.nameEn,
    isVisible: c.isVisible,
    children: c.children.map((ch) => ({
      id: ch.id,
      slug: ch.slug,
      nameEn: ch.nameEn,
      isVisible: ch.isVisible,
    })),
  }));

  return (
    <ProductForm
      mode="edit"
      initial={initial}
      categoryTree={categoryTree}
      brandOptions={brandOptions}
      loyaltyProgram={{
        enabled: loyaltyProgram.enabled,
        earnRate: loyaltyProgram.earnRate,
      }}
      imageCount={images.length}
      specCount={specs.length}
      slots={{
        images: (
          <ProductImageManager
            productSku={initial.sku}
            productId={initial.id}
            images={images}
          />
        ),
        inventory: (
          <ProductInventoryManager
            productId={initial.id}
            stockQuantity={initial.stockQuantity}
            reservedQuantity={initial.reservedQuantity}
            lowStockThreshold={initial.lowStockThreshold}
            movements={movements}
          />
        ),
        specs: <ProductSpecsPanel productId={initial.id} specs={specs} />,
        addons: (
          <ProductAccessoriesManager
            productId={initial.id}
            productName={initial.nameEn}
            accessories={accessories}
            linkable={linkableAccessories}
          />
        ),
      }}
    />
  );
}
