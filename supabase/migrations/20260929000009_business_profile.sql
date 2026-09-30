-- Business profile: everything the site says about the restaurant (name, address, texts,
-- social links, order number prefix). Stored here instead of in the code so the owner
-- can change it in Admin -> Settings -> Business profile.
-- Translatable fields are {"en": ..., "ka": ..., "ru": ...}; Georgian and Russian fall
-- back to English when empty.

alter table public.restaurant_settings
  -- Identity
  add column brand_name text not null default 'Restaurant'
    check (length(trim(brand_name)) between 1 and 60),
  add column site_name jsonb not null default '{"en": "Restaurant"}'::jsonb
    check (public.is_i18n_text(site_name)),
  add column monogram text not null default 'R'
    check (length(trim(monogram)) between 1 and 3),
  add column order_prefix text not null default 'R'
    check (order_prefix ~ '^[A-Z0-9]{1,6}$'),
  add column tagline jsonb not null default '{}'::jsonb check (jsonb_typeof(tagline) = 'object'),
  add column specialties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(specialties) = 'object'),
  add column cuisines text[] not null default '{}',
  -- Address and contact
  add column street jsonb not null default '{}'::jsonb check (jsonb_typeof(street) = 'object'),
  add column city jsonb not null default '{}'::jsonb check (jsonb_typeof(city) = 'object'),
  add column postal_code text not null default '' check (length(postal_code) <= 20),
  add column country_code text not null default 'GE' check (country_code ~ '^[A-Z]{2}$'),
  add column email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
  add column facebook_url text check (facebook_url is null or facebook_url ~ '^https://'),
  add column tiktok_url text check (tiktok_url is null or tiktok_url ~ '^https://'),
  -- Home page texts
  add column headline jsonb not null default '{}'::jsonb check (jsonb_typeof(headline) = 'object'),
  add column intro jsonb not null default '{}'::jsonb check (jsonb_typeof(intro) = 'object'),
  add column about_title jsonb not null default '{}'::jsonb
    check (jsonb_typeof(about_title) = 'object'),
  -- Paragraphs separated by a blank line.
  add column about_text jsonb not null default '{}'::jsonb
    check (jsonb_typeof(about_text) = 'object'),
  -- Words in the scrolling band: {"en": ["...", "..."], "ka": [...], "ru": [...]}.
  add column highlights jsonb not null default '{}'::jsonb
    check (jsonb_typeof(highlights) = 'object'),
  -- Up to 4 "why us" cards: [{"title": {...}, "text": {...}}, ...].
  add column features jsonb not null default '[]'::jsonb
    check (jsonb_typeof(features) = 'array' and jsonb_array_length(features) <= 4),
  -- Search engines and link previews
  add column seo_title jsonb not null default '{}'::jsonb check (jsonb_typeof(seo_title) = 'object'),
  add column seo_description jsonb not null default '{}'::jsonb
    check (jsonb_typeof(seo_description) = 'object'),
  add column menu_description jsonb not null default '{}'::jsonb
    check (jsonb_typeof(menu_description) = 'object');

-- Starting content for Biryani Point. Change it from the admin panel, not here.
update public.restaurant_settings set
  brand_name = 'Biryani Point',
  site_name = '{"en": "Biryani Point Batumi", "ka": "Biryani Point ბათუმი", "ru": "Biryani Point Батуми"}',
  monogram = 'BP',
  order_prefix = 'BP',
  tagline = '{"en": "Andhra & South Indian kitchen", "ka": "ანდჰრული და სამხრეთ ინდური სამზარეულო", "ru": "Андхрская и южноиндийская кухня"}',
  specialties = '{"en": "Andhra & South Indian · Biryani · Pulao", "ka": "ანდჰრული და სამხრეთ ინდური · ბირიანი · პულაო", "ru": "Андхрская и южноиндийская кухня · Бирьяни · Плов"}',
  cuisines = '{Andhra,"South Indian",Indian,Indo-Chinese}',
  street = '{"en": "7 Sherif Khimshiashvili St", "ka": "შერიფ ხიმშიაშვილის ქ. 7", "ru": "ул. Шерифа Химшиашвили, 7"}',
  city = '{"en": "Batumi", "ka": "ბათუმი", "ru": "Батуми"}',
  postal_code = '6010',
  country_code = 'GE',
  headline = '{"en": "Biryani worth the wait.", "ka": "ბირიანი, რომელიც ლოდინად ღირს.", "ru": "Бирьяни, который стоит ожидания."}',
  intro = '{"en": "An Andhra kitchen in the heart of Batumi. Biryani, pulao and South Indian favourites, cooked fresh to order.", "ka": "ანდჰრული სამზარეულო ბათუმის გულში. ბირიანი, პულაო და სამხრეთ ინდური კერძები, ახლად მომზადებული შეკვეთისთანავე.", "ru": "Андхрская кухня в самом сердце Батуми. Бирьяни, плов и любимые блюда Южной Индии, готовим свежими под заказ."}',
  about_title = '{"en": "An Andhra kitchen in the heart of Batumi.", "ka": "ანდჰრული სამზარეულო ბათუმის გულში.", "ru": "Андхрская кухня в самом сердце Батуми."}',
  about_text = jsonb_build_object(
    'en', E'Biryani Point brings the bold, generous flavours of Andhra Pradesh and South India to Batumi. Fragrant rice, whole spices and slow cooking, the way it''s done back home.\n\nEvery order is cooked fresh when it reaches our kitchen. Pick it up, or have it delivered hot to your door.',
    'ka', E'Biryani Point ბათუმში ანდჰრა-პრადეშისა და სამხრეთ ინდოეთის მდიდარ, მძაფრ გემოებს გთავაზობთ. არომატული ბრინჯი, მთლიანი სანელებლები და ნელი მომზადება, ისე როგორც სახლში.\n\nყოველი შეკვეთა ახლად მზადდება, როგორც კი სამზარეულოში შემოვა. წაიღეთ თავად ან შეუკვეთეთ ცხლად კარამდე.',
    'ru', E'Biryani Point привозит в Батуми яркие, щедрые вкусы Андхра-Прадеш и Южной Индии. Ароматный рис, цельные специи и неспешное приготовление, как дома.\n\nКаждый заказ готовится свежим, как только поступает на кухню. Заберите сами или получите горячим с доставкой.'
  ),
  highlights = '{"en": ["Andhra spice", "Cooked to order", "Biryani & pulao", "Delivery & pickup", "Order online", "Veg options"], "ka": ["ანდჰრული სანელებლები", "მზადდება შეკვეთისთანავე", "ბირიანი და პულაო", "მიტანა და გატანა", "ონლაინ შეკვეთა", "უხორცო კერძები"], "ru": ["Андхрские специи", "Готовим под заказ", "Бирьяни и плов", "Доставка и самовывоз", "Заказ онлайн", "Блюда без мяса"]}',
  features = '[{"title":{"en":"Andhra recipes","ka":"ანდჰრული რეცეპტები","ru":"Андхрские рецепты"},"text":{"en":"Bold spice, the way it''s made at home.","ka":"მძაფრი გემო, როგორც სახლში.","ru":"Яркие специи, как дома."}},{"title":{"en":"Cooked to order","ka":"მზადდება შეკვეთისთანავე","ru":"Готовим под заказ"},"text":{"en":"Nothing waits under a heat lamp.","ka":"არაფერი ელოდება გამათბობლის ქვეშ.","ru":"Ничего не ждёт под лампой."}},{"title":{"en":"Delivery or pickup","ka":"მიტანა ან გატანა","ru":"Доставка или самовывоз"},"text":{"en":"Hot to your door, or collect it yourself.","ka":"ცხლად კარამდე, ან თავად წაიღეთ.","ru":"Горячим до двери или заберите сами."}},{"title":{"en":"Veg options","ka":"უხორცო კერძები","ru":"Блюда без мяса"},"text":{"en":"Filter the menu in one tap.","ka":"მენიუს ფილტრი ერთი შეხებით.","ru":"Фильтр меню в одно касание."}}]',
  seo_title = '{"en": "Biryani Point Batumi | Andhra & South Indian food, delivery and pickup", "ka": "Biryani Point ბათუმი | ანდჰრული და სამხრეთ ინდური კერძები, მიტანა და გატანა", "ru": "Biryani Point Батуми | Андхрская и южноиндийская кухня, доставка и самовывоз"}',
  seo_description = '{"en": "Andhra and South Indian restaurant in Batumi. Biryani, pulao, mandi and Indo-Chinese at 7 Sherif Khimshiashvili St. Order online for delivery or pickup.", "ka": "ანდჰრული და სამხრეთ ინდური სამზარეულოს რესტორანი ბათუმში. ბირიანი, პულაო, მანდი და ინდო-ჩინური კერძები, შერიფ ხიმშიაშვილის ქ. 7. შეუკვეთეთ ონლაინ მიტანით ან გასატანად.", "ru": "Ресторан андхрской и южноиндийской кухни в Батуми. Бирьяни, плов, манди и индо-китайские блюда на ул. Шерифа Химшиашвили, 7. Закажите онлайн с доставкой или самовывозом."}',
  menu_description = '{"en": "Biryani, pulao, mandi and Indo-Chinese dishes. Order online for delivery or pickup in Batumi.", "ka": "ბირიანი, პულაო, მანდი და ინდო-ჩინური კერძები. შეუკვეთეთ ონლაინ მიტანით ან გასატანად ბათუმში.", "ru": "Бирьяни, плов, манди и индо-китайские блюда. Закажите онлайн с доставкой или самовывозом в Батуми."}'
where id = 1;
