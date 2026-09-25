import { Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { type Category, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type { CreateCategoryInput } from "#finance/dto/category.dto";

const log = scopedLogger("CategoriesService");

const ADJUSTMENT = "Adjustment";

/** What `Category.metadata` holds. */
export interface CategoryMetadata {
  /**
   * Seeded categories only: a stable id ("groceries") the web app translates
   * the name by. A user's own categories have none and show their name as is.
   */
  key?: string;
  /** Extra words the quick-log parser matches: "latte" → Coffee, "cà phê" → Coffee. */
  aliases?: string[];
  /** "amountMinor|label" combinations the user said no to saving as a preset. */
  dismissedPresetSuggestions?: string[];
}

export function categoryMetadata(category: Pick<Category, "metadata">): CategoryMetadata {
  const value = category.metadata;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CategoryMetadata)
    : {};
}

/**
 * Seeded once, on an empty table. The first six are also quick log's starter
 * chips before there's any history to rank (see QuickLogService).
 */
const DEFAULT_CATEGORIES: {
  key: string;
  name: string;
  icon: string;
  kind?: string;
  aliases: string[];
}[] = [
  {
    key: "groceries",
    name: "Groceries",
    icon: "🛒",
    aliases: [
      "tesco",
      "sainsburys",
      "aldi",
      "lidl",
      "asda",
      "supermarket",
      "food shop",
      "đi chợ",
      "chợ",
      "siêu thị",
      "tạp hóa",
      "thực phẩm",
      "winmart",
      "bách hóa xanh",
      "coopmart",
    ],
  },
  {
    key: "eating-out",
    name: "Eating out",
    icon: "🍔",
    aliases: [
      "lunch",
      "dinner",
      "restaurant",
      "takeaway",
      "breakfast",
      "pizza",
      "ăn sáng",
      "ăn trưa",
      "ăn tối",
      "ăn uống",
      "nhà hàng",
      "quán ăn",
      "phở",
      "bún",
      "cơm",
    ],
  },
  {
    key: "coffee",
    name: "Coffee",
    icon: "☕",
    aliases: [
      "latte",
      "flat white",
      "cappuccino",
      "starbucks",
      "costa",
      "pret",
      "tea",
      "cà phê",
      "cafe",
      "trà",
      "trà sữa",
      "highlands",
      "phúc long",
    ],
  },
  {
    key: "transport",
    name: "Transport",
    icon: "🚌",
    aliases: [
      "bus",
      "train",
      "tube",
      "taxi",
      "uber",
      "fuel",
      "petrol",
      "parking",
      "xe buýt",
      "xăng",
      "grab",
      "gửi xe",
      "tàu",
      "vé tàu",
    ],
  },
  {
    key: "shopping",
    name: "Shopping",
    icon: "🛍️",
    aliases: ["amazon", "clothes", "mua sắm", "quần áo", "shopee", "lazada", "tiki"],
  },
  {
    key: "bills",
    name: "Bills",
    icon: "🧾",
    aliases: [
      "electric",
      "gas",
      "water",
      "phone",
      "internet",
      "council tax",
      "hóa đơn",
      "tiền điện",
      "tiền nước",
      "tiền mạng",
      "điện thoại",
    ],
  },
  {
    key: "drinks",
    name: "Drinks",
    icon: "🍺",
    aliases: ["pub", "beer", "wine", "bar", "bia", "nhậu", "rượu"],
  },
  {
    key: "home",
    name: "Home",
    icon: "🏠",
    aliases: ["rent", "mortgage", "furniture", "tiền nhà", "thuê nhà", "nội thất"],
  },
  {
    key: "entertainment",
    name: "Entertainment",
    icon: "🎬",
    aliases: [
      "cinema",
      "tickets",
      "games",
      "concert",
      "xem phim",
      "giải trí",
      "vé xem phim",
      "trò chơi",
    ],
  },
  {
    key: "subscriptions",
    name: "Subscriptions",
    icon: "📺",
    aliases: ["netflix", "spotify", "subscription", "gói cước", "đăng ký"],
  },
  {
    key: "health",
    name: "Health",
    icon: "💊",
    aliases: [
      "pharmacy",
      "gym",
      "dentist",
      "doctor",
      "thuốc",
      "nhà thuốc",
      "khám bệnh",
      "bác sĩ",
      "nha sĩ",
      "phòng gym",
    ],
  },
  {
    key: "gifts",
    name: "Gifts",
    icon: "🎁",
    aliases: ["present", "birthday", "quà", "quà tặng", "sinh nhật", "mừng cưới", "lì xì"],
  },
  {
    key: "travel",
    name: "Travel",
    icon: "✈️",
    aliases: [
      "hotel",
      "flight",
      "holiday",
      "airbnb",
      "du lịch",
      "khách sạn",
      "vé máy bay",
      "homestay",
    ],
  },
  {
    key: "salary",
    name: "Salary",
    icon: "💼",
    kind: "income",
    aliases: ["pay", "wages", "payday", "lương", "thưởng"],
  },
  {
    key: "other-income",
    name: "Other income",
    icon: "💰",
    kind: "income",
    aliases: ["refund", "income", "hoàn tiền", "thu nhập"],
  },
];

export const STARTER_CATEGORY_NAMES = DEFAULT_CATEGORIES.slice(0, 6).map((c) => c.name);

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reconciling depends on the built-in "Adjustment" category, so it's made
   * sure of on every start. The default categories only go into an empty
   * table, so a user's edits are never overwritten.
   */
  async onModuleInit(): Promise<void> {
    await this.adjustmentCategory();
    await this.seedDefaults();
  }

  async seedDefaults(): Promise<void> {
    const existing = await this.prisma.category.count({ where: { isSystem: false } });
    if (existing > 0) return;
    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c, sortOrder) => ({
        name: c.name,
        icon: c.icon,
        kind: c.kind ?? "expense",
        sortOrder,
        metadata: { key: c.key, aliases: c.aliases },
      })),
      skipDuplicates: true,
    });
    log.info({ count: DEFAULT_CATEGORIES.length }, "default categories seeded");
  }

  /** Active categories users pick from; the system ones (Adjustment) are left out. */
  list(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { archivedAt: null, isSystem: false },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /** By id, archived and system ones included: for resolving a transaction's category. */
  findByIds(ids: string[]): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { id: { in: ids } } });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const last = await this.prisma.category.aggregate({ _max: { sortOrder: true } });
    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        icon: input.icon ?? null,
        kind: input.kind,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        metadata: { aliases: input.aliases ?? [] },
      },
    });
    log.info({ categoryId: category.id }, "category created");
    return category;
  }

  /** Remembers a "no thanks" to "Save as preset?" so it isn't asked again. */
  async dismissPresetSuggestion(id: string, key: string): Promise<void> {
    const category = await this.findOne(id);
    const metadata = categoryMetadata(category);
    const dismissed = new Set(metadata.dismissedPresetSuggestions ?? []);
    dismissed.add(key);
    await this.prisma.category.update({
      where: { id },
      data: {
        metadata: {
          ...metadata,
          dismissedPresetSuggestions: [...dismissed],
        } as Prisma.InputJsonObject,
      },
    });
  }

  /** The category balance adjustments are filed under; reports ignore it. */
  async adjustmentCategory(): Promise<Category> {
    const existing = await this.prisma.category.findFirst({
      where: { name: ADJUSTMENT, parentId: null, isSystem: true },
    });
    if (existing) return existing;

    // A concurrent first start may have created it in the meantime:
    // `categories_top_level_name_key` makes the second insert fail, so re-read.
    try {
      const created = await this.prisma.category.create({
        data: {
          name: ADJUSTMENT,
          icon: "⚖️",
          kind: "expense",
          isSystem: true,
          metadata: { key: "adjustment" },
        },
      });
      log.info({ categoryId: created.id }, "system category created");
      return created;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError)) throw err;
      return this.prisma.category.findFirstOrThrow({ where: { name: ADJUSTMENT, parentId: null } });
    }
  }
}
