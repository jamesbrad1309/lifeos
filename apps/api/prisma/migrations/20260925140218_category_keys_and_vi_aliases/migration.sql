-- Seeded categories get a stable key the web app translates their name by,
-- and Vietnamese aliases for the quick-log parser. Only rows still carrying
-- a seeded name are touched; aliases a user added are kept (union).
UPDATE "categories" AS c
SET "metadata" = c."metadata"
  || jsonb_build_object('key', d.key)
  || jsonb_build_object('aliases', (
       SELECT jsonb_agg(DISTINCT a)
       FROM jsonb_array_elements_text(COALESCE(c."metadata"->'aliases', '[]'::jsonb) || d.aliases) AS a
     ))
FROM (VALUES
  ('Groceries', 'groceries', '["tesco", "sainsburys", "aldi", "lidl", "asda", "supermarket", "food shop", "đi chợ", "chợ", "siêu thị", "tạp hóa", "thực phẩm", "winmart", "bách hóa xanh", "coopmart"]'::jsonb),
  ('Eating out', 'eating-out', '["lunch", "dinner", "restaurant", "takeaway", "breakfast", "pizza", "ăn sáng", "ăn trưa", "ăn tối", "ăn uống", "nhà hàng", "quán ăn", "phở", "bún", "cơm"]'::jsonb),
  ('Coffee', 'coffee', '["latte", "flat white", "cappuccino", "starbucks", "costa", "pret", "tea", "cà phê", "cafe", "trà", "trà sữa", "highlands", "phúc long"]'::jsonb),
  ('Transport', 'transport', '["bus", "train", "tube", "taxi", "uber", "fuel", "petrol", "parking", "xe buýt", "xăng", "grab", "gửi xe", "tàu", "vé tàu"]'::jsonb),
  ('Shopping', 'shopping', '["amazon", "clothes", "mua sắm", "quần áo", "shopee", "lazada", "tiki"]'::jsonb),
  ('Bills', 'bills', '["electric", "gas", "water", "phone", "internet", "council tax", "hóa đơn", "tiền điện", "tiền nước", "tiền mạng", "điện thoại"]'::jsonb),
  ('Drinks', 'drinks', '["pub", "beer", "wine", "bar", "bia", "nhậu", "rượu"]'::jsonb),
  ('Home', 'home', '["rent", "mortgage", "furniture", "tiền nhà", "thuê nhà", "nội thất"]'::jsonb),
  ('Entertainment', 'entertainment', '["cinema", "tickets", "games", "concert", "xem phim", "giải trí", "vé xem phim", "trò chơi"]'::jsonb),
  ('Subscriptions', 'subscriptions', '["netflix", "spotify", "subscription", "gói cước", "đăng ký"]'::jsonb),
  ('Health', 'health', '["pharmacy", "gym", "dentist", "doctor", "thuốc", "nhà thuốc", "khám bệnh", "bác sĩ", "nha sĩ", "phòng gym"]'::jsonb),
  ('Gifts', 'gifts', '["present", "birthday", "quà", "quà tặng", "sinh nhật", "mừng cưới", "lì xì"]'::jsonb),
  ('Travel', 'travel', '["hotel", "flight", "holiday", "airbnb", "du lịch", "khách sạn", "vé máy bay", "homestay"]'::jsonb),
  ('Salary', 'salary', '["pay", "wages", "payday", "lương", "thưởng"]'::jsonb),
  ('Other income', 'other-income', '["refund", "income", "hoàn tiền", "thu nhập"]'::jsonb)
) AS d(name, key, aliases)
WHERE c."name" = d.name AND c."parentId" IS NULL AND NOT c."isSystem" AND c."metadata"->>'key' IS NULL;

UPDATE "categories" SET "metadata" = "metadata" || '{"key": "adjustment"}'::jsonb
WHERE "isSystem" AND "name" = 'Adjustment' AND "metadata"->>'key' IS NULL;
