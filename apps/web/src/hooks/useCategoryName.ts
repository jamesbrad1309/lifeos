import { useTranslation } from "react-i18next";
import type { Category } from "#graphql/types";
import type { finance } from "#i18n/en/finance";

type SeededKey = keyof typeof finance.categories;

/**
 * A category's name in the app's language. Seeded categories carry a stable
 * `key` and are translated; the user's own show their name as typed. Null
 * is the uncategorised bucket.
 */
export function useCategoryName(): (
  category: Pick<Category, "name" | "key"> | null | undefined,
) => string {
  const { t, i18n } = useTranslation();
  return (category) => {
    if (!category) return t("finance.uncategorised");
    if (!category.key || !i18n.exists(`finance.categories.${category.key}`)) return category.name;
    return t(`finance.categories.${category.key as SeededKey}`);
  };
}
