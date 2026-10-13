/**
 * PLACEHOLDER legal text. Replace with your own wording (ideally checked by a
 * lawyer familiar with Georgian law) before launch. Edit the English first,
 * then the Georgian and Russian versions below it.
 *
 * {name}, {address}, {phone} and {orderExample} are filled in from the business profile
 * (Admin → Settings), so the text never goes out of date.
 */
import type { Locale } from '@/shared/domain/i18n-text';

export type LegalPage = 'privacy' | 'terms' | 'refunds';
export type LegalDoc = { updated: string; sections: { heading: string; body: string[] }[] };
export type LegalVars = { name: string; address: string; phone: string; orderExample: string };

/** Replaces {name}, {address}, {phone} and {orderExample} in a paragraph. */
export function fillLegal(text: string, vars: LegalVars): string {
  return text.replace(
    /\{(name|address|phone|orderExample)\}/g,
    (_, key: keyof LegalVars) => vars[key],
  );
}

const UPDATED = '2026-09-29';

const en: Record<LegalPage, LegalDoc> = {
  privacy: {
    updated: UPDATED,
    sections: [
      {
        heading: 'Who we are',
        body: ['{name}, {address}. Phone and WhatsApp: {phone}.'],
      },
      {
        heading: 'What we collect and why',
        body: [
          'When you order, we collect your name, phone number, and for delivery your address and (if you choose to share it) your location. We use them only to prepare, deliver and ask about your order.',
          'We keep a scrambled (hashed) form of your internet address for up to 30 days to stop spam orders. We do not keep the address itself.',
        ],
      },
      {
        heading: 'Your device',
        body: [
          'Your cart, your language and (if you tick “remember my details”) your name, phone and address are saved in your own browser, not on our servers. You can clear them by clearing your browser data.',
          'We do not use advertising or tracking cookies. If we measure visits, we use a privacy-friendly service that does not use cookies.',
        ],
      },
      {
        heading: 'Who we share it with',
        body: [
          'Our hosting and database providers store order data for us. Order notifications are sent to our own staff through Telegram or email. We never sell your data.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: ['We keep order records for 6 years for accounting, then delete or anonymise them.'],
      },
      {
        heading: 'Your rights',
        body: [
          'You can ask us to see, correct or delete your data at any time by calling or messaging us. You may also complain to the Personal Data Protection Service of Georgia.',
        ],
      },
    ],
  },
  terms: {
    updated: UPDATED,
    sections: [
      {
        heading: 'Orders',
        body: [
          'An order is confirmed when we accept it. The tracking page shows its status. We may decline an order, for example if we are too busy or you are outside our delivery area; the reason is shown on the tracking page.',
        ],
      },
      {
        heading: 'Prices and payment',
        body: [
          'Prices are in Georgian lari (GEL) and include VAT where applicable. You pay in cash on delivery, or when you collect your order.',
        ],
      },
      {
        heading: 'Delivery and collection',
        body: [
          'Delivery and ready times are estimates. Please make sure someone is available at the address and phone number you give us.',
        ],
      },
      {
        heading: 'Allergies',
        body: [
          'Our kitchen handles nuts, dairy, gluten and other allergens. Please tell us about allergies in the order notes or call us before ordering.',
        ],
      },
      {
        heading: 'Contact',
        body: ['Questions about an order: call or WhatsApp {phone}.'],
      },
    ],
  },
  refunds: {
    updated: UPDATED,
    sections: [
      {
        heading: 'Something wrong with your order?',
        body: [
          'Contact us within 24 hours with your order number (for example {orderExample}). We will replace the dish or refund it.',
        ],
      },
      {
        heading: 'Cancelling',
        body: [
          'To cancel, call or WhatsApp us on {phone}. Cancelling is free until we accept your order. After that, we cancel it if cooking has not started.',
        ],
      },
      {
        heading: 'How refunds are paid',
        body: [
          'Cash orders are refunded in cash or by bank transfer. Card payments are refunded to the same card.',
        ],
      },
    ],
  },
};

const ka: Record<LegalPage, LegalDoc> = {
  privacy: {
    updated: UPDATED,
    sections: [
      {
        heading: 'ვინ ვართ',
        body: ['{name}, {address}. ტელეფონი და WhatsApp: {phone}.'],
      },
      {
        heading: 'რას ვაგროვებთ და რატომ',
        body: [
          'შეკვეთისას ვაგროვებთ თქვენს სახელს, ტელეფონის ნომერს, ხოლო მიტანისას მისამართს და (თუ გააზიარებთ) მდებარეობას. ვიყენებთ მხოლოდ შეკვეთის მოსამზადებლად, მოსატანად და მასთან დაკავშირებით.',
          'სპამ-შეკვეთების თავიდან ასაცილებლად 30 დღემდე ვინახავთ თქვენი ინტერნეტ-მისამართის დაშიფრულ ფორმას. თავად მისამართს არ ვინახავთ.',
        ],
      },
      {
        heading: 'თქვენი მოწყობილობა',
        body: [
          'კალათა, ენა და (თუ მონიშნავთ „დაიმახსოვრე ჩემი მონაცემები“) სახელი, ტელეფონი და მისამართი ინახება თქვენსავე ბრაუზერში და არა ჩვენს სერვერებზე.',
          'სარეკლამო ან სათვალთვალო cookie-ებს არ ვიყენებთ.',
        ],
      },
      {
        heading: 'ვის ვუზიარებთ',
        body: [
          'შეკვეთის მონაცემებს ინახავენ ჩვენი ჰოსტინგისა და მონაცემთა ბაზის პროვაიდერები. თქვენს მონაცემებს არასოდეს ვყიდით.',
        ],
      },
      {
        heading: 'რამდენ ხანს ვინახავთ',
        body: [
          'შეკვეთების ჩანაწერებს ბუღალტერიისთვის ვინახავთ 6 წელი, შემდეგ ვშლით ან ვანონიმურებთ.',
        ],
      },
      {
        heading: 'თქვენი უფლებები',
        body: [
          'ნებისმიერ დროს შეგიძლიათ მოითხოვოთ თქვენი მონაცემების ნახვა, შესწორება ან წაშლა. ასევე შეგიძლიათ მიმართოთ პერსონალურ მონაცემთა დაცვის სამსახურს.',
        ],
      },
    ],
  },
  terms: {
    updated: UPDATED,
    sections: [
      {
        heading: 'შეკვეთები',
        body: [
          'შეკვეთა დადასტურებულია, როცა მას მივიღებთ. სტატუსი ჩანს თვალყურის დევნების გვერდზე. შესაძლოა შეკვეთა ვერ მივიღოთ, მაგალითად, დიდი დატვირთვის ან მიტანის ზონის გარეთ ყოფნის გამო.',
        ],
      },
      {
        heading: 'ფასები და გადახდა',
        body: ['ფასები ლარშია (GEL). გადახდა ხდება ნაღდი ფულით მიტანისას ან შეკვეთის წაღებისას.'],
      },
      {
        heading: 'მიტანა და გატანა',
        body: [
          'მიტანისა და მზადყოფნის დრო მიახლოებითია. გთხოვთ, იყოთ ხელმისაწვდომი მითითებულ მისამართსა და ნომერზე.',
        ],
      },
      {
        heading: 'ალერგია',
        body: [
          'ჩვენს სამზარეულოში გამოიყენება თხილი, რძის პროდუქტები, გლუტენი და სხვა ალერგენები. ალერგიის შესახებ მიუთითეთ შენიშვნაში ან დაგვირეკეთ.',
        ],
      },
      {
        heading: 'კონტაქტი',
        body: ['კითხვები შეკვეთის შესახებ: დარეკეთ ან მოგვწერეთ WhatsApp-ში {phone}.'],
      },
    ],
  },
  refunds: {
    updated: UPDATED,
    sections: [
      {
        heading: 'შეკვეთასთან პრობლემაა?',
        body: [
          'დაგვიკავშირდით 24 საათში შეკვეთის ნომრით (მაგ. {orderExample}). კერძს შევცვლით ან თანხას დაგიბრუნებთ.',
        ],
      },
      {
        heading: 'გაუქმება',
        body: [
          'გასაუქმებლად დაგვირეკეთ ან მოგვწერეთ WhatsApp-ზე: {phone}. გაუქმება უფასოა, სანამ შეკვეთას მივიღებთ. ამის შემდეგ გავაუქმებთ, თუ მზადება არ დაწყებულა.',
        ],
      },
      {
        heading: 'თანხის დაბრუნება',
        body: [
          'ნაღდი ფულით გადახდილი თანხა ბრუნდება ნაღდად ან საბანკო გადარიცხვით. ბარათით გადახდილი თანხა ბრუნდება იმავე ბარათზე.',
        ],
      },
    ],
  },
};

const ru: Record<LegalPage, LegalDoc> = {
  privacy: {
    updated: UPDATED,
    sections: [
      {
        heading: 'Кто мы',
        body: ['{name}, {address}. Телефон и WhatsApp: {phone}.'],
      },
      {
        heading: 'Какие данные мы собираем и зачем',
        body: [
          'При заказе мы получаем ваше имя, номер телефона, а для доставки — адрес и (если вы его отправите) местоположение. Мы используем их только чтобы приготовить, доставить заказ и связаться с вами по нему.',
          'Чтобы защищаться от спама, мы до 30 дней храним зашифрованный (хешированный) вид вашего интернет-адреса. Сам адрес мы не храним.',
        ],
      },
      {
        heading: 'Ваше устройство',
        body: [
          'Корзина, язык и (если вы отметите «Запомнить мои данные») имя, телефон и адрес хранятся в вашем браузере, а не на наших серверах.',
          'Мы не используем рекламные или отслеживающие cookie.',
        ],
      },
      {
        heading: 'Кому мы передаём данные',
        body: [
          'Данные заказов хранят наши провайдеры хостинга и базы данных. Мы никогда не продаём ваши данные.',
        ],
      },
      {
        heading: 'Сколько мы храним данные',
        body: [
          'Записи о заказах хранятся 6 лет для бухгалтерии, затем удаляются или обезличиваются.',
        ],
      },
      {
        heading: 'Ваши права',
        body: [
          'Вы можете в любой момент попросить показать, исправить или удалить ваши данные. Также вы можете обратиться в Службу защиты персональных данных Грузии.',
        ],
      },
    ],
  },
  terms: {
    updated: UPDATED,
    sections: [
      {
        heading: 'Заказы',
        body: [
          'Заказ подтверждён, когда мы его приняли. Статус виден на странице отслеживания. Мы можем отказать в заказе, например при большой загрузке или вне зоны доставки.',
        ],
      },
      {
        heading: 'Цены и оплата',
        body: [
          'Цены указаны в лари (GEL). Оплата наличными при доставке или при получении заказа.',
        ],
      },
      {
        heading: 'Доставка и самовывоз',
        body: [
          'Время доставки и готовности примерное. Пожалуйста, будьте доступны по указанному адресу и телефону.',
        ],
      },
      {
        heading: 'Аллергия',
        body: [
          'На нашей кухне используются орехи, молочные продукты, глютен и другие аллергены. Сообщите об аллергии в комментарии или позвоните нам.',
        ],
      },
      {
        heading: 'Контакты',
        body: ['Вопросы по заказу: звоните или пишите в WhatsApp {phone}.'],
      },
    ],
  },
  refunds: {
    updated: UPDATED,
    sections: [
      {
        heading: 'Проблема с заказом?',
        body: [
          'Свяжитесь с нами в течение 24 часов, указав номер заказа (например, {orderExample}). Мы заменим блюдо или вернём деньги.',
        ],
      },
      {
        heading: 'Отмена',
        body: [
          'Чтобы отменить заказ, позвоните или напишите нам в WhatsApp: {phone}. Отмена бесплатна, пока мы не приняли заказ. После этого мы отменим его, если готовка не началась.',
        ],
      },
      {
        heading: 'Как возвращаются деньги',
        body: [
          'За наличные заказы деньги возвращаются наличными или банковским переводом. Оплата картой возвращается на ту же карту.',
        ],
      },
    ],
  },
};

export const LEGAL: Record<Locale, Record<LegalPage, LegalDoc>> = { en, ka, ru };
